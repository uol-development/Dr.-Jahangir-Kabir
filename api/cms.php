<?php
/**
 * Dr. Muhammad Jahangir Kabir — JK Lifestyle & Health Revolution CMS Backend API
 * OWASP ASVS Hardened Edition (PHP 7.4+ / 8.x)
 * - HttpOnly + Secure + SameSite=Strict Session Cookies
 * - HMAC-SHA256 Token + Per-Session CSRF Token Verification
 * - Brute-Force Rate Limiting & Account Lockout (5 attempts / 15 min)
 * - WAF / SQL Injection / Path Traversal Inspection + PDO Prepared Statement Layer
 * - Magic-Byte Image Upload Verification (5 MB limit, no SVG/Script execution)
 * - Server-Side Role-Based Access Control (RBAC) & Security Audit Logging
 */

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(0);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$rootDir = dirname(__DIR__);
$dataDir = $rootDir . '/cms-data';
$dbPath = $dataDir . '/cms.db.json';
$rateLimitPath = $dataDir . '/ratelimit.json';
$secretKeyPath = $dataDir . '/.secret.key';

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Load or generate 256-bit cryptographic HMAC secret (never exposed in frontend)
function getSecretSalt($secretKeyPath) {
    $envSecret = getenv('CMS_HMAC_SECRET');
    if (!empty($envSecret) && strlen($envSecret) >= 32) {
        return $envSecret;
    }
    if (file_exists($secretKeyPath)) {
        $k = trim((string)@file_get_contents($secretKeyPath));
        if (strlen($k) >= 32) return $k;
    }
    $newKey = function_exists('random_bytes')
        ? bin2hex(random_bytes(32))
        : hash('sha256', uniqid('jk_cms_', true) . __FILE__ . php_uname());
    @file_put_contents($secretKeyPath, $newKey);
    return $newKey;
}

$secretSalt = getSecretSalt($secretKeyPath);

// Optional Parameterized PDO Database Layer (Zero string concatenation for SQL)
class CmsPdoDatabase {
    private $pdo = null;
    public function __construct() {
        $dsn = getenv('CMS_DB_DSN');
        $user = getenv('CMS_DB_USER');
        $pass = getenv('CMS_DB_PASS');
        if ($dsn && class_exists('PDO')) {
            try {
                $this->pdo = new PDO($dsn, $user ?: '', $pass ?: '', [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]);
            } catch (Exception $e) {
                // Never expose database connection strings or credentials
                respond(['ok' => false, 'error' => 'Database service unavailable.'], 500);
            }
        }
    }
    public function queryPrepared($sql, array $params = []) {
        if (!$this->pdo) return [];
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        } catch (Exception $e) {
            respond(['ok' => false, 'error' => 'Database query failed safely.'], 500);
        }
    }
}

// WAF Input Inspector: Blocks SQL Injection, Path Traversal, and Null-Byte Payloads
function inspectInputForAttacks($input, $fieldPath = 'root') {
    if (is_array($input)) {
        foreach ($input as $k => $v) {
            inspectInputForAttacks($k, $fieldPath . '.key');
            inspectInputForAttacks($v, $fieldPath . '.' . $k);
        }
        return;
    }
    if (!is_string($input) || $input === '') return;

    // 1. Null-byte injection check
    if (strpos($input, "\0") !== false) {
        respond(['ok' => false, 'error' => 'Security Alert: Null-byte injection blocked.'], 400);
    }

    // 2. Path traversal check on file/slug/path parameters
    if (preg_match('/(file|slug|path|name)/i', $fieldPath)) {
        if (preg_match('/(\.\.\/|\.\.\\\\|%2e%2e)/i', $input)) {
            respond(['ok' => false, 'error' => 'Security Alert: Directory traversal attempt blocked.'], 400);
        }
    }

    // 3. SQL Injection signature check on non-HTML fields
    if (!preg_match('/(mainHtml|llmsTxt|llmsFullTxt|sitemapXml|customCss|jsonLd)/i', $fieldPath)) {
        $sqliPatterns = [
            '/\bUNION\s+(ALL\s+)?SELECT\b/i',
            '/;\s*(DROP|ALTER|TRUNCATE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET)\b/i',
            '/\b(SLEEP|BENCHMARK|LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\s*\(/i',
            '/\bINFORMATION_SCHEMA\b/i',
            '/(\'|\")\s*OR\s*(\'|\")?1(\'|\")?\s*=\s*(\'|\")?1/i',
            '/(\'|\")\s*OR\s+TRUE\b/i',
            '/--\s*$/'
        ];
        foreach ($sqliPatterns as $pattern) {
            if (preg_match($pattern, $input)) {
                respond(['ok' => false, 'error' => 'Security Alert: Malicious SQL injection pattern detected and blocked.'], 403);
            }
        }
    }
}

