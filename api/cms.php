<?php
/**
 * Dr. Muhammad Jahangir Kabir — JK Lifestyle & Health Revolution CMS Backend API
 * Compatible with cPanel / Apache / PHP 7.4+ & 8.x
 * Provides Authentication, RBAC, Revision History, Media Upload, and Direct HTML File Publishing.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$rootDir = dirname(__DIR__);
$dbPath = $rootDir . '/cms-data/cms.db.json';
$secretSalt = 'JK_LIFESTYLE_CLINICAL_SANCTUARY_2026_HMAC_KEY';

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function loadDb($dbPath) {
    if (!file_exists($dbPath)) {
        respond(['ok' => false, 'error' => 'CMS database file not found.'], 500);
    }
    $raw = file_get_contents($dbPath);
    $db = json_decode($raw, true);
    if (!is_array($db)) {
        respond(['ok' => false, 'error' => 'Corrupted CMS database JSON.'], 500);
    }
    return $db;
}

function saveDb($dbPath, $db) {
    $fp = fopen($dbPath, 'c+');
    if (!$fp) {
        respond(['ok' => false, 'error' => 'Unable to open CMS database for writing.'], 500);
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
    $exp = time() + (86400 * 7);
    $payload = base64_encode(json_encode(['u' => $username, 'r' => $role, 'exp' => $exp]));
    $sig = hash_hmac('sha256', $payload, $secretSalt);
    return $payload . '.' . $sig;
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
    return isset($_GET['token']) ? $_GET['token'] : '';
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

    // Also generate assets/css/cms-overrides.css from design tokens
    $c = $db['design']['colors'];
    $t = $db['design']['typography'];
    $l = $db['design']['layout'];
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
         . "html { font-size: var(--cms-base-font-size); }\n"
         . "body { font-family: var(--cms-font-body); line-height: var(--cms-line-height); color: var(--cms-text-main); background-color: var(--cms-surface); }\n"
         . "h1, h2, h3, h4, h5, h6 { font-family: var(--cms-font-heading); }\n"
         . ".font-cormorant, .font-serif { font-family: var(--cms-font-serif) !important; }\n"
         . ".bg-primary { background-color: var(--cms-primary) !important; }\n"
         . ".text-primary { color: var(--cms-primary) !important; }\n"
         . ".bg-secondary { background-color: var(--cms-secondary) !important; }\n"
         . ".text-secondary { color: var(--cms-secondary) !important; }\n"
         . ".bg-brand-emerald { background-color: var(--cms-emerald) !important; }\n"
         . ".bg-navy-dark, .bg-brand-navy { background-color: var(--cms-navy-dark) !important; }\n"
         . ($db['design']['customCss'] ?? '');
    @file_put_contents($rootDir . '/assets/css/cms-overrides.css', $css);
}

function updateHtmlFileOnDisk($rootDir, $page) {
    $fileName = basename($page['file']);
    $filePath = $rootDir . '/' . $fileName;
    if ($fileName === 'llms.html') {
        $html = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>" . htmlspecialchars($page['title']) . "</title>\n  <meta name=\"robots\" content=\"index, follow\">\n  <link rel=\"canonical\" href=\"https://drjahangirkabir.com/llms.txt\">\n</head>\n<body style=\"margin: 16px; font-family: monospace; font-size: 14px; line-height: 1.6; color: #000000; background-color: #ffffff; white-space: pre-wrap; word-wrap: break-word;\">" . $page['mainHtml'] . "</body>\n</html>";
        @file_put_contents($filePath, $html);
        return true;
    }

    if (!file_exists($filePath)) {
        // Create new page from index.html shell if creating a new page
        $templatePath = $rootDir . '/about.html';
        if (!file_exists($templatePath)) return false;
        $html = file_get_contents($templatePath);
    } else {
        $html = file_get_contents($filePath);
    }

    // Update <title>
    if (!empty($page['title'])) {
        $safeTitle = htmlspecialchars($page['title'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/<title>[\s\S]*?<\/title>/i', '<title>' . $safeTitle . '</title>', $html, 1);
        $html = preg_replace('/(<meta\s+property="og:title"\s+content=")[^"]*(")/i', '${1}' . $safeTitle . '${2}', $html, 1);
        $html = preg_replace('/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i', '${1}' . $safeTitle . '${2}', $html, 1);
    }

    // Update description
    if (isset($page['description'])) {
        $safeDesc = htmlspecialchars($page['description'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="description"\s+content=")[^"]*(")/i', '${1}' . $safeDesc . '${2}', $html, 1);
        $html = preg_replace('/(<meta\s+property="og:description"\s+content=")[^"]*(")/i', '${1}' . $safeDesc . '${2}', $html, 1);
        $html = preg_replace('/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i', '${1}' . $safeDesc . '${2}', $html, 1);
    }

    // Update keywords & focus keyword
    if (isset($page['keywords'])) {
        $safeKw = htmlspecialchars($page['keywords'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="keywords"\s+content=")[^"]*(")/i', '${1}' . $safeKw . '${2}', $html, 1);
    }
    if (isset($page['focusKw'])) {
        $safeFkw = htmlspecialchars($page['focusKw'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="rank_math_focus_keyword"\s+content=")[^"]*(")/i', '${1}' . $safeFkw . '${2}', $html, 1);
    }

    // Update canonical & robots
    if (!empty($page['canonical'])) {
        $safeCan = htmlspecialchars($page['canonical'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<link\s+rel="canonical"\s+href=")[^"]*(")/i', '${1}' . $safeCan . '${2}', $html, 1);
    }
    if (!empty($page['robots'])) {
        $safeRob = htmlspecialchars($page['robots'], ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/(<meta\s+name="robots"\s+content=")[^"]*(")/i', '${1}' . $safeRob . '${2}', $html, 1);
    }

    // Update JSON-LD
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

    // Update <main> inner HTML if provided
    if (!empty($page['mainHtml'])) {
        $html = preg_replace(
            '/(<main[^>]*>)[\s\S]*?(<\/main>)/i',
            '$1' . "\n" . $page['mainHtml'] . "\n  " . '$2',
            $html,
            1
        );
    }

    @file_put_contents($filePath, $html);
    return true;
}

$action = isset($_GET['action']) ? $_GET['action'] : 'ping';
$rawBody = file_get_contents('php://input');
$body = $rawBody ? json_decode($rawBody, true) : [];
if (!is_array($body)) $body = [];

$db = loadDb($dbPath);

if ($action === 'ping') {
    respond(['ok' => true, 'engine' => 'php', 'version' => $db['meta']['version']]);
}

if ($action === 'login') {
    $u = trim($body['username'] ?? '');
    $p = $body['password'] ?? '';
    $hash = hash('sha256', $p);
    foreach ($db['users'] as &$user) {
        if (($user['username'] === $u || $user['email'] === $u) && !empty($user['active'])) {
            if (hash_equals($user['passwordHash'], $hash)) {
                $user['lastLogin'] = date('c');
                $db['auditLog'][] = [
                    'id' => 'log-' . uniqid(),
                    'timestamp' => date('c'),
                    'actor' => $user['username'],
                    'action' => 'USER_LOGIN',
                    'details' => 'Successful authentication (' . $user['role'] . ')'
                ];
                saveDb($dbPath, $db);
                $token = makeToken($user['username'], $user['role'], $secretSalt);
                respond([
                    'ok' => true,
                    'token' => $token,
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
    respond(['ok' => false, 'error' => 'Invalid username or password.'], 401);
}

// Verify auth for all protected actions
$auth = verifyToken(getAuthToken(), $secretSalt);
if (!$auth) {
    respond(['ok' => false, 'error' => 'Unauthorized or expired session. Please sign in again.'], 401);
}

$actor = $auth['u'];
$role = $auth['r'];

if ($action === 'get_state') {
    // Strip password hashes before sending to client
    $safeDb = $db;
    foreach ($safeDb['users'] as &$u) {
        unset($u['passwordHash']);
    }
    respond(['ok' => true, 'db' => $safeDb, 'actor' => $actor, 'role' => $role]);
}

if ($action === 'save_page') {
    if (!hasPermission($db, $role, 'pages.write') && !hasPermission($db, $role, 'blogs.write') && !hasPermission($db, $role, 'seo.write')) {
        respond(['ok' => false, 'error' => 'Permission denied for saving page content.'], 403);
    }
    $file = basename($body['file'] ?? '');
    if (!$file || empty($db['pages'][$file])) {
        respond(['ok' => false, 'error' => 'Target page not found.'], 404);
    }
    $p = &$db['pages'][$file];
    $fields = ['title', 'h1', 'description', 'keywords', 'focusKw', 'canonical', 'robots', 'ogImage', 'aeoLead', 'jsonLd', 'mainHtml', 'status'];
    foreach ($fields as $f) {
        if (isset($body[$f])) $p[$f] = $body[$f];
    }
    $p['updatedAt'] = date('c');
    $p['updatedBy'] = $actor;

    // Push revision snapshot
    $rev = [
        'revId' => 'rev-' . time() . '-' . substr(md5(uniqid()), 0, 5),
        'timestamp' => date('c'),
        'author' => $actor,
        'note' => $body['revisionNote'] ?? (($body['publish'] ?? true) ? 'Published live to website' : 'Saved draft snapshot'),
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

    $db['auditLog'][] = [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => !empty($body['publish']) ? 'PAGE_PUBLISHED' : 'PAGE_DRAFT_SAVED',
        'details' => "Updated {$file} (" . ($rev['note']) . ")"
    ];
    saveDb($dbPath, $db);
    respond(['ok' => true, 'page' => $p]);
}

if ($action === 'create_page') {
    if (!hasPermission($db, $role, 'pages.write') && !hasPermission($db, $role, 'blogs.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to create pages.'], 403);
    }
    $slugRaw = preg_replace('/[^a-z0-9-]/', '-', strtolower(trim($body['slug'] ?? '')));
    $slugRaw = trim($slugRaw, '-');
    if (!$slugRaw) respond(['ok' => false, 'error' => 'Valid URL slug is required.'], 400);
    $file = $slugRaw . '.html';
    if (!empty($db['pages'][$file])) {
        respond(['ok' => false, 'error' => 'A page with this slug already exists.'], 400);
    }
    $newPage = [
        'id' => $slugRaw,
        'file' => $file,
        'slug' => '/' . $slugRaw,
        'type' => $body['type'] ?? 'page',
        'status' => $body['status'] ?? 'published',
        'title' => $body['title'] ?? 'নতুন পাতা — ডা. জাহাঙ্গীর কবির | জেকে লাইফস্টাইল',
        'h1' => $body['h1'] ?? ($body['title'] ?? 'নতুন পাতা'),
        'description' => $body['description'] ?? '',
        'keywords' => $body['keywords'] ?? '',
        'focusKw' => $body['focusKw'] ?? '',
        'canonical' => 'https://drjahangirkabir.com/' . $slugRaw,
        'robots' => 'index, follow',
        'ogImage' => 'https://drjahangirkabir.com/images/dr-hero.jpg',
        'aeoLead' => $body['aeoLead'] ?? '',
        'jsonLd' => '{}',
        'mainHtml' => $body['mainHtml'] ?? '<section class="py-16 max-w-5xl mx-auto px-4"><h1 class="text-3xl font-extrabold text-on-surface mb-4">' . htmlspecialchars($body['h1'] ?? 'নতুন পাতা') . '</h1><p class="aeo-lead-answer text-base text-on-surface-variant">' . htmlspecialchars($body['description'] ?? '') . '</p></section>',
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
    $db['auditLog'][] = [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'PAGE_CREATED',
        'details' => "Created {$file}"
    ];
    saveDb($dbPath, $db);
    respond(['ok' => true, 'page' => $newPage]);
}

if ($action === 'delete_page') {
    if (!hasPermission($db, $role, 'pages.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to delete pages.'], 403);
    }
    $file = basename($body['file'] ?? '');
    if ($file === 'index.html') {
        respond(['ok' => false, 'error' => 'Homepage (index.html) cannot be deleted.'], 400);
    }
    unset($db['pages'][$file]);
    $db['auditLog'][] = [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'PAGE_DELETED',
        'details' => "Removed {$file} from CMS"
    ];
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
    $db['auditLog'][] = [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'DESIGN_UPDATED',
        'details' => 'Published global colors, typography, and layout settings'
    ];
    saveDb($dbPath, $db);
    respond(['ok' => true, 'design' => $db['design']]);
}

if ($action === 'save_menus') {
    if (!hasPermission($db, $role, 'menus.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to modify menus.'], 403);
    }
    if (!empty($body['menus']) && is_array($body['menus'])) {
        $db['menus'] = $body['menus'];
    }
    if (!empty($body['meta']) && is_array($body['meta'])) {
        $db['meta'] = array_replace_recursive($db['meta'], $body['meta']);
    }
    writePublicState($rootDir, $db);
    $db['auditLog'][] = [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'MENUS_UPDATED',
        'details' => 'Updated header navigation, CTA buttons, and footer menus'
    ];
    saveDb($dbPath, $db);
    respond(['ok' => true, 'menus' => $db['menus'], 'meta' => $db['meta']]);
}

if ($action === 'save_seo_files') {
    if (!hasPermission($db, $role, 'seo.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to modify SEO/AEO files.'], 403);
    }
    if (isset($body['llmsTxt'])) {
        $db['seoFiles']['llmsTxt'] = $body['llmsTxt'];
        @file_put_contents($rootDir . '/llms.txt', $body['llmsTxt']);
    }
    if (isset($body['llmsFullTxt'])) {
        $db['seoFiles']['llmsFullTxt'] = $body['llmsFullTxt'];
        @file_put_contents($rootDir . '/llms-full.txt', $body['llmsFullTxt']);
        if (!empty($db['pages']['llms.html'])) {
            $db['pages']['llms.html']['mainHtml'] = htmlspecialchars($body['llmsFullTxt'], ENT_QUOTES, 'UTF-8');
            updateHtmlFileOnDisk($rootDir, $db['pages']['llms.html']);
        }
    }
    if (isset($body['sitemapXml'])) {
        $db['seoFiles']['sitemapXml'] = $body['sitemapXml'];
        @file_put_contents($rootDir . '/sitemap.xml', $body['sitemapXml']);
    }
    if (isset($body['robotsTxt'])) {
        $db['seoFiles']['robotsTxt'] = $body['robotsTxt'];
        @file_put_contents($rootDir . '/robots.txt', $body['robotsTxt']);
    }
    $db['auditLog'][] = [
        'id' => 'log-' . uniqid(),
        'timestamp' => date('c'),
        'actor' => $actor,
        'action' => 'SEO_FILES_PUBLISHED',
        'details' => 'Updated llms.txt, llms-full.txt, sitemap.xml, and robots.txt'
    ];
    saveDb($dbPath, $db);
    respond(['ok' => true, 'seoFiles' => $db['seoFiles']]);
}

if ($action === 'upload_media') {
    if (!hasPermission($db, $role, 'media.write')) {
        respond(['ok' => false, 'error' => 'Permission denied to upload media.'], 403);
    }
    $name = preg_replace('/[^a-zA-Z0-9._-]/', '-', basename($body['fileName'] ?? $body['name'] ?? 'upload.png'));
    if (!preg_match('/\.(png|jpe?g|webp|svg|gif)$/i', $name)) {
        respond(['ok' => false, 'error' => 'Only image files (PNG, JPG, WEBP, SVG, GIF) are allowed.'], 400);
    }
    $dataUrl = $body['dataUrl'] ?? '';
    if (preg_match('/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/', $dataUrl, $m)) {
        $binary = base64_decode($m[1]);
        $dest = $rootDir . '/images/' . $name;
        @file_put_contents($dest, $binary);
        $item = [
            'id' => 'media-' . uniqid(),
            'name' => $name,
            'path' => 'images/' . $name,
            'url' => 'images/' . $name,
            'sizeBytes' => strlen($binary),
            'sizeFormatted' => round(strlen($binary) / 1024, 1) . ' KB',
            'alt' => $body['alt'] ?? ('ডা. মুহাম্মদ জাহাঙ্গীর কবির — ' . $name),
            'category' => $body['category'] ?? 'Uploaded Media',
            'uploadedAt' => date('c')
        ];
        array_unshift($db['media'], $item);
        $db['auditLog'][] = [
            'id' => 'log-' . uniqid(),
            'timestamp' => date('c'),
            'actor' => $actor,
            'action' => 'MEDIA_UPLOADED',
            'details' => "Uploaded image images/{$name}"
        ];
        saveDb($dbPath, $db);
        respond(['ok' => true, 'mediaItem' => $item]);
    }
    respond(['ok' => false, 'error' => 'Invalid base64 image payload.'], 400);
}

if ($action === 'save_admin_prefs') {
    if (!empty($body['adminPrefs']) && is_array($body['adminPrefs'])) {
        $db['adminPrefs'] = array_replace_recursive($db['adminPrefs'], $body['adminPrefs']);
    }
    saveDb($dbPath, $db);
    respond(['ok' => true, 'adminPrefs' => $db['adminPrefs']]);
}

if ($action === 'save_users') {
    if ($role !== 'super_admin') {
        respond(['ok' => false, 'error' => 'Only Super Administrators can manage users and roles.'], 403);
    }
    if (!empty($body['newUser']) && is_array($body['newUser'])) {
        $nu = $body['newUser'];
        $db['users'][] = [
            'id' => 'usr-' . uniqid(),
            'username' => trim($nu['username']),
            'email' => trim($nu['email']),
            'name' => trim($nu['name']),
            'role' => $nu['role'] ?? 'editor',
            'passwordHash' => hash('sha256', $nu['password'] ?? 'JKPass@2026'),
            'active' => true,
            'lastLogin' => 'Never'
        ];
    }
    if (!empty($body['roles']) && is_array($body['roles'])) {
        $db['roles'] = $body['roles'];
    }
    saveDb($dbPath, $db);
    respond(['ok' => true]);
}

respond(['ok' => false, 'error' => 'Unknown API action: ' . $action], 400);