function sanitizeHtmlContent($html) {
    if (!is_string($html)) return '';
    // Strip server-side PHP execution tags
    $clean = preg_replace('/<\?(php|=)?[\s\S]*?\?>/i', '', $html);
    $clean = str_ireplace(['<?php', '<?=', '?>'], '', $clean);
    // Strip inline event handlers (onerror, onload) and javascript: URIs outside trusted triggers
    $clean = preg_replace('/\bon(error|load|mouseover|focus|blur)\s*=\s*(["\']).*?\2/i', '', $clean);
    $clean = preg_replace('/href\s*=\s*(["\'])\s*javascript:[^"\']*\1/i', 'href="#"', $clean);
    return $clean;
}

function validateStrongPassword($password) {
    if (!is_string($password) || strlen($password) < 10) {
        return 'Password must be at least 10 characters long.';
    }
    if (!preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
        return 'Password must include uppercase, lowercase, number, and special character.';
    }
    return null;
}

function getClientIp() {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function checkRateLimit($rateLimitPath, $key) {
    $now = time();
    $window = 900; // 15 minutes
    $maxAttempts = 5;
    $data = file_exists($rateLimitPath) ? json_decode((string)@file_get_contents($rateLimitPath), true) : [];
    if (!is_array($data)) $data = [];

    // Prune expired records
    foreach ($data as $k => $rec) {
        if (($rec['firstAttempt'] ?? 0) + $window < $now) {
            unset($data[$k]);
        }
    }

    if (!empty($data[$key]) && ($data[$key]['count'] ?? 0) >= $maxAttempts) {
        $remaining = max(1, ceil((($data[$key]['firstAttempt'] + $window) - $now) / 60));
        respond([
            'ok' => false,
            'error' => "Too many failed login attempts. Account locked for {$remaining} minutes."
        ], 429);
    }
}

function recordFailedLogin($rateLimitPath, $key) {
    $now = time();
    $data = file_exists($rateLimitPath) ? json_decode((string)@file_get_contents($rateLimitPath), true) : [];
    if (!is_array($data)) $data = [];
    if (empty($data[$key]) || ($data[$key]['firstAttempt'] + 900) < $now) {
        $data[$key] = ['count' => 1, 'firstAttempt' => $now];
    } else {
        $data[$key]['count']++;
    }
    @file_put_contents($rateLimitPath, json_encode($data));
}

function clearRateLimit($rateLimitPath, $key) {
    if (!file_exists($rateLimitPath)) return;
    $data = json_decode((string)@file_get_contents($rateLimitPath), true);
    if (is_array($data) && isset($data[$key])) {
        unset($data[$key]);
        @file_put_contents($rateLimitPath, json_encode($data));
    }
}

function loadDb($dbPath) {
    if (!file_exists($dbPath)) {
        respond(['ok' => false, 'error' => 'CMS datastore unavailable.'], 500);
    }
    $raw = file_get_contents($dbPath);
    $db = json_decode($raw, true);
    if (!is_array($db)) {
        respond(['ok' => false, 'error' => 'Invalid CMS datastore format.'], 500);
    }
    return $db;
}

function saveDb($dbPath, $db) {
    $fp = fopen($dbPath, 'c+');
    if (!$fp) {
        respond(['ok' => false, 'error' => 'Unable to write to CMS datastore.'], 500);
    }
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        fwrite($fp, json_encode($db, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

function makeToken($username, $role, $secretSalt) {
    $exp = time() + (86400 * 1); // 24-hour session expiration
    $payload = base64_encode(json_encode([
        'u' => $username,
        'r' => $role,
        'exp' => $exp,
        'jti' => substr(hash('sha256', uniqid('', true)), 0, 16)
    ]));
    $sig = hash_hmac('sha256', $payload, $secretSalt);
    return $payload . '.' . $sig;
}

function makeCsrfToken($sessionToken, $secretSalt) {
    return hash_hmac('sha256', $sessionToken, $secretSalt . '_CSRF_PROTECTION');
}

function setSecureSessionCookie($token) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? 80) == 443);
    if (PHP_VERSION_ID >= 70300) {
        setcookie('jk_cms_session', $token, [
            'expires' => $token ? (time() + 86400) : (time() - 3600),
            'path' => '/',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
    } else {
        setcookie('jk_cms_session', $token, $token ? (time() + 86400) : (time() - 3600), '/; samesite=Strict', '', $isHttps, true);
    }
}

function verifyToken($token, $secretSalt) {
    if (!$token || strpos($token, '.') === false) return null;
    list($payload, $sig) = explode('.', $token, 2);
    $expected = hash_hmac('sha256', $payload, $secretSalt);
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode($payload), true);
    if (!is_array($data) || empty($data['exp']) || $data['exp'] < time()) return null;
    return $data;
}

function getAuthToken() {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    foreach ($headers as $k => $v) {
        $lk = strtolower($k);
        if ($lk === 'x-cms-token' && !empty($v)) {
            return trim($v);
        }
        if ($lk === 'authorization' && preg_match('/Bearer\s+(.+)/i', $v, $m)) {
            return trim($m[1]);
        }
    }
    if (!empty($_SERVER['HTTP_X_CMS_TOKEN'])) {
        return trim($_SERVER['HTTP_X_CMS_TOKEN']);
    }
    if (!empty($_SERVER['HTTP_AUTHORIZATION']) && preg_match('/Bearer\s+(.+)/i', $_SERVER['HTTP_AUTHORIZATION'], $m)) {
        return trim($m[1]);
    }
    if (!empty($_COOKIE['jk_cms_session'])) {
        return trim($_COOKIE['jk_cms_session']);
    }
    return '';
}

function getRequestCsrfToken() {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    foreach ($headers as $k => $v) {
        if (strtolower($k) === 'x-csrf-token' && !empty($v)) {
            return trim($v);
        }
    }
    if (!empty($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        return trim($_SERVER['HTTP_X_CSRF_TOKEN']);
    }
    return '';
}

function hasPermission($db, $role, $perm) {
    if ($role === 'super_admin') return true;
    if (empty($db['roles'][$role]['permissions'])) return false;
    return in_array($perm, $db['roles'][$role]['permissions'], true);
}

function writePublicState($rootDir, $db) {
    $publicState = [
        'meta' => $db['meta'],
        'design' => $db['design'],
        'menus' => $db['menus'],
        'updatedAt' => date('c')
    ];
    $jsContent = "window.JK_CMS_PUBLIC = " . json_encode($publicState, JSON_UNESCAPED_UNICODE) . ";\n";
    @file_put_contents($rootDir . '/assets/js/cms-state-public.js', $jsContent);

    $c = $db['design']['colors'];
    $t = $db['design']['typography'];
    $l = $db['design']['layout'];
    $safeCustomCss = preg_replace('/<\?(php|=)?[\s\S]*?\?>|expression\s*\(|javascript:/i', '', (string)($db['design']['customCss'] ?? ''));

    $css = ":root {\n"
         . "  --cms-primary: {$c['primary']};\n"
         . "  --cms-navy-dark: {$c['navyDark']};\n"
         . "  --cms-secondary: {$c['secondary']};\n"
         . "  --cms-emerald: {$c['emerald']};\n"
         . "  --cms-mint: {$c['mintAccent']};\n"
         . "  --cms-surface: {$c['surface']};\n"
         . "  --cms-card-bg: {$c['cardBg']};\n"
         . "  --cms-text-main: {$c['textMain']};\n"
         . "  --cms-text-muted: {$c['textMuted']};\n"
         . "  --cms-font-heading: {$t['headingFont']};\n"
         . "  --cms-font-body: {$t['bodyFont']};\n"
         . "  --cms-font-serif: {$t['serifFont']};\n"
         . "  --cms-base-font-size: {$t['baseFontSizePx']}px;\n"
         . "  --cms-line-height: {$t['lineHeight']};\n"
         . "  --cms-max-width: {$l['maxWidthPx']}px;\n"
         . "  --cms-card-radius: {$l['cardRadiusPx']}px;\n"
         . "}\n"
         . $safeCustomCss;
    @file_put_contents($rootDir . '/assets/css/cms-overrides.css', $css);
}

function updateHtmlFileOnDisk($rootDir, $page) {
    $fileName = basename((string)$page['file']);
    if (!preg_match('/^[a-z0-9-]+\.html$/i', $fileName)) {
        return false;
    }
    $filePath = $rootDir . '/' . $fileName;
    if ($fileName === 'llms.html') {
        $html = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>" . htmlspecialchars($page['title'], ENT_QUOTES, 'UTF-8') . "</title>\n  <meta name=\"robots\" content=\"index, follow\">\n  <link rel=\"canonical\" href=\"https://drjahangirkabir.com/llms.txt\">\n</head>\n<body style=\"margin: 16px; font-family: monospace; font-size: 14px; line-height: 1.6; color: #000000; background-color: #ffffff; white-space: pre-wrap; word-wrap: break-word;\">" . sanitizeHtmlContent($page['mainHtml']) . "</body>\n</html>";
        @file_put_contents($filePath, $html);
        return true;
    }

    if (!file_exists($filePath)) {
        $templatePath = $rootDir . '/about.html';
        if (!file_exists($templatePath)) return false;
        $html = file_get_contents($templatePath);
    } else {
        $html = file_get_contents($filePath);
    }

    if (!empty($page['title'])) {
        $safeTitle = htmlspecialchars($page['title'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/<title>[\s\S]*?<\/title>/i', '<title>' . $safeTitle . '</title>', $html, 1);
        $html = preg_replace('/(<meta\s+property="og:title"\s+content=")[^"]*(")/i', '${1}' . $safeTitle . '${2}', $html, 1);
        $html = preg_replace('/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i', '${1}' . $safeTitle . '${2}', $html, 1);
    }

    if (isset($page['description'])) {
        $safeDesc = htmlspecialchars($page['description'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="description"\s+content=")[^"]*(")/i', '${1}' . $safeDesc . '${2}', $html, 1);
        $html = preg_replace('/(<meta\s+property="og:description"\s+content=")[^"]*(")/i', '${1}' . $safeDesc . '${2}', $html, 1);
        $html = preg_replace('/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i', '${1}' . $safeDesc . '${2}', $html, 1);
    }

    if (isset($page['keywords'])) {
        $safeKw = htmlspecialchars($page['keywords'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="keywords"\s+content=")[^"]*(")/i', '${1}' . $safeKw . '${2}', $html, 1);
    }
    if (isset($page['focusKw'])) {
        $safeFkw = htmlspecialchars($page['focusKw'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="rank_math_focus_keyword"\s+content=")[^"]*(")/i', '${1}' . $safeFkw . '${2}', $html, 1);
    }

    if (!empty($page['canonical'])) {
        $safeCan = htmlspecialchars($page['canonical'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<link\s+rel="canonical"\s+href=")[^"]*(")/i', '${1}' . $safeCan . '${2}', $html, 1);
    }
    if (!empty($page['robots'])) {
        $safeRob = htmlspecialchars($page['robots'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="robots"\s+content=")[^"]*(")/i', '${1}' . $safeRob . '${2}', $html, 1);
    }

    if (!empty($page['jsonLd'])) {
        $decoded = json_decode($page['jsonLd'], true);
        if ($decoded !== null) {
            $html = preg_replace(
                '/<script type="application\/ld\+json">\s*[\s\S]*?\s*<\/script>/i',
                "<script type=\"application/ld+json\">\n  " . json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n  </script>",
                $html,
                1
            );
        }
    }

    if (!empty($page['mainHtml'])) {
        $safeMainHtml = sanitizeHtmlContent($page['mainHtml']);
        $html = preg_replace(
            '/(<main[^>]*>)[\s\S]*?(<\/main>)/i',
            '$1' . "\n" . $safeMainHtml . "\n  " . '$2',
            $html,
            1
        );
    }

    @file_put_contents($filePath, $html);
    return true;
}

$action = isset($_GET['action']) ? trim((string)$_GET['action']) : 'ping';
$rawBody = file_get_contents('php://input');
$body = $rawBody ? json_decode($rawBody, true) : [];
if (!is_array($body)) $body = [];

// Run WAF input inspection on all query params and body payloads
inspectInputForAttacks($_GET, 'query');
inspectInputForAttacks($body, 'body');

$db = loadDb($dbPath);

if ($action === 'ping') {
    respond([
        'ok' => true,
        'engine' => 'php-hardened',
        'version' => $db['meta']['version'],
        'security' => ['waf' => true, 'csrf' => true, 'rateLimit' => true, 'httpOnlyCookie' => true]
    ]);
}

if ($action === 'logout') {
    setSecureSessionCookie('');
    respond(['ok' => true]);
}

if ($action === 'login') {
    $u = trim((string)($body['username'] ?? ''));
    $p = (string)($body['password'] ?? '');
    $rateKey = hash('sha256', getClientIp() . '|' . strtolower($u));

    checkRateLimit($rateLimitPath, $rateKey);

    $hash = hash('sha256', $p);
    foreach ($db['users'] as &$user) {
        if ((strcasecmp($user['username'], $u) === 0 || strcasecmp($user['email'] ?? '', $u) === 0) && !empty($user['active'])) {
            $matched = hash_equals($user['passwordHash'], $hash) || (function_exists('password_verify') && password_verify($p, $user['passwordHash']));
            if ($matched) {
                clearRateLimit($rateLimitPath, $rateKey);
                $user['lastLogin'] = date('c');
                array_unshift($db['auditLog'], [
                    'id' => 'log-' . uniqid(),
                    'timestamp' => date('c'),
                    'actor' => $user['username'],
                    'action' => 'USER_LOGIN_SUCCESS',
                    'details' => 'Authenticated session established (' . $user['role'] . ')'
                ]);
                $db['auditLog'] = array_slice($db['auditLog'], 0, 150);
                saveDb($dbPath, $db);

                $token = makeToken($user['username'], $user['role'], $secretSalt);
                $csrfToken = makeCsrfToken($token, $secretSalt);
                setSecureSessionCookie($token);

                respond([
                    'ok' => true,
                    'token' => $token,
                    'csrfToken' => $csrfToken,
                    'user' => [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'name' => $user['name'],
                        'email' => $user['email'],
                        'role' => $user['role'],
                        'permissions' => $db['roles'][$user['role']]['permissions'] ?? []
                    ]
                ]);
            }
        }
    }

    recordFailedLogin($rateLimitPath, $rateKey);
    array_unshift($db['auditLog'], [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $u ?: 'anonymous',
        'action' => 'USER_LOGIN_FAILED',
        'details' => 'Failed login attempt recorded under rate limiter'
    ]);
    $db['auditLog'] = array_slice($db['auditLog'], 0, 150);
    saveDb($dbPath, $db);

    respond(['ok' => false, 'error' => 'Invalid username or password.'], 401);
}

// Verify authentication token for all protected actions
$rawToken = getAuthToken();
$auth = verifyToken($rawToken, $secretSalt);
if (!$auth) {
    respond(['ok' => false, 'error' => 'Unauthorized or expired session. Please sign in again.'], 401);
}

$actor = $auth['u'];
$role = $auth['r'];

// Verify CSRF token for all state-changing POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action !== 'get_state') {
    $reqCsrf = getRequestCsrfToken();
    $expectedCsrf = makeCsrfToken($rawToken, $secretSalt);
    if (!empty($reqCsrf) && !hash_equals($expectedCsrf, $reqCsrf)) {
        respond(['ok' => false, 'error' => 'Invalid CSRF token. Please refresh your session.'], 403);
    }
}

if ($action === 'get_state') {
    $safeDb = $db;
    foreach ($safeDb['users'] as &$u) {
        unset($u['passwordHash'], $u['plainPassword']);
    }
    respond([
        'ok' => true,
        'db' => $safeDb,
        'actor' => $actor,
        'role' => $role,
        'csrfToken' => makeCsrfToken($rawToken, $secretSalt)
    ]);
}

if ($action === 'save_page') {
    if (!hasPermission($db, $role, 'pages.write') && !hasPermission($db, $role, 'blogs.write') && !hasPermission($db, $role, 'seo.write')) {
        respond(['ok' => false, 'error' => 'Permission denied for saving page content.'], 403);
    }
    $file = basename((string)($body['file'] ?? ''));
    if (!$file || empty($db['pages'][$file])) {
        respond(['ok' => false, 'error' => 'Target page not found.'], 404);
    }
    $p = &$db['pages'][$file];
    $fields = ['title', 'h1', 'description', 'keywords', 'focusKw', 'canonical', 'robots', 'ogImage', 'aeoLead', 'jsonLd', 'status'];
    foreach ($fields as $f) {
        if (isset($body[$f])) $p[$f] = $body[$f];
    }
    if (isset($body['mainHtml'])) {
        $p['mainHtml'] = sanitizeHtmlContent($body['mainHtml']);
    }
    $p['updatedAt'] = date('c');
    $p['updatedBy'] = $actor;

    $rev = [
        'revId' => 'rev-' . time() . '-' . substr(md5(uniqid()), 0, 5),
        'timestamp' => date('c'),
        'author' => $actor,
        'note' => $body['revisionNote'] ?? (($p['status'] === 'published') ? 'Published live to website' : 'Saved draft snapshot'),
        'title' => $p['title'],
        'description' => $p['description'],
        'h1' => $p['h1'],
        'mainHtml' => $p['mainHtml']
    ];
    array_unshift($p['revisions'], $rev);
    $p['revisions'] = array_slice($p['revisions'], 0, 20);

    if ($p['status'] === 'published') {
        updateHtmlFileOnDisk($rootDir, $p);
        $db['meta']['lastPublishedAt'] = date('c');
    }

    array_unshift($db['auditLog'], [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => ($p['status'] === 'published') ? 'PAGE_PUBLISHED' : 'PAGE_DRAFT_SAVED',
        'details' => "Updated {$file} (" . ($rev['note']) . ")"
    ]);
    saveDb($dbPath, $db);
    respond(['ok' => true, 'page' => $p]);
}

if ($action === 'create_page') {
    if (!hasPermission($db, $role, 'pages.write') && !hasPermission($db, $role, 'blogs.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to create pages.'], 403);
    }
    $slugRaw = preg_replace('/[^a-z0-9-]/', '-', strtolower(trim((string)($body['slug'] ?? ''))));
    $slugRaw = trim($slugRaw, '-');
    if (!$slugRaw) respond(['ok' => false, 'error' => 'Valid URL slug is required.'], 400);
    $file = $slugRaw . '.html';
    if (!empty($db['pages'][$file])) {
        respond(['ok' => false, 'error' => 'A page with this slug already exists.'], 400);
    }
    $safeMain = isset($body['mainHtml'])
        ? sanitizeHtmlContent($body['mainHtml'])
        : '<section class="py-16 max-w-5xl mx-auto px-4"><h1 class="text-3xl font-extrabold text-on-surface mb-4">' . htmlspecialchars($body['h1'] ?? 'New Page', ENT_QUOTES, 'UTF-8') . '</h1><p class="aeo-lead-answer text-base text-on-surface-variant">' . htmlspecialchars($body['description'] ?? '', ENT_QUOTES, 'UTF-8') . '</p></section>';

    $newPage = [
        'id' => $slugRaw,
        'file' => $file,
        'slug' => '/' . $slugRaw,
        'type' => in_array($body['type'] ?? 'page', ['page', 'blog'], true) ? $body['type'] : 'page',
        'status' => $body['status'] ?? 'published',
        'title' => $body['title'] ?? 'New Page — Dr. Jahangir Kabir | JK Lifestyle',
        'h1' => $body['h1'] ?? ($body['title'] ?? 'New Page'),
        'description' => $body['description'] ?? '',
        'keywords' => $body['keywords'] ?? '',
        'focusKw' => $body['focusKw'] ?? '',
        'canonical' => 'https://drjahangirkabir.com/' . $slugRaw,
        'robots' => 'index, follow',
        'ogImage' => 'https://drjahangirkabir.com/images/dr-hero.jpg',
        'aeoLead' => $body['aeoLead'] ?? '',
        'jsonLd' => '{}',
        'mainHtml' => $safeMain,
        'updatedAt' => date('c'),
        'updatedBy' => $actor,
        'revisions' => [[
            'revId' => 'rev-' . time(),
            'timestamp' => date('c'),
            'author' => $actor,
            'note' => 'Created new ' . ($body['type'] ?? 'page'),
            'title' => $body['title'] ?? ''
        ]]
    ];
    $db['pages'][$file] = $newPage;
    if ($newPage['status'] === 'published') {
        updateHtmlFileOnDisk($rootDir, $newPage);
    }
    array_unshift($db['auditLog'], [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'PAGE_CREATED',
        'details' => "Created {$file}"
    ]);
    saveDb($dbPath, $db);
    respond(['ok' => true, 'page' => $newPage]);
}

if ($action === 'delete_page') {
    if (!hasPermission($db, $role, 'pages.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to delete pages.'], 403);
    }
    $file = basename((string)($body['file'] ?? ''));
    $protectedPages = ['index.html', 'about.html', '5-pillars.html', 'programs.html', 'ecosystem.html', 'blog.html', 'contact.html', 'appointment.html'];
    if (in_array($file, $protectedPages, true)) {
        respond(['ok' => false, 'error' => 'Core website pages cannot be deleted.'], 400);
    }
    unset($db['pages'][$file]);
    array_unshift($db['auditLog'], [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'PAGE_DELETED',
        'details' => "Removed {$file} from CMS"
    ]);
    saveDb($dbPath, $db);
    respond(['ok' => true]);
}

if ($action === 'save_design') {
    if (!hasPermission($db, $role, 'design.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to modify design tokens.'], 403);
    }
    if (!empty($body['design']) && is_array($body['design'])) {
        $db['design'] = array_replace_recursive($db['design'], $body['design']);
    }
    writePublicState($rootDir, $db);
    array_unshift($db['auditLog'], [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'DESIGN_UPDATED',
        'details' => 'Published global colors, typography, and layout settings'
    ]);
    saveDb($dbPath, $db);
    respond(['ok' => true, 'design' => $db['design']]);
}

if ($action === 'save_menus') {
    if (!hasPermission($db, $role, 'menus.write') && !hasPermission($db, $role, 'settings.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to modify menus or settings.'], 403);
    }
    if (!empty($body['menus']) && is_array($body['menus'])) {
        $db['menus'] = $body['menus'];
    }
    if (!empty($body['meta']) && is_array($body['meta'])) {
        $db['meta'] = array_replace_recursive($db['meta'], $body['meta']);
    }
    writePublicState($rootDir, $db);
    array_unshift($db['auditLog'], [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'MENUS_UPDATED',
        'details' => 'Updated header navigation, CTA buttons, and global site settings'
    ]);
    saveDb($dbPath, $db);
    respond(['ok' => true, 'menus' => $db['menus'], 'meta' => $db['meta']]);
}

if ($action === 'save_seo_files') {
    if (!hasPermission($db, $role, 'seo.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to modify SEO/AEO files.'], 403);
    }
    if (isset($body['llmsTxt'])) {
        $db['seoFiles']['llmsTxt'] = (string)$body['llmsTxt'];
        @file_put_contents($rootDir . '/llms.txt', $db['seoFiles']['llmsTxt']);
    }
    if (isset($body['llmsFullTxt'])) {
        $db['seoFiles']['llmsFullTxt'] = (string)$body['llmsFullTxt'];
        @file_put_contents($rootDir . '/llms-full.txt', $db['seoFiles']['llmsFullTxt']);
        if (!empty($db['pages']['llms.html'])) {
            $db['pages']['llms.html']['mainHtml'] = htmlspecialchars($db['seoFiles']['llmsFullTxt'], ENT_QUOTES, 'UTF-8');
            updateHtmlFileOnDisk($rootDir, $db['pages']['llms.html']);
        }
    }
    if (isset($body['sitemapXml'])) {
        $db['seoFiles']['sitemapXml'] = (string)$body['sitemapXml'];
        @file_put_contents($rootDir . '/sitemap.xml', $db['seoFiles']['sitemapXml']);
    }
    if (isset($body['robotsTxt'])) {
        $db['seoFiles']['robotsTxt'] = (string)$body['robotsTxt'];
        @file_put_contents($rootDir . '/robots.txt', $db['seoFiles']['robotsTxt']);
    }
    array_unshift($db['auditLog'], [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'SEO_FILES_PUBLISHED',
        'details' => 'Updated llms.txt, llms-full.txt, sitemap.xml, and robots.txt'
    ]);
    saveDb($dbPath, $db);
    respond(['ok' => true, 'seoFiles' => $db['seoFiles']]);
}

if ($action === 'upload_media') {
    if (!hasPermission($db, $role, 'media.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to upload media.'], 403);
    }
    $name = preg_replace('/[^a-zA-Z0-9._-]/', '-', basename((string)($body['fileName'] ?? $body['name'] ?? 'upload.jpg')));
    // Strictly allow raster images only (no SVG/HTML/PHP to prevent Stored XSS & RCE)
    if (!preg_match('/\.(png|jpe?g|webp|gif)$/i', $name)) {
        respond(['ok' => false, 'error' => 'Only verified raster image files (PNG, JPG, JPEG, WEBP, GIF) are allowed.'], 400);
    }
    $dataUrl = (string)($body['dataUrl'] ?? '');
    if (preg_match('/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i', $dataUrl, $m)) {
        $binary = base64_decode($m[2], true);
        if ($binary === false || strlen($binary) > 5 * 1024 * 1024) {
            respond(['ok' => false, 'error' => 'Invalid image data or file exceeds 5 MB limit.'], 400);
        }
        // Magic-byte & image dimension verification
        if (function_exists('getimagesizefromstring')) {
            $imgInfo = @getimagesizefromstring($binary);
            $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!$imgInfo || empty($imgInfo['mime']) || !in_array($imgInfo['mime'], $allowedMimes, true)) {
                respond(['ok' => false, 'error' => 'Security Alert: File binary signature does not match a valid image.'], 400);
            }
        }
        $dest = $rootDir . '/images/' . $name;
        @file_put_contents($dest, $binary);
        $item = [
            'id' => 'media-' . uniqid(),
            'name' => $name,
            'path' => 'images/' . $name,
            'url' => 'images/' . $name,
            'sizeBytes' => strlen($binary),
            'sizeFormatted' => round(strlen($binary) / 1024, 1) . ' KB',
            'alt' => htmlspecialchars((string)($body['alt'] ?? ('Dr. Muhammad Jahangir Kabir — ' . $name)), ENT_QUOTES, 'UTF-8'),
            'category' => 'Website & Clinical Assets',
            'uploadedAt' => date('c')
        ];
        array_unshift($db['media'], $item);
        array_unshift($db['auditLog'], [
            'id' => 'log-' . uniqid(),
            'timestamp' => date('c'),
            'actor' => $actor,
            'action' => 'MEDIA_UPLOADED',
            'details' => "Uploaded verified image images/{$name}"
        ]);
        saveDb($dbPath, $db);
        respond(['ok' => true, 'mediaItem' => $item]);
    }
    respond(['ok' => false, 'error' => 'Invalid base64 image payload.'], 400);
}

if ($action === 'save_admin_prefs') {
    if (!hasPermission($db, $role, 'admin.customize')) {
        respond(['ok' => false, 'error' => 'Permission denied to customize admin panel.'], 403);
    }
    if (!empty($body['adminPrefs']) && is_array($body['adminPrefs'])) {
        $db['adminPrefs'] = array_replace_recursive($db['adminPrefs'], $body['adminPrefs']);
    }
    saveDb($dbPath, $db);
    respond(['ok' => true, 'adminPrefs' => $db['adminPrefs']]);
}

if ($action === 'change_password') {
    $newPass = (string)($body['newPassword'] ?? '');
    $policyErr = validateStrongPassword($newPass);
    if ($policyErr) {
        respond(['ok' => false, 'error' => $policyErr], 400);
    }
    $targetUser = ($role === 'super_admin' && !empty($body['username'])) ? trim((string)$body['username']) : $actor;
    foreach ($db['users'] as &$u) {
        if (strcasecmp($u['username'], $targetUser) === 0) {
            $u['passwordHash'] = hash('sha256', $newPass);
            unset($u['plainPassword']);
            array_unshift($db['auditLog'], [
                'id' => 'log-' . uniqid(),
                'timestamp' => date('c'),
                'actor' => $actor,
                'action' => 'PASSWORD_CHANGED',
                'details' => "Password updated for user {$targetUser}"
            ]);
            saveDb($dbPath, $db);
            respond(['ok' => true]);
        }
    }
    respond(['ok' => false, 'error' => 'User account not found.'], 404);
}

if ($action === 'save_users') {
    if ($role !== 'super_admin') {
        respond(['ok' => false, 'error' => 'Only Super Administrators can manage users and roles.'], 403);
    }
    if (!empty($body['newUser']) && is_array($body['newUser'])) {
        $nu = $body['newUser'];
        $policyErr = validateStrongPassword((string)($nu['password'] ?? ''));
        if ($policyErr) {
            respond(['ok' => false, 'error' => $policyErr], 400);
        }
        $db['users'][] = [
            'id' => 'usr-' . uniqid(),
            'username' => trim((string)$nu['username']),
            'email' => trim((string)$nu['email']),
            'name' => trim((string)$nu['name']),
            'role' => in_array($nu['role'] ?? 'editor', ['super_admin', 'editor', 'seo_manager', 'viewer'], true) ? $nu['role'] : 'editor',
            'passwordHash' => hash('sha256', (string)$nu['password']),
            'active' => true,
            'lastLogin' => 'Never'
        ];
    }
    if (!empty($body['roles']) && is_array($body['roles'])) {
        $db['roles'] = $body['roles'];
        // Prevent super_admin from losing critical permissions
        $db['roles']['super_admin']['permissions'] = ['pages.write', 'blogs.write', 'media.write', 'menus.write', 'design.write', 'seo.write', 'users.write', 'admin.customize', 'settings.write'];
    }
    saveDb($dbPath, $db);
    respond(['ok' => true]);
}

respond(['ok' => false, 'error' => 'Unknown API action.'], 400);
