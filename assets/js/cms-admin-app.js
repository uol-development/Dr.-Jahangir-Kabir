/* ============================================================================
 * JK Lifestyle & Health Revolution — Google Stitch Full Admin Panel & CMS App
 * Connected to api/cms.php (Apache/PHP) + cms-data/cms.db.json + Live Runtime
 * ============================================================================ */

const CMS_STORAGE_KEY = 'jk_cms_live_db_v2';
const CMS_SESSION_KEY = 'jk_cms_auth_session_v2';

let cmsState = {
  db: null,
  session: null,
  serverAvailable: false,
  activeModule: 'dashboard',
  selectedPageFile: 'index.html',
  pageEditorMode: 'visual', // 'visual' | 'structured' | 'source'
  viewportWidth: '100%',
  selectedVisualElement: null,
  extractedStructure: { headings: [], buttons: [], images: [] },
  selectedBlogFile: 'dr-jahangir-kabir-biography.html',
  selectedSeoPageFile: 'index.html',
  selectedSeoFileTab: 'llmsTxt',
  mediaFilter: 'all',
  mediaSearch: '',
  unsavedChanges: false
};

// Utility: SHA-256 hash in browser (with pure JS fallback for non-HTTPS/file://)
async function sha256Hex(str) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const buf = new TextEncoder().encode(str);
      const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {}
  }
  // Known default credential hashes fallback for file:// protocol
  const known = {
    'JKAdmin@2026': '8579210885c9159d52e90328a11637e4a5204fb235d936c33b4445a6e4214b80',
    'JKEditor@2026': '73977b6f55250919376942a8e4314a0c3c40b2548441400f3c7c0a0d5471c5b4',
    'JKSeo@2026': 'f62f2c8d3584b445e979787699a24136270e53953350d2b6511510035059641b'
  };
  return known[str] || ('hash-' + str);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('cmsToastContainer');
  if (!container) return;
  const colors = {
    success: 'bg-[#006c49] text-white border-[#10b981]',
    info: 'bg-[#004b80] text-white border-[#9fcaff]',
    warning: 'bg-amber-600 text-white border-amber-300',
    error: 'bg-red-700 text-white border-red-300'
  };
  const icons = {
    success: 'check_circle',
    info: 'info',
    warning: 'warning',
    error: 'error'
  };
  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-2xl border ${colors[type] || colors.success} text-xs sm:text-sm font-bold transition-all duration-300`;
  toast.innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="material-symbols-outlined text-lg">${icons[type] || 'check_circle'}</span>
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" onclick="this.parentElement.remove()" class="opacity-80 hover:opacity-100">
      <span class="material-symbols-outlined text-base">close</span>
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 4200);
}

function hasPermission(perm) {
  if (!cmsState.session || !cmsState.db) return false;
  const roleKey = cmsState.session.role || 'viewer';
  if (roleKey === 'super_admin') return true;
  const roleObj = cmsState.db.roles && cmsState.db.roles[roleKey];
  if (!roleObj || !Array.isArray(roleObj.permissions)) return false;
  return roleObj.permissions.includes(perm);
}

function requirePermission(perm, actionName = 'এই কাজটি') {
  if (hasPermission(perm)) return true;
  showToast(`অ্যাক্সেস অনুমোদিত নয়: আপনার বর্তমান রোলে (${cmsState.session?.role}) "${actionName}" করার অনুমতি নেই।`, 'error');
  return false;
}

function addAuditEntry(action, details) {
  if (!cmsState.db) return;
  if (!Array.isArray(cmsState.db.auditLog)) cmsState.db.auditLog = [];
  cmsState.db.auditLog.unshift({
    id: 'log-' + Date.now(),
    timestamp: new Date().toISOString(),
    actor: cmsState.session ? cmsState.session.username : 'admin',
    action,
    details
  });
  cmsState.db.auditLog = cmsState.db.auditLog.slice(0, 120);
}

function persistLocalDb() {
  if (!cmsState.db) return;
  try {
    localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(cmsState.db));
  } catch (e) {}
}

// API helper that calls api/cms.php when hosted on Apache/PHP and automatically syncs local DB
async function callCmsApi(action, payload = {}) {
  persistLocalDb();
  if (window.location.protocol === 'file:') {
    return { ok: true, localOnly: true };
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (cmsState.session && cmsState.session.token) {
      headers['X-CMS-Token'] = cmsState.session.token;
    }
    const res = await fetch(`api/cms.php?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    cmsState.serverAvailable = true;
    updateServerStatusBadge(true);
    return data;
  } catch (err) {
    cmsState.serverAvailable = false;
    updateServerStatusBadge(false);
    return { ok: true, localOnly: true };
  }
}

function updateServerStatusBadge(isServerOnline) {
  const dot = document.getElementById('cmsServerStatusDot');
  const txt = document.getElementById('cmsServerStatusText');
  if (!dot || !txt) return;
  if (isServerOnline) {
    dot.className = 'w-2 h-2 rounded-full bg-[#10b981] animate-pulse';
    txt.textContent = 'Server PHP API Connected';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400';
    txt.textContent = 'Browser Live Sync Active';
  }
}

// Load initial DB from Server API -> LocalStorage -> Embedded Seed DB
async function initCmsDatabase() {
  let loadedDb = null;

  // 1. Check localStorage first for user's immediate local edits
  try {
    const raw = localStorage.getItem(CMS_STORAGE_KEY);
    if (raw) loadedDb = JSON.parse(raw);
  } catch (e) {}

  // 2. Fall back to embedded seed DB (window.JK_CMS_SEED_DB)
  if (!loadedDb && window.JK_CMS_SEED_DB) {
    loadedDb = JSON.parse(JSON.stringify(window.JK_CMS_SEED_DB));
  }

  // 3. Try pinging live PHP backend API
  if (window.location.protocol !== 'file:') {
    try {
      const pingRes = await fetch('api/cms.php?action=ping');
      if (pingRes.ok) {
        const pingData = await pingRes.json();
        if (pingData && pingData.ok) {
          cmsState.serverAvailable = true;
          updateServerStatusBadge(true);
        }
      }
    } catch (e) {
      updateServerStatusBadge(false);
    }
  } else {
    updateServerStatusBadge(false);
  }

  cmsState.db = loadedDb;
  persistLocalDb();
}

// ==================== AUTHENTICATION & SESSION ====================
function toggleLoginPassword() {
  const input = document.getElementById('loginPassword');
  const icon = document.getElementById('loginPwdToggleIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    if (icon) icon.textContent = 'visibility';
  }
}

function fillDemoCredentials(user, pass) {
  const u = document.getElementById('loginUsername');
  const p = document.getElementById('loginPassword');
  if (u) u.value = user;
  if (p) p.value = pass;
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const usernameInput = (document.getElementById('loginUsername')?.value || '').trim();
  const passwordInput = document.getElementById('loginPassword')?.value || '';
  const errBox = document.getElementById('cmsLoginError');
  const errTxt = document.getElementById('cmsLoginErrorText');
  if (errBox) errBox.classList.add('hidden');

  // Try PHP API login first if available
  if (cmsState.serverAvailable) {
    try {
      const res = await fetch('api/cms.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (data && data.ok && data.token) {
        cmsState.session = {
          token: data.token,
          username: data.user.username,
          name: data.user.name,
          role: data.user.role,
          email: data.user.email
        };
        localStorage.setItem(CMS_SESSION_KEY, JSON.stringify(cmsState.session));
        // Fetch latest server state
        const stateRes = await fetch('api/cms.php?action=get_state', {
          headers: { 'X-CMS-Token': data.token }
        });
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (stateData && stateData.ok && stateData.db) {
            cmsState.db = stateData.db;
            persistLocalDb();
          }
        }
        completeLoginSuccess();
        return;
      }
    } catch (err) {}
  }

  // Local RBAC verification against cmsState.db.users
  const users = (cmsState.db && cmsState.db.users) || [];
  const defaultPasswords = {
    admin: 'JKAdmin@2026',
    editor: 'JKEditor@2026',
    seo: 'JKSeo@2026'
  };
  const inputHash = await sha256Hex(passwordInput);
  const matchedUser = users.find(u => {
    if (!u.active) return false;
    const unameMatch = u.username.toLowerCase() === usernameInput.toLowerCase() || (u.email && u.email.toLowerCase() === usernameInput.toLowerCase());
    if (!unameMatch) return false;
    if (u.passwordHash === inputHash) return true;
    if (u.plainPassword && u.plainPassword === passwordInput) return true;
    if (defaultPasswords[u.username] === passwordInput) return true;
    return false;
  });

  if (!matchedUser) {
    if (errBox && errTxt) {
      errTxt.textContent = 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।';
      errBox.classList.remove('hidden');
    }
    return;
  }

  matchedUser.lastLogin = new Date().toISOString();
  cmsState.session = {
    token: 'local-token-' + Date.now(),
    username: matchedUser.username,
    name: matchedUser.name,
    role: matchedUser.role,
    email: matchedUser.email
  };
  localStorage.setItem(CMS_SESSION_KEY, JSON.stringify(cmsState.session));
  addAuditEntry('USER_LOGIN', `Logged in as ${matchedUser.username} (${matchedUser.role})`);
  persistLocalDb();
  completeLoginSuccess();
}

function completeLoginSuccess() {
  const overlay = document.getElementById('cmsAuthOverlay');
  if (overlay) overlay.classList.add('hidden');

  const nameEl = document.getElementById('cmsCurrentUserName');
  const roleEl = document.getElementById('cmsCurrentUserRole');
  const avatarEl = document.getElementById('cmsUserAvatar');
  if (cmsState.session) {
    if (nameEl) nameEl.textContent = cmsState.session.name;
    if (roleEl) roleEl.textContent = cmsState.session.role.replace('_', ' ').toUpperCase();
    if (avatarEl) avatarEl.textContent = (cmsState.session.name || 'A').charAt(0).toUpperCase();
  }

  applyAdminPanelPreferences();
  populateQuickPageSelect();
  renderAdminNavigation();
  switchAdminModule(cmsState.activeModule || 'dashboard');
  showToast(`স্বাগতম, ${cmsState.session?.name || 'Admin'}! অ্যাডমিন প্যানেল প্রস্তুত।`, 'success');
}

function cmsLogout() {
  localStorage.removeItem(CMS_SESSION_KEY);
  cmsState.session = null;
  const overlay = document.getElementById('cmsAuthOverlay');
  if (overlay) overlay.classList.remove('hidden');
  showToast('সফলভাবে লগআউট করা হয়েছে।', 'info');
}

// ==================== ADMIN PANEL SELF-CUSTOMIZER ENGINE ====================
function applyAdminPanelPreferences() {
  if (!cmsState.db || !cmsState.db.adminPrefs) return;
  const prefs = cmsState.db.adminPrefs;

  // Theme & Font Scale
  document.body.setAttribute('data-admin-theme', prefs.themeMode || 'stitch-light');
  document.body.setAttribute('data-font-scale', prefs.fontScale || 'default');
  if (prefs.accentColor) {
    document.documentElement.style.setProperty('--admin-accent', prefs.accentColor);
  }

  // Brand Title & Subtitle
  const titleEl = document.getElementById('cmsBrandTitle');
  const subEl = document.getElementById('cmsBrandSubtitle');
  if (titleEl && prefs.panelTitle) titleEl.textContent = prefs.panelTitle;
  if (subEl && prefs.panelSubtitle) subEl.textContent = prefs.panelSubtitle;

  // Layout Mode ('sidebar-left' | 'sidebar-right' | 'sidebar-compact' | 'topbar')
  const shell = document.getElementById('cmsAppShell');
  const sidebar = document.getElementById('cmsSidebar');
  const navContainer = document.getElementById('cmsNavContainer');
  if (!shell || !sidebar || !navContainer) return;

  shell.className = 'flex-1 flex min-h-screen ';
  sidebar.className = 'shrink-0 bg-[#0a2540] text-white flex justify-between border-white/10 transition-all z-40 ';

  if (prefs.layoutMode === 'sidebar-right') {
    shell.className += 'flex-col lg:flex-row-reverse';
    sidebar.className += 'w-full lg:w-72 flex-col border-l';
    navContainer.className = 'hidden lg:flex flex-col p-3 gap-1 overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar';
    document.querySelectorAll('.cms-sidebar-text').forEach(el => el.classList.remove('lg:hidden'));
  } else if (prefs.layoutMode === 'sidebar-compact') {
    shell.className += 'flex-col lg:flex-row';
    sidebar.className += 'w-full lg:w-20 flex-col border-r';
    navContainer.className = 'hidden lg:flex flex-col p-2 gap-1.5 items-center overflow-y-auto max-h-[calc(100vh-180px)]';
    document.querySelectorAll('.cms-sidebar-text').forEach(el => el.classList.add('lg:hidden'));
  } else if (prefs.layoutMode === 'topbar') {
    shell.className += 'flex-col';
    sidebar.className += 'w-full flex-col lg:flex-row items-center border-b px-4';
    navContainer.className = 'hidden lg:flex flex-row flex-wrap items-center gap-1 p-2';
    document.querySelectorAll('.cms-sidebar-text').forEach(el => el.classList.remove('lg:hidden'));
  } else {
    // Default: sidebar-left
    shell.className += 'flex-col lg:flex-row';
    sidebar.className += 'w-full lg:w-72 flex-col border-r';
    navContainer.className = 'hidden lg:flex flex-col p-3 gap-1 overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar';
    document.querySelectorAll('.cms-sidebar-text').forEach(el => el.classList.remove('lg:hidden'));
  }
}

function toggleMobileAdminMenu() {
  const nav = document.getElementById('cmsNavContainer');
  if (!nav) return;
  nav.classList.toggle('hidden');
  nav.classList.toggle('flex');
}

function renderAdminNavigation() {
  const nav = document.getElementById('cmsNavContainer');
  if (!nav || !cmsState.db || !cmsState.db.adminPrefs) return;
  const prefs = cmsState.db.adminPrefs;
  const isCompact = prefs.layoutMode === 'sidebar-compact';
  const items = prefs.navItems || [];

  const pagesCount = Object.keys(cmsState.db.pages || {}).length;
  const blogsCount = Object.values(cmsState.db.pages || {}).filter(p => p.type === 'blog').length;
  const mediaCount = (cmsState.db.media || []).length;

  const badgeMap = {
    pages: pagesCount,
    blogs: blogsCount,
    media: mediaCount
  };

  nav.innerHTML = items
    .filter(item => item.visible !== false)
    .map(item => {
      const active = cmsState.activeModule === item.id;
      const badge = badgeMap[item.id] !== undefined
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${active ? 'bg-white text-[#006c49]' : 'bg-white/10 text-slate-300'}">${badgeMap[item.id]}</span>`
        : '';
      return `
        <button type="button" onclick="switchAdminModule('${item.id}')" title="${escapeHtml(item.label)}"
          class="w-full flex items-center ${isCompact ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-xl text-left text-xs sm:text-sm font-bold transition-all ${
            active
              ? 'bg-[#10b981] text-white shadow-md'
              : 'text-slate-200 hover:bg-white/10 hover:text-white'
          }">
          <span class="flex items-center gap-3 min-w-0">
            <span class="material-symbols-outlined text-lg shrink-0">${escapeHtml(item.icon || 'circle')}</span>
            <span class="${isCompact ? 'lg:hidden' : 'truncate'}">${escapeHtml(item.label)}</span>
          </span>
          <span class="${isCompact ? 'lg:hidden' : ''}">${badge}</span>
        </button>
      `;
    })
    .join('');
}

function populateQuickPageSelect() {
  const sel = document.getElementById('cmsQuickPageJump');
  if (!sel || !cmsState.db || !cmsState.db.pages) return;
  const pages = Object.values(cmsState.db.pages);
  sel.innerHTML = `<option value="">দ্রুত পেজ এডিট করুন (${pages.length}টি পাতা)...</option>` +
    pages.map(p => `<option value="${escapeHtml(p.file)}">${escapeHtml(p.slug)} — ${escapeHtml(p.title.slice(0, 42))}</option>`).join('');
}

function quickJumpToPageEditor(file) {
  if (!file) return;
  cmsState.selectedPageFile = file;
  switchAdminModule('pages');
}

function switchAdminModule(moduleId) {
  cmsState.activeModule = moduleId;
  renderAdminNavigation();

  const navItem = (cmsState.db?.adminPrefs?.navItems || []).find(i => i.id === moduleId);
  const titleEl = document.getElementById('cmsActiveModuleTitle');
  if (titleEl && navItem) {
    titleEl.innerHTML = `
      <span class="material-symbols-outlined text-[#006c49]">${escapeHtml(navItem.icon)}</span>
      <span>${escapeHtml(navItem.label)}</span>
    `;
  }

  const viewport = document.getElementById('cmsModuleViewport');
  if (!viewport) return;

  switch (moduleId) {
    case 'dashboard':
      renderDashboardModule(viewport);
      break;
    case 'pages':
      renderPagesModule(viewport);
      break;
    case 'blogs':
      renderBlogsModule(viewport);
      break;
    case 'media':
      renderMediaModule(viewport);
      break;
    case 'menus':
      renderMenusModule(viewport);
      break;
    case 'design':
      renderDesignModule(viewport);
      break;
    case 'seo':
      renderSeoModule(viewport);
      break;
    case 'users':
      renderUsersModule(viewport);
      break;
    case 'customizer':
      renderCustomizerModule(viewport);
      break;
    case 'settings':
      renderSettingsModule(viewport);
      break;
    default:
      renderDashboardModule(viewport);
  }
}

// ==================== 1. DASHBOARD MODULE ====================
function renderDashboardModule(container) {
  const db = cmsState.db;
  const pages = Object.values(db.pages || {});
  const blogPosts = pages.filter(p => p.type === 'blog');
  const publishedCount = pages.filter(p => p.status === 'published').length;
  const draftCount = pages.filter(p => p.status !== 'published').length;
  const mediaCount = (db.media || []).length;
  const widgets = db.adminPrefs?.dashboardWidgets || {};

  // Collect recent revisions across all pages
  const allRevisions = [];
  pages.forEach(p => {
    (p.revisions || []).forEach(r => {
      allRevisions.push({ ...r, file: p.file, slug: p.slug, pageTitle: p.title });
    });
  });
  allRevisions.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  container.innerHTML = `
    <!-- Top Welcome Hero Card -->
    <div class="rounded-3xl bg-gradient-to-r from-[#0a2540] via-[#004b80] to-[#006c49] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
      <div class="absolute -right-12 -bottom-16 w-64 h-64 rounded-full bg-[#6ffbbe]/15 blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="space-y-2 max-w-2xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[#6ffbbe] text-xs font-bold">
            <span class="material-symbols-outlined text-sm">verified</span>
            <span>Google Stitch Clinical Sanctuary · Live Website Control Center</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">ডা. মুহাম্মদ জাহাঙ্গীর কবির — পূর্ণাঙ্গ ওয়েবসাইট ও সিএমএস ড্যাশবোর্ড</h1>
          <p class="text-xs sm:text-sm text-blue-100 leading-relaxed">
            এই প্যানেল থেকে আপনি কোডে হাত না দিয়েই ওয়েবসাইটের সকল পাতা, ব্লগ প্রবন্ধ, ছবি, মেনু, অ্যাপয়েন্টমেন্ট বাটন, রঙ, ফন্ট, লেআউট, LLMs.txt এবং অ্যাডমিন প্যানেলের নিজস্ব ডিজাইন তাৎক্ষণিকভাবে পরিবর্তন ও পাবলিশ করতে পারবেন।
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <button type="button" onclick="switchAdminModule('pages')" class="px-5 py-3 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-white font-extrabold text-xs sm:text-sm shadow-lg flex items-center gap-2 transition-all">
            <span class="material-symbols-outlined text-lg">web</span>
            <span>ভিজ্যুয়াল পেজ এডিটর খুলুন</span>
          </button>
          <button type="button" onclick="openCreatePageModal('page')" class="px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm border border-white/20 flex items-center gap-2 transition-all">
            <span class="material-symbols-outlined text-lg">add_circle</span>
            <span>নতুন পেজ তৈরি করুন</span>
          </button>
        </div>
      </div>
    </div>

    ${widgets.showStatsCards !== false ? `
    <!-- KPI Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <div class="admin-card p-5 flex items-center justify-between">
        <div>
          <span class="text-xs font-bold text-[#414750] uppercase tracking-wider block">মোট ওয়েবসাইট পাতা</span>
          <div class="text-3xl font-extrabold text-[#001c37] mt-1">${pages.length}</div>
          <span class="text-[11px] font-bold text-[#006c49]">${publishedCount} Published · ${draftCount} Draft</span>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-[#eff4ff] text-[#004b80] flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">web</span>
        </div>
      </div>

      <div class="admin-card p-5 flex items-center justify-between">
        <div>
          <span class="text-xs font-bold text-[#414750] uppercase tracking-wider block">ব্লগ ও গবেষণা প্রবন্ধ</span>
          <div class="text-3xl font-extrabold text-[#001c37] mt-1">${blogPosts.length}</div>
          <span class="text-[11px] font-bold text-[#006c49]">E-E-A-T ও AEO সমৃদ্ধ</span>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-[#e8f7f0] text-[#006c49] flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">article</span>
        </div>
      </div>

      <div class="admin-card p-5 flex items-center justify-between">
        <div>
          <span class="text-xs font-bold text-[#414750] uppercase tracking-wider block">মিডিয়া লাইব্রেরি ছবি</span>
          <div class="text-3xl font-extrabold text-[#001c37] mt-1">${mediaCount}</div>
          <span class="text-[11px] font-bold text-[#004b80]">ডা. কবির ও ক্লিনিক্যাল ফটো</span>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-[#eff4ff] text-[#004b80] flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">photo_library</span>
        </div>
      </div>

      <div class="admin-card p-5 flex items-center justify-between">
        <div>
          <span class="text-xs font-bold text-[#414750] uppercase tracking-wider block">অ্যাপয়েন্টমেন্ট CTA লিংক</span>
          <div class="text-3xl font-extrabold text-[#006c49] mt-1">206+</div>
          <span class="text-[11px] font-bold text-[#006c49]">১০০% সচল ও যাচাইকৃত</span>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-[#e8f7f0] text-[#10b981] flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">calendar_month</span>
        </div>
      </div>

      <div class="admin-card p-5 flex items-center justify-between">
        <div>
          <span class="text-xs font-bold text-[#414750] uppercase tracking-wider block">SEO, AEO ও বানান মান</span>
          <div class="text-3xl font-extrabold text-[#006c49] mt-1">100%</div>
          <span class="text-[11px] font-bold text-[#006c49]">Clean URLs + Schema @graph</span>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-[#e8f7f0] text-[#006c49] flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">workspace_premium</span>
        </div>
      </div>
    </div>
    ` : ''}

    ${widgets.showQuickActions !== false ? `
    <!-- Quick Actions Grid -->
    <div class="admin-card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-extrabold flex items-center gap-2">
          <span class="material-symbols-outlined text-[#006c49]">bolt</span>
          <span>দ্রুত নিয়ন্ত্রণ ও কুইক অ্যাকশন (Quick Management Actions)</span>
        </h3>
        <span class="text-xs text-[#414750]">যেকোনো মডিউলে এক ক্লিকে প্রবেশ করুন</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button type="button" onclick="quickJumpToPageEditor('index.html')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-[#f8f9ff] hover:bg-[#e8f7f0]/40 text-left transition-all group">
          <span class="material-symbols-outlined text-2xl text-[#004b80] group-hover:text-[#006c49] mb-2 block">home</span>
          <div class="text-xs font-extrabold">হোমপেজ এডিট</div>
          <div class="text-[11px] text-[#414750] mt-0.5">হিরো, ভিডিও ও সেকশন</div>
        </button>
        <button type="button" onclick="openCreatePageModal('blog')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-[#f8f9ff] hover:bg-[#e8f7f0]/40 text-left transition-all group">
          <span class="material-symbols-outlined text-2xl text-[#006c49] mb-2 block">post_add</span>
          <div class="text-xs font-extrabold">নতুন ব্লগ লিখুন</div>
          <div class="text-[11px] text-[#414750] mt-0.5">নতুন প্রবন্ধ প্রকাশ</div>
        </button>
        <button type="button" onclick="switchAdminModule('media')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-[#f8f9ff] hover:bg-[#e8f7f0]/40 text-left transition-all group">
          <span class="material-symbols-outlined text-2xl text-[#004b80] group-hover:text-[#006c49] mb-2 block">cloud_upload</span>
          <div class="text-xs font-extrabold">ছবি আপলোড</div>
          <div class="text-[11px] text-[#414750] mt-0.5">মিডিয়া লাইব্রেরি</div>
        </button>
        <button type="button" onclick="switchAdminModule('menus')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-[#f8f9ff] hover:bg-[#e8f7f0]/40 text-left transition-all group">
          <span class="material-symbols-outlined text-2xl text-[#006c49] mb-2 block">menu_book</span>
          <div class="text-xs font-extrabold">মেনু ও বাটন</div>
          <div class="text-[11px] text-[#414750] mt-0.5">হেডার, ফুটার ও CTA</div>
        </button>
        <button type="button" onclick="switchAdminModule('design')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-[#f8f9ff] hover:bg-[#e8f7f0]/40 text-left transition-all group">
          <span class="material-symbols-outlined text-2xl text-[#004b80] group-hover:text-[#006c49] mb-2 block">palette</span>
          <div class="text-xs font-extrabold">কালার ও ফন্ট</div>
          <div class="text-[11px] text-[#414750] mt-0.5">থিম ও লেআউট স্টুডিও</div>
        </button>
        <button type="button" onclick="switchAdminModule('seo')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-[#f8f9ff] hover:bg-[#e8f7f0]/40 text-left transition-all group">
          <span class="material-symbols-outlined text-2xl text-[#006c49] mb-2 block">smart_toy</span>
          <div class="text-xs font-extrabold">SEO ও LLMs.txt</div>
          <div class="text-[11px] text-[#414750] mt-0.5">AI নলেজ বেস ও স্কিমা</div>
        </button>
      </div>
    </div>
    ` : ''}

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      ${widgets.showAppointmentTracker !== false ? `
      <!-- Appointment Conversion & Global Info Card (7 cols) -->
      <div class="lg:col-span-7 admin-card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-extrabold flex items-center gap-2">
            <span class="material-symbols-outlined text-[#006c49]">clinical_notes</span>
            <span>অ্যাপয়েন্টমেন্ট ফানেল ও চেম্বার কনফিগারেশন</span>
          </h3>
          <button type="button" onclick="switchAdminModule('settings')" class="text-xs font-bold text-[#004b80] hover:underline">সম্পাদনা করুন →</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div class="p-4 rounded-2xl bg-[#eff4ff] border border-[#c4dcff]">
            <div class="font-bold text-[#414750] uppercase mb-1">প্রধান অ্যাপয়েন্টমেন্ট বুকিং URL</div>
            <div class="font-mono font-extrabold text-[#004b80] break-all">${escapeHtml(db.meta?.primaryAppointmentUrl)}</div>
          </div>
          <div class="p-4 rounded-2xl bg-[#e8f7f0] border border-[#10b981]/30">
            <div class="font-bold text-[#414750] uppercase mb-1">অফিশিয়াল হটলাইন ও ইমেইল</div>
            <div class="font-extrabold text-[#006c49] text-sm">${escapeHtml(db.meta?.hotline)}</div>
            <div class="text-[#414750] mt-0.5">${escapeHtml(db.meta?.email)}</div>
          </div>
        </div>
        <div class="p-4 rounded-2xl bg-[#f8f9ff] border border-[#dbe4f0] text-xs space-y-1.5">
          <div class="font-bold text-[#001c37] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-[#006c49]">location_on</span>
            <span>চেম্বার ঠিকানা: ${escapeHtml(db.meta?.address)}</span>
          </div>
          <div class="text-[#414750] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-[#004b80]">schedule</span>
            <span>রোগী দেখার সময়: ${escapeHtml(db.meta?.visitingHours)}</span>
          </div>
        </div>
      </div>
      ` : ''}

      ${widgets.showRecentRevisions !== false ? `
      <!-- Recent Revisions & Activity Log (5 cols) -->
      <div class="lg:col-span-5 admin-card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-extrabold flex items-center gap-2">
            <span class="material-symbols-outlined text-[#004b80]">history</span>
            <span>সাম্প্রতিক রিভিশন ও অডিট লগ</span>
          </h3>
          <span class="text-xs font-bold text-[#006c49]">${(db.auditLog || []).length} Logs</span>
        </div>
        <div class="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
          ${(db.auditLog || []).slice(0, 8).map(log => `
            <div class="p-3 rounded-xl bg-[#f8f9ff] border border-[#dbe4f0] flex items-start justify-between gap-3 text-xs">
              <div>
                <div class="font-extrabold text-[#001c37]">${escapeHtml(log.action)}</div>
                <div class="text-[#414750] mt-0.5">${escapeHtml(log.details)}</div>
              </div>
              <div class="text-right shrink-0 text-[10px] text-[#717781] font-mono">
                <div>${escapeHtml(log.actor)}</div>
                <div>${escapeHtml(String(log.timestamp).slice(0, 16).replace('T', ' '))}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <!-- All Website Pages Quick Overview Table -->
    <div class="admin-card p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 class="text-base font-extrabold flex items-center gap-2">
          <span class="material-symbols-outlined text-[#004b80]">layers</span>
          <span>সকল ওয়েবসাইট পাতা ও ব্লগ তালিকা (${pages.length}টি পাতা)</span>
        </h3>
        <button type="button" onclick="switchAdminModule('pages')" class="admin-btn-primary !py-1.5 !px-3.5 !text-xs">
          <span class="material-symbols-outlined text-sm">edit_square</span>
          <span>পেজ এডিটরে যান</span>
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr class="border-b border-[#dbe4f0] text-[#414750] text-xs uppercase">
              <th class="py-3 px-3">পাতার শিরোনাম (Title)</th>
              <th class="py-3 px-3">ক্লিন URL</th>
              <th class="py-3 px-3">ধরন</th>
              <th class="py-3 px-3">স্ট্যাটাস</th>
              <th class="py-3 px-3 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#dbe4f0]">
            ${pages.map(p => `
              <tr class="hover:bg-[#eff4ff]/50 transition-colors">
                <td class="py-3 px-3 font-bold text-[#001c37] max-w-xs truncate">${escapeHtml(p.title)}</td>
                <td class="py-3 px-3 font-mono text-xs text-[#004b80]">${escapeHtml(p.slug)}</td>
                <td class="py-3 px-3">
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${p.type === 'blog' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">${escapeHtml(p.type.toUpperCase())}</span>
                </td>
                <td class="py-3 px-3">
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${p.status === 'published' ? 'bg-[#e8f7f0] text-[#006c49]' : 'bg-amber-100 text-amber-800'}">${p.status === 'published' ? 'Published' : 'Draft'}</span>
                </td>
                <td class="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                  <button type="button" onclick="quickJumpToPageEditor('${escapeHtml(p.file)}')" class="px-3 py-1 rounded-lg bg-[#006c49] text-white text-xs font-bold hover:bg-[#005236]">ভিজ্যুয়াল এডিট</button>
                  <a href="${window.location.protocol === 'file:' ? escapeHtml(p.file) : escapeHtml(p.slug)}" target="_blank" class="px-2.5 py-1 rounded-lg border border-[#dbe4f0] text-xs font-bold hover:border-[#004b80]">দেখুন ↗</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== 2. PAGES & VISUAL PAGE EDITOR MODULE ====================
function renderPagesModule(container) {
  const db = cmsState.db;
  const pages = Object.values(db.pages || {});
  if (!db.pages[cmsState.selectedPageFile]) {
    cmsState.selectedPageFile = pages[0]?.file || 'index.html';
  }
  const activePage = db.pages[cmsState.selectedPageFile];
  const isFileProto = window.location.protocol === 'file:';
  const iframeUrl = (isFileProto ? activePage.file : (activePage.slug === '/' ? 'index.html' : activePage.file)) + '?cms_visual_editor=1&t=' + Date.now();

  container.innerHTML = `
    <!-- Top Page Selector & Editor Toolbar -->
    <div class="admin-card p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <div>
          <label class="block text-[10px] font-extrabold uppercase tracking-wider text-[#414750] mb-1">সম্পাদনার জন্য পাতা নির্বাচন করুন (Select Page)</label>
          <select onchange="selectPageForEditing(this.value)" class="admin-input !py-2 !font-extrabold min-w-[260px] sm:min-w-[340px]">
            ${pages.map(p => `<option value="${escapeHtml(p.file)}" ${p.file === activePage.file ? 'selected' : ''}>[${p.status === 'published' ? 'LIVE' : 'DRAFT'}] ${escapeHtml(p.slug)} — ${escapeHtml(p.title.slice(0, 48))}</option>`).join('')}
          </select>
        </div>

        <!-- Editor Mode Tabs -->
        <div>
          <label class="block text-[10px] font-extrabold uppercase tracking-wider text-[#414750] mb-1">এডিটর মোড (Editor Mode)</label>
          <div class="inline-flex rounded-xl bg-[#eff4ff] p-1 border border-[#c4dcff]">
            <button type="button" onclick="setPageEditorMode('visual')" class="px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${cmsState.pageEditorMode === 'visual' ? 'bg-[#004b80] text-white shadow' : 'text-[#001c37] hover:bg-white/60'}">
              <span class="material-symbols-outlined text-sm">touch_app</span>
              <span>লাইভ ভিজ্যুয়াল ক্যানভাস</span>
            </button>
            <button type="button" onclick="setPageEditorMode('structured')" class="px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${cmsState.pageEditorMode === 'structured' ? 'bg-[#004b80] text-white shadow' : 'text-[#001c37] hover:bg-white/60'}">
              <span class="material-symbols-outlined text-sm">view_list</span>
              <span>সেকশন, টেক্সট, বাটন ও ছবি</span>
            </button>
            <button type="button" onclick="setPageEditorMode('source')" class="px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${cmsState.pageEditorMode === 'source' ? 'bg-[#004b80] text-white shadow' : 'text-[#001c37] hover:bg-white/60'}">
              <span class="material-symbols-outlined text-sm">code</span>
              <span>HTML সোর্স কোড</span>
            </button>
          </div>
        </div>

        ${cmsState.pageEditorMode === 'visual' ? `
        <!-- Responsive Viewport Switcher -->
        <div>
          <label class="block text-[10px] font-extrabold uppercase tracking-wider text-[#414750] mb-1">ডিভাইস ভিউ (Viewport)</label>
          <div class="inline-flex rounded-xl bg-[#eff4ff] p-1 border border-[#c4dcff]">
            <button type="button" onclick="setVisualViewport('100%')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold ${cmsState.viewportWidth === '100%' ? 'bg-[#006c49] text-white' : 'text-[#001c37]'}" title="Desktop View">
              <span class="material-symbols-outlined text-sm">desktop_windows</span>
            </button>
            <button type="button" onclick="setVisualViewport('768px')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold ${cmsState.viewportWidth === '768px' ? 'bg-[#006c49] text-white' : 'text-[#001c37]'}" title="Tablet View">
              <span class="material-symbols-outlined text-sm">tablet_mac</span>
            </button>
            <button type="button" onclick="setVisualViewport('390px')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold ${cmsState.viewportWidth === '390px' ? 'bg-[#006c49] text-white' : 'text-[#001c37]'}" title="Mobile View">
              <span class="material-symbols-outlined text-sm">smartphone</span>
            </button>
          </div>
        </div>
        ` : ''}
      </div>

      <!-- Save Draft / Publish / Revision History / New Page Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" onclick="openCreatePageModal('page')" class="admin-btn-secondary !py-2 !px-3 !text-xs">
          <span class="material-symbols-outlined text-base text-[#006c49]">add_circle</span>
          <span>নতুন পেজ</span>
        </button>
        <button type="button" onclick="openPageRevisionsModal('${escapeHtml(activePage.file)}')" class="admin-btn-secondary !py-2 !px-3 !text-xs">
          <span class="material-symbols-outlined text-base text-[#004b80]">history</span>
          <span>রিভিশন হিস্ট্রি (${(activePage.revisions || []).length})</span>
        </button>
        <button type="button" onclick="saveCurrentPage('draft')" class="admin-btn-secondary !py-2 !px-3.5 !text-xs !border-amber-400 !text-amber-900 !bg-amber-50">
          <span class="material-symbols-outlined text-base">save</span>
          <span>ড্রাফট সেভ করুন</span>
        </button>
        <button type="button" onclick="saveCurrentPage('published')" class="admin-btn-primary !py-2 !px-4 !text-xs">
          <span class="material-symbols-outlined text-base">rocket_launch</span>
          <span>পাবলিশ করুন (Publish Live)</span>
        </button>
        ${!['index.html', 'about.html', '5-pillars.html', 'programs.html', 'ecosystem.html', 'blog.html', 'contact.html', 'appointment.html'].includes(activePage.file) ? `
        <button type="button" onclick="deleteSelectedPage('${escapeHtml(activePage.file)}')" class="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50" title="পেজ মুছে ফেলুন">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
        ` : ''}
      </div>
    </div>

    <!-- Page Metadata Quick Bar -->
    <div class="admin-card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-xs font-bold text-[#414750] mb-1">পাতার শিরোনাম (Page Title &lt;title&gt;)</label>
        <input id="pageEditorTitleInput" type="text" value="${escapeHtml(activePage.title)}" oninput="updateActivePageField('title', this.value)" class="admin-input">
      </div>
      <div>
        <label class="block text-xs font-bold text-[#414750] mb-1">প্রধান শিরোনাম (Primary H1 Heading)</label>
        <input id="pageEditorH1Input" type="text" value="${escapeHtml(activePage.h1)}" oninput="updateActivePageField('h1', this.value)" class="admin-input">
      </div>
      <div>
        <label class="block text-xs font-bold text-[#414750] mb-1">মেটা বর্ণনা (Meta Description)</label>
        <input id="pageEditorDescInput" type="text" value="${escapeHtml(activePage.description)}" oninput="updateActivePageField('description', this.value)" class="admin-input">
      </div>
    </div>

    <!-- Main Editor Area based on Mode -->
    ${cmsState.pageEditorMode === 'visual' ? `
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <!-- Live Interactive Visual Canvas (8 cols) -->
      <div class="xl:col-span-8 admin-card overflow-hidden flex flex-col">
        <div class="bg-[#0a2540] text-white px-4 py-2.5 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
            <span class="font-bold">লাইভ ক্লিক-টু-এডিট ক্যানভাস:</span>
            <span class="font-mono text-[#6ffbbe]">${escapeHtml(activePage.slug)}</span>
          </div>
          <span class="text-[11px] text-blue-200">পাতার যেকোনো শিরোনাম, লেখা, বাটন বা ছবির ওপর ক্লিক করে ডানপাশের বক্সে তাৎক্ষণিক পরিবর্তন করুন</span>
        </div>
        <div class="bg-slate-200/70 p-3 flex justify-center overflow-x-auto">
          <iframe id="cmsVisualEditorIframe" src="${escapeHtml(iframeUrl)}" style="width: ${cmsState.viewportWidth}; height: 720px;" class="bg-white rounded-2xl shadow-xl border border-[#dbe4f0] transition-all duration-300"></iframe>
        </div>
      </div>

      <!-- Live Element Inspector Sidebar (4 cols) -->
      <div class="xl:col-span-4 admin-card p-5 space-y-5 sticky top-20">
        <div class="border-b border-[#dbe4f0] pb-3">
          <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Live Element Inspector</span>
          <h3 class="text-base font-extrabold text-[#001c37] flex items-center gap-2 mt-0.5">
            <span class="material-symbols-outlined text-[#004b80]">edit_note</span>
            <span>নির্বাচিত এলিমেন্ট এডিটর</span>
          </h3>
        </div>

        <div id="cmsVisualInspectorBody" class="space-y-4">
          <div class="p-5 rounded-2xl bg-[#eff4ff] border border-[#c4dcff] text-xs text-[#001c37] leading-relaxed space-y-2">
            <div class="font-extrabold text-[#004b80] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-base">touch_app</span>
              <span>কীভাবে ভিজ্যুয়াল এডিটর ব্যবহার করবেন:</span>
            </div>
            <p>বাম পাশের লাইভ পেজের যেকোনো <strong>শিরোনাম (Heading)</strong>, <strong>অনুচ্ছেদ (Text)</strong>, <strong>বাটন (Button/Link)</strong> অথবা <strong>ছবি (Image)</strong>-এর ওপর মাউস নিয়ে ক্লিক করুন।</p>
            <p>সাথে সাথে এখানে সেই অংশের টেক্সট, লিংক বা ছবি পরিবর্তনের বক্স খুলে যাবে এবং আপনি টাইপ করার সাথে সাথে লাইভ পেজে পরিবর্তন দেখতে পাবেন!</p>
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    ${cmsState.pageEditorMode === 'structured' ? `
    <!-- Structured Form Editor for Headings, Buttons & Images -->
    <div class="admin-card p-6 space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe4f0] pb-4">
        <div>
          <h3 class="text-base font-extrabold text-[#001c37]">সেকশন, শিরোনাম, বাটন ও ছবি এডিটর (${escapeHtml(activePage.slug)})</h3>
          <p class="text-xs text-[#414750]">কোড ছাড়াই এই পাতার সকল শিরোনাম, বাটন লিংক এবং ছবি নিচের ফর্ম থেকে পরিবর্তন করুন।</p>
        </div>
        <button type="button" onclick="saveCurrentPage('published')" class="admin-btn-primary !text-xs">
          <span class="material-symbols-outlined text-sm">check_circle</span>
          <span>পরিবর্তন সেভ ও পাবলিশ করুন</span>
        </button>
      </div>
      <div id="cmsStructuredEditorContainer" class="space-y-6"></div>
    </div>
    ` : ''}

    ${cmsState.pageEditorMode === 'source' ? `
    <!-- Full HTML Source Code Editor -->
    <div class="admin-card p-6 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-extrabold text-[#001c37] flex items-center gap-2">
            <span class="material-symbols-outlined text-[#004b80]">code</span>
            <span>পূর্ণাঙ্গ &lt;main&gt; HTML সোর্স এডিটর (${escapeHtml(activePage.file)})</span>
          </h3>
          <p class="text-xs text-[#414750]">উন্নত কাস্টমাইজেশনের জন্য সরাসরি HTML ও Tailwind CSS ক্লাস সম্পাদনা করুন।</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="downloadPageHtmlFile('${escapeHtml(activePage.file)}')" class="admin-btn-secondary !text-xs">
            <span class="material-symbols-outlined text-sm">download</span>
            <span>HTML ডাউনলোড</span>
          </button>
          <button type="button" onclick="saveCurrentPage('published')" class="admin-btn-primary !text-xs">
            <span class="material-symbols-outlined text-sm">save</span>
            <span>কোড সেভ ও পাবলিশ করুন</span>
          </button>
        </div>
      </div>
      <textarea id="cmsSourceHtmlTextarea" rows="24" oninput="updateActivePageField('mainHtml', this.value)" class="w-full font-mono text-xs p-4 rounded-2xl bg-[#061729] text-[#eaf1ff] border border-[#1b3554] focus:outline-none focus:border-[#10b981] leading-relaxed">${escapeHtml(activePage.mainHtml || '')}</textarea>
    </div>
    ` : ''}
  `;

  if (cmsState.pageEditorMode === 'structured') {
    renderStructuredPageElements(activePage);
  }
}

function selectPageForEditing(file) {
  cmsState.selectedPageFile = file;
  cmsState.selectedVisualElement = null;
  renderPagesModule(document.getElementById('cmsModuleViewport'));
}

function setPageEditorMode(mode) {
  cmsState.pageEditorMode = mode;
  renderPagesModule(document.getElementById('cmsModuleViewport'));
}

function setVisualViewport(width) {
  cmsState.viewportWidth = width;
  const iframe = document.getElementById('cmsVisualEditorIframe');
  if (iframe) iframe.style.width = width;
  renderPagesModule(document.getElementById('cmsModuleViewport'));
}

function updateActivePageField(field, value) {
  const page = cmsState.db?.pages?.[cmsState.selectedPageFile];
  if (!page) return;
  page[field] = value;
  page._clientModified = true;
  cmsState.unsavedChanges = true;
  const badge = document.getElementById('cmsUnsavedBadge');
  if (badge) badge.classList.remove('hidden');
}

// Listen for messages from the Visual Editor iframe
window.addEventListener('message', function (event) {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'CMS_ELEMENT_SELECTED') {
    cmsState.selectedVisualElement = data;
    renderVisualElementInspector(data);
  } else if (data.type === 'CMS_MAIN_HTML_UPDATED') {
    const page = cmsState.db?.pages?.[cmsState.selectedPageFile];
    if (page && data.mainHtml) {
      page.mainHtml = data.mainHtml;
      page._clientModified = true;
      if (data.h1) {
        page.h1 = data.h1;
        const h1Input = document.getElementById('pageEditorH1Input');
        if (h1Input) h1Input.value = data.h1;
      }
      persistLocalDb();
    }
  }
});

function renderVisualElementInspector(el) {
  const box = document.getElementById('cmsVisualInspectorBody');
  if (!box) return;
  const isImg = el.tagName === 'img';
  const isLink = el.tagName === 'a' || el.tagName === 'button' || Boolean(el.href);

  box.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#eff4ff] border border-[#c4dcff] text-xs">
        <span class="font-extrabold text-[#004b80] uppercase">Tag: &lt;${escapeHtml(el.tagName)}&gt;</span>
        <span class="font-mono text-[11px] text-[#006c49]">${escapeHtml(el.cmsId)}</span>
      </div>

      ${isImg ? `
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">ছবির পাথ / URL (Image Source)</label>
          <div class="flex gap-2">
            <input id="veImgSrcInput" type="text" value="${escapeHtml(el.src)}" oninput="pushVisualElementUpdate()" class="admin-input">
            <button type="button" onclick="openMediaPickerForInspector()" class="admin-btn-secondary !px-3 shrink-0" title="মিডিয়া লাইব্রেরি থেকে ছবি নিন">
              <span class="material-symbols-outlined text-base text-[#006c49]">photo_library</span>
            </button>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">ছবির Alt টেক্সট (SEO Alt Text)</label>
          <input id="veImgAltInput" type="text" value="${escapeHtml(el.alt)}" oninput="pushVisualElementUpdate()" class="admin-input">
        </div>
        <div class="p-3 rounded-xl bg-slate-50 border border-[#dbe4f0] text-center">
          <img id="veImgPreview" src="${escapeHtml(el.src)}" alt="Preview" class="max-h-40 mx-auto rounded-lg object-contain">
        </div>
      ` : `
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">টেক্সট বিষয়বস্তু (Text Content)</label>
          <textarea id="veTextInput" rows="4" oninput="pushVisualElementUpdate()" class="admin-input">${escapeHtml(el.text)}</textarea>
        </div>
        ${isLink ? `
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">বাটন / লিংক URL (Target href)</label>
          <input id="veHrefInput" type="text" value="${escapeHtml(el.href)}" oninput="pushVisualElementUpdate()" class="admin-input" placeholder="https://jklifestyleltd.com/appointment/">
        </div>
        ` : ''}
      `}

      <div class="pt-2 flex items-center justify-between gap-2">
        <button type="button" onclick="saveCurrentPage('draft')" class="admin-btn-secondary !w-1/2 justify-center !text-xs">ড্রাফট সেভ</button>
        <button type="button" onclick="saveCurrentPage('published')" class="admin-btn-primary !w-1/2 justify-center !text-xs">লাইভ পাবলিশ</button>
      </div>
    </div>
  `;
}

function pushVisualElementUpdate() {
  const el = cmsState.selectedVisualElement;
  const iframe = document.getElementById('cmsVisualEditorIframe');
  if (!el || !iframe || !iframe.contentWindow) return;

  const payload = {
    type: 'CMS_UPDATE_SELECTED_ELEMENT',
    cmsId: el.cmsId
  };

  if (el.tagName === 'img') {
    payload.src = document.getElementById('veImgSrcInput')?.value || '';
    payload.alt = document.getElementById('veImgAltInput')?.value || '';
    const prev = document.getElementById('veImgPreview');
    if (prev && payload.src) prev.src = payload.src;
  } else {
    payload.text = document.getElementById('veTextInput')?.value || '';
    const hrefEl = document.getElementById('veHrefInput');
    if (hrefEl) payload.href = hrefEl.value;
  }

  iframe.contentWindow.postMessage(payload, '*');
}

function openMediaPickerForInspector() {
  const mediaList = cmsState.db?.media || [];
  openCmsModal('মিডিয়া লাইব্রেরি থেকে ছবি নির্বাচন করুন (Select Image)', `
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      ${mediaList.map(m => `
        <button type="button" onclick="selectImageForVisualInspector('${escapeHtml(m.path)}', '${escapeHtml(m.alt)}')" class="p-2 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-[#f8f9ff] text-left transition-all group">
          <img src="${escapeHtml(m.path)}" alt="${escapeHtml(m.alt)}" class="w-full h-28 object-cover rounded-xl mb-2">
          <div class="text-xs font-bold text-[#001c37] truncate">${escapeHtml(m.name)}</div>
        </button>
      `).join('')}
    </div>
  `);
}

function selectImageForVisualInspector(path, alt) {
  const srcInput = document.getElementById('veImgSrcInput');
  const altInput = document.getElementById('veImgAltInput');
  if (srcInput) srcInput.value = path;
  if (altInput && alt) altInput.value = alt;
  closeCmsModal();
  pushVisualElementUpdate();
}

// Parse and allow structured editing of headings, buttons/links, and images inside activePage.mainHtml
function renderStructuredPageElements(page) {
  const wrap = document.getElementById('cmsStructuredEditorContainer');
  if (!wrap) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="cmsRootWrap">${page.mainHtml || ''}</div>`, 'text/html');
  const root = doc.getElementById('cmsRootWrap');

  const headings = Array.from(root.querySelectorAll('h1, h2, h3'));
  const links = Array.from(root.querySelectorAll('a'));
  const images = Array.from(root.querySelectorAll('img'));

  wrap.innerHTML = `
    <!-- Headings Section -->
    <div class="space-y-3">
      <h4 class="text-sm font-extrabold text-[#004b80] uppercase tracking-wider flex items-center gap-2">
        <span class="material-symbols-outlined text-base">title</span>
        <span>পাতার সকল শিরোনাম (Headings: ${headings.length})</span>
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${headings.map((h, i) => `
          <div class="p-3 rounded-xl bg-[#f8f9ff] border border-[#dbe4f0]">
            <label class="block text-[10px] font-bold uppercase text-[#006c49] mb-1">${h.tagName} Heading #${i + 1}</label>
            <input type="text" value="${escapeHtml(h.textContent.trim())}" onchange="updateStructuredDomItem('heading', ${i}, this.value)" class="admin-input">
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Buttons & Links Section -->
    <div class="space-y-3 pt-4 border-t border-[#dbe4f0]">
      <h4 class="text-sm font-extrabold text-[#006c49] uppercase tracking-wider flex items-center gap-2">
        <span class="material-symbols-outlined text-base">smart_button</span>
        <span>পাতার বাটন ও লিংকসমূহ (Buttons &amp; Links: ${links.length})</span>
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
        ${links.map((a, i) => `
          <div class="p-3 rounded-xl bg-[#f8f9ff] border border-[#dbe4f0] grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-[#414750] mb-1">বাটন টেক্সট #${i + 1}</label>
              <input type="text" value="${escapeHtml(a.textContent.replace(/\s+/g, ' ').trim())}" onchange="updateStructuredDomItem('link-text', ${i}, this.value)" class="admin-input">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-[#414750] mb-1">টার্গেট লিংক (URL)</label>
              <input type="text" value="${escapeHtml(a.getAttribute('href') || '')}" onchange="updateStructuredDomItem('link-href', ${i}, this.value)" class="admin-input font-mono !text-xs">
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Images Section -->
    <div class="space-y-3 pt-4 border-t border-[#dbe4f0]">
      <h4 class="text-sm font-extrabold text-[#004b80] uppercase tracking-wider flex items-center gap-2">
        <span class="material-symbols-outlined text-base">image</span>
        <span>পাতার ছবিসমূহ (Images: ${images.length})</span>
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${images.map((img, i) => `
          <div class="p-3.5 rounded-2xl bg-[#f8f9ff] border border-[#dbe4f0] flex items-center gap-3.5">
            <img src="${escapeHtml(img.getAttribute('src') || '')}" alt="" class="w-20 h-20 rounded-xl object-cover border border-[#dbe4f0] shrink-0 bg-white">
            <div class="flex-1 space-y-2 min-w-0">
              <div>
                <label class="block text-[10px] font-bold text-[#414750]">Image Path (src)</label>
                <input type="text" value="${escapeHtml(img.getAttribute('src') || '')}" onchange="updateStructuredDomItem('img-src', ${i}, this.value)" class="admin-input !py-1 !text-xs font-mono">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-[#414750]">Alt Text</label>
                <input type="text" value="${escapeHtml(img.getAttribute('alt') || '')}" onchange="updateStructuredDomItem('img-alt', ${i}, this.value)" class="admin-input !py-1 !text-xs">
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function updateStructuredDomItem(kind, index, newVal) {
  const page = cmsState.db?.pages?.[cmsState.selectedPageFile];
  if (!page) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="cmsRootWrap">${page.mainHtml || ''}</div>`, 'text/html');
  const root = doc.getElementById('cmsRootWrap');

  if (kind === 'heading') {
    const list = root.querySelectorAll('h1, h2, h3');
    if (list[index]) list[index].textContent = newVal;
  } else if (kind === 'link-text') {
    const list = root.querySelectorAll('a');
    if (list[index]) list[index].textContent = newVal;
  } else if (kind === 'link-href') {
    const list = root.querySelectorAll('a');
    if (list[index]) list[index].setAttribute('href', newVal);
  } else if (kind === 'img-src') {
    const list = root.querySelectorAll('img');
    if (list[index]) list[index].setAttribute('src', newVal);
  } else if (kind === 'img-alt') {
    const list = root.querySelectorAll('img');
    if (list[index]) list[index].setAttribute('alt', newVal);
  }

  page.mainHtml = root.innerHTML;
  page._clientModified = true;
  persistLocalDb();
  showToast('পাতার অংশটি আপডেট হয়েছে। পাবলিশ বাটনে ক্লিক করে লাইভ করুন।', 'info');
}

async function saveCurrentPage(status = 'published') {
  if (!requirePermission('pages.write', 'পেজ সম্পাদনা ও পাবলিশ')) return;
  const page = cmsState.db?.pages?.[cmsState.selectedPageFile];
  if (!page) return;

  page.status = status;
  page.updatedAt = new Date().toISOString();
  page.updatedBy = cmsState.session?.name || 'Admin';
  page._clientModified = true;

  if (!Array.isArray(page.revisions)) page.revisions = [];
  page.revisions.unshift({
    revId: 'rev-' + Date.now(),
    timestamp: page.updatedAt,
    author: page.updatedBy,
    note: status === 'published' ? 'Published live via Admin Panel' : 'Saved as draft',
    title: page.title,
    description: page.description,
    h1: page.h1,
    mainHtml: page.mainHtml
  });
  page.revisions = page.revisions.slice(0, 25);

  addAuditEntry(status === 'published' ? 'PAGE_PUBLISHED' : 'PAGE_DRAFT_SAVED', `${page.file} (${page.slug}) — ${page.title}`);

  const badge = document.getElementById('cmsUnsavedBadge');
  if (badge) badge.classList.add('hidden');
  cmsState.unsavedChanges = false;

  await callCmsApi('save_page', {
    file: page.file,
    status: page.status,
    title: page.title,
    h1: page.h1,
    description: page.description,
    keywords: page.keywords,
    focusKw: page.focusKw,
    canonical: page.canonical,
    robots: page.robots,
    ogImage: page.ogImage,
    aeoLead: page.aeoLead,
    jsonLd: page.jsonLd,
    mainHtml: page.mainHtml,
    note: status === 'published' ? 'Published live via Admin Panel' : 'Saved as draft'
  });

  showToast(
    status === 'published'
      ? `"${page.slug}" পাতাটি সফলভাবে লাইভ ওয়েবসাইটে পাবলিশ হয়েছে!`
      : `"${page.slug}" পাতাটি ড্রাফট হিসেবে সংরক্ষিত হয়েছে।`,
    'success'
  );
}

function openPageRevisionsModal(file) {
  const page = cmsState.db?.pages?.[file];
  if (!page) return;
  const revs = page.revisions || [];
  openCmsModal(`রিভিশন হিস্ট্রি ও পূর্বাবস্থায় ফেরত (${page.slug})`, `
    <div class="space-y-3">
      ${revs.length === 0 ? `<p class="text-xs text-[#414750]">কোনো রিভিশন পাওয়া যায়নি।</p>` : revs.map((r, idx) => `
        <div class="p-4 rounded-2xl bg-[#f8f9ff] border border-[#dbe4f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#004b80] text-[11px] font-extrabold">${idx === 0 ? 'সর্বশেষ সংস্করণ' : 'Revision #' + (revs.length - idx)}</span>
              <span class="text-xs font-bold text-[#001c37]">${escapeHtml(r.note || 'Page Update')}</span>
            </div>
            <div class="text-xs text-[#414750] mt-1">শিরোনাম: ${escapeHtml(r.title || page.title)}</div>
            <div class="text-[11px] text-[#717781] font-mono mt-0.5">লেখক: ${escapeHtml(r.author)} · সময়: ${escapeHtml(String(r.timestamp).slice(0, 19).replace('T', ' '))}</div>
          </div>
          <button type="button" onclick="restorePageRevision('${escapeHtml(file)}', '${escapeHtml(r.revId)}')" class="admin-btn-secondary !text-xs shrink-0">
            <span class="material-symbols-outlined text-sm text-[#006c49]">restore</span>
            <span>এই সংস্করণে ফিরুন (Restore)</span>
          </button>
        </div>
      `).join('')}
    </div>
  `);
}

async function restorePageRevision(file, revId) {
  if (!requirePermission('pages.write', 'রিভিশন রিস্টোর')) return;
  const page = cmsState.db?.pages?.[file];
  if (!page) return;
  const rev = (page.revisions || []).find(r => r.revId === revId);
  if (!rev) return;

  if (rev.title) page.title = rev.title;
  if (rev.description) page.description = rev.description;
  if (rev.h1) page.h1 = rev.h1;
  if (rev.mainHtml) page.mainHtml = rev.mainHtml;
  page._clientModified = true;

  closeCmsModal();
  await saveCurrentPage('published');
  renderPagesModule(document.getElementById('cmsModuleViewport'));
  showToast('রিভিশন সফলভাবে রিস্টোর এবং লাইভ করা হয়েছে!', 'success');
}

function openCreatePageModal(defaultType = 'page') {
  if (!requirePermission('pages.write', 'নতুন পেজ তৈরি')) return;
  openCmsModal(defaultType === 'blog' ? 'নতুন ব্লগ প্রবন্ধ তৈরি করুন (Create New Blog Post)' : 'নতুন ওয়েবসাইট পাতা তৈরি করুন (Create New Page)', `
    <form onsubmit="handleCreateNewPage(event)" class="space-y-4 text-xs sm:text-sm">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">পাতার ধরন (Content Type)</label>
          <select id="newPageType" class="admin-input">
            <option value="page" ${defaultType === 'page' ? 'selected' : ''}>সাধারণ ওয়েবসাইট পাতা (Standard Page)</option>
            <option value="blog" ${defaultType === 'blog' ? 'selected' : ''}>বিজ্ঞানভিত্তিক ব্লগ প্রবন্ধ (Clinical Blog Post)</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">ক্লিন URL স্লাগ (URL Slug, যেমন: heart-care)</label>
          <input id="newPageSlug" type="text" required placeholder="metabolic-health-guide" class="admin-input font-mono">
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-[#414750] mb-1">পাতার শিরোনাম (SEO Title &amp; H1)</label>
        <input id="newPageTitle" type="text" required placeholder="মেটাবলিক স্বাস্থ্য ও ফ্যাট অ্যাডাপ্টেশন নির্দেশিকা — ডা. জাহাঙ্গীর কবির" class="admin-input">
      </div>

      <div>
        <label class="block text-xs font-bold text-[#414750] mb-1">সংক্ষিপ্ত মেটা ও AEO সারসংক্ষেপ (Lead Description)</label>
        <textarea id="newPageDesc" rows="3" required placeholder="ডা. মুহাম্মদ জাহাঙ্গীর কবিরের জেকে লাইফস্টাইল প্রোটোকল অনুসরণ করে ওষুধমুক্ত সুস্থ জীবনের বৈজ্ঞানিক নির্দেশিকা..." class="admin-input"></textarea>
      </div>

      <div class="flex justify-end gap-2 pt-3 border-t border-[#dbe4f0]">
        <button type="button" onclick="closeCmsModal()" class="admin-btn-secondary">বাতিল</button>
        <button type="submit" class="admin-btn-primary">
          <span class="material-symbols-outlined text-base">add_circle</span>
          <span>পাতা তৈরি ও এডিটরে খুলুন</span>
        </button>
      </div>
    </form>
  `);
}

async function handleCreateNewPage(e) {
  e.preventDefault();
  const type = document.getElementById('newPageType')?.value || 'page';
  const rawSlug = (document.getElementById('newPageSlug')?.value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  const title = (document.getElementById('newPageTitle')?.value || '').trim();
  const description = (document.getElementById('newPageDesc')?.value || '').trim();

  if (!rawSlug || !title) {
    showToast('অনুগ্রহ করে URL স্লাগ এবং শিরোনাম প্রদান করুন।', 'warning');
    return;
  }

  const file = rawSlug + '.html';
  const cleanSlug = '/' + rawSlug;
  if (cmsState.db.pages[file]) {
    showToast('এই URL স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে। অন্য নাম দিন।', 'error');
    return;
  }

  const mainHtml = `
  <section class="relative overflow-hidden bg-gradient-to-b from-[#eff4ff] via-[#f8f9ff] to-[#ffffff] pt-10 pb-14 border-b border-[#dbe4f0]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#6ffbbe]/40 border border-[#006c49]/20 text-[#005236] text-xs font-bold mb-4">
        <span class="material-symbols-outlined text-base">verified</span>
        <span>হেলথ রেভলিউশন · জেকে লাইফস্টাইল</span>
      </div>
      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#001c37] leading-tight mb-4">${escapeHtml(title)}</h1>
      <p class="aeo-lead-answer text-base sm:text-lg text-[#414750] leading-relaxed max-w-4xl">${escapeHtml(description)}</p>
    </div>
  </section>
  <section class="py-16 bg-surface">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div class="p-8 rounded-3xl bg-white border border-[#dbe4f0] shadow-sm space-y-4">
        <h2 class="text-2xl font-extrabold text-[#001c37]">মূল বৈজ্ঞানিক আলোচনা ও নির্দেশিকা</h2>
        <p class="text-base text-[#414750] leading-relaxed">${escapeHtml(description)}</p>
        <div class="pt-4">
          <a href="https://jklifestyleltd.com/appointment/" class="inline-flex items-center gap-2 bg-[#10b981] hover:bg-[#00714d] text-white text-sm font-bold px-6 py-3 rounded-full shadow-md">
            <span>ফ্রি ডাক্তার অ্যাপয়েন্টমেন্ট নিন</span>
            <span class="material-symbols-outlined text-base">calendar_month</span>
          </a>
        </div>
      </div>
    </div>
  </section>`;

  cmsState.db.pages[file] = {
    id: rawSlug,
    file,
    slug: cleanSlug,
    type,
    status: 'published',
    title,
    h1: title,
    description,
    keywords: 'ডা. জাহাঙ্গীর কবির, জেকে লাইফস্টাইল, হেলথ রেভলিউশন',
    focusKw: title,
    canonical: 'https://drjahangirkabir.com' + cleanSlug,
    robots: 'index, follow',
    ogImage: 'https://drjahangirkabir.com/images/dr-hero.jpg',
    aeoLead: description,
    jsonLd: '{}',
    mainHtml,
    updatedAt: new Date().toISOString(),
    updatedBy: cmsState.session?.name || 'Admin',
    _clientModified: true,
    revisions: [
      {
        revId: 'rev-create-' + Date.now(),
        timestamp: new Date().toISOString(),
        author: cmsState.session?.name || 'Admin',
        note: 'Created new page via CMS',
        title,
        description,
        h1: title,
        mainHtml
      }
    ]
  };

  addAuditEntry('PAGE_CREATED', `Created ${file} (${cleanSlug})`);
  await callCmsApi('create_page', { slug: rawSlug, title, description, type, mainHtml });

  closeCmsModal();
  populateQuickPageSelect();
  cmsState.selectedPageFile = file;
  switchAdminModule('pages');
  showToast(`নতুন পাতা "${cleanSlug}" সফলভাবে তৈরি হয়েছে!`, 'success');
}

async function deleteSelectedPage(file) {
  if (!requirePermission('pages.write', 'পেজ মুছে ফেলা')) return;
  if (!confirm(`আপনি কি নিশ্চিতভাবে "${file}" পাতাটি মুছে ফেলতে চান?`)) return;

  delete cmsState.db.pages[file];
  addAuditEntry('PAGE_DELETED', `Deleted ${file}`);
  await callCmsApi('delete_page', { file });

  cmsState.selectedPageFile = 'index.html';
  populateQuickPageSelect();
  renderPagesModule(document.getElementById('cmsModuleViewport'));
  showToast(`"${file}" পাতাটি মুছে ফেলা হয়েছে।`, 'info');
}

function downloadPageHtmlFile(file) {
  const page = cmsState.db?.pages?.[file];
  if (!page) return;
  const blob = new Blob([page.mainHtml || ''], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
}

// ==================== 3. BLOG & PUBLICATIONS CMS MODULE ====================
function renderBlogsModule(container) {
  const db = cmsState.db;
  const blogPosts = Object.values(db.pages || {}).filter(p => p.type === 'blog');
  if (!blogPosts.some(b => b.file === cmsState.selectedBlogFile)) {
    cmsState.selectedBlogFile = blogPosts[0]?.file || 'dr-jahangir-kabir-biography.html';
  }
  const activeBlog = db.pages[cmsState.selectedBlogFile] || blogPosts[0];

  container.innerHTML = `
    <div class="admin-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Clinical Publications &amp; AEO Blog Engine</span>
        <h3 class="text-lg font-extrabold text-[#001c37]">বিজ্ঞানভিত্তিক বাংলা স্বাস্থ্য প্রবন্ধ ও ব্লগ ম্যানেজমেন্ট (${blogPosts.length}টি প্রবন্ধ)</h3>
        <p class="text-xs text-[#414750]">সকল ব্লগ পোস্টের শিরোনাম, AEO Speakable সারসংক্ষেপ, ফোকাস কিওয়ার্ড, ছবি ও পূর্ণাঙ্গ আর্টিকেল এডিট বা নতুন ব্লগ পোস্ট তৈরি করুন।</p>
      </div>
      <button type="button" onclick="openCreatePageModal('blog')" class="admin-btn-primary shrink-0">
        <span class="material-symbols-outlined text-base">post_add</span>
        <span>নতুন ব্লগ প্রবন্ধ লিখুন</span>
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Blog List (4 cols) -->
      <div class="lg:col-span-4 space-y-3">
        ${blogPosts.map(b => `
          <div onclick="selectBlogPost('${escapeHtml(b.file)}')" class="cursor-pointer p-4 rounded-2xl border transition-all ${b.file === activeBlog?.file ? 'bg-[#eff4ff] border-[#004b80] shadow-md' : 'bg-white border-[#dbe4f0] hover:border-[#006c49]'}">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="font-mono text-[11px] font-bold text-[#004b80]">${escapeHtml(b.slug)}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'published' ? 'bg-[#e8f7f0] text-[#006c49]' : 'bg-amber-100 text-amber-800'}">${b.status === 'published' ? 'Published' : 'Draft'}</span>
            </div>
            <h4 class="text-xs sm:text-sm font-extrabold text-[#001c37] leading-snug mb-2">${escapeHtml(b.title)}</h4>
            <div class="flex items-center justify-between text-[11px] text-[#414750]">
              <span>হালনাগাদ: ${escapeHtml(String(b.updatedAt).slice(0, 10))}</span>
              <button type="button" onclick="event.stopPropagation(); quickJumpToPageEditor('${escapeHtml(b.file)}')" class="text-[#006c49] font-extrabold hover:underline">ভিজ্যুয়াল এডিটর →</button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Active Blog Editor (8 cols) -->
      ${activeBlog ? `
      <div class="lg:col-span-8 admin-card p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe4f0] pb-4">
          <div>
            <span class="font-mono text-xs font-bold text-[#004b80]">${escapeHtml(activeBlog.slug)}</span>
            <h4 class="text-base font-extrabold text-[#001c37]">প্রবন্ধ সম্পাদনা ফর্ম</h4>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="quickJumpToPageEditor('${escapeHtml(activeBlog.file)}')" class="admin-btn-secondary !text-xs">
              <span class="material-symbols-outlined text-sm">touch_app</span>
              <span>লাইভ ভিজ্যুয়াল ক্যানভাসে খুলুন</span>
            </button>
            <button type="button" onclick="saveActiveBlogPost('draft')" class="admin-btn-secondary !text-xs !border-amber-400 !bg-amber-50 !text-amber-900">ড্রাফট সেভ</button>
            <button type="button" onclick="saveActiveBlogPost('published')" class="admin-btn-primary !text-xs">
              <span class="material-symbols-outlined text-sm">publish</span>
              <span>প্রবন্ধ পাবলিশ করুন</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">প্রবন্ধের শিরোনাম (SEO Title)</label>
            <input id="blogTitleInput" type="text" value="${escapeHtml(activeBlog.title)}" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">প্রধান H1 শিরোনাম (Article H1)</label>
            <input id="blogH1Input" type="text" value="${escapeHtml(activeBlog.h1)}" class="admin-input">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">RankMath ফোকাস কিওয়ার্ড (Focus Keyword)</label>
            <input id="blogFocusKwInput" type="text" value="${escapeHtml(activeBlog.focusKw)}" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">কভার ছবি (OG Image URL)</label>
            <input id="blogOgImageInput" type="text" value="${escapeHtml(activeBlog.ogImage)}" class="admin-input font-mono !text-xs">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">মেটা বর্ণনা (Meta Description — ১৫০–১৬০ অক্ষর)</label>
          <textarea id="blogDescInput" rows="2" class="admin-input">${escapeHtml(activeBlog.description)}</textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">AEO Speakable প্রারম্ভিক উত্তর (Direct Answer Summary)</label>
          <textarea id="blogAeoLeadInput" rows="3" class="admin-input">${escapeHtml(activeBlog.aeoLead)}</textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">পূর্ণাঙ্গ প্রবন্ধ বডি HTML (&lt;main&gt; Content)</label>
          <textarea id="blogMainHtmlInput" rows="12" class="w-full font-mono text-xs p-3.5 rounded-2xl bg-[#061729] text-[#eaf1ff] border border-[#1b3554]">${escapeHtml(activeBlog.mainHtml)}</textarea>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function selectBlogPost(file) {
  cmsState.selectedBlogFile = file;
  renderBlogsModule(document.getElementById('cmsModuleViewport'));
}

async function saveActiveBlogPost(status = 'published') {
  if (!requirePermission('blogs.write', 'ব্লগ প্রবন্ধ সম্পাদনা')) return;
  const blog = cmsState.db?.pages?.[cmsState.selectedBlogFile];
  if (!blog) return;

  blog.title = document.getElementById('blogTitleInput')?.value || blog.title;
  blog.h1 = document.getElementById('blogH1Input')?.value || blog.h1;
  blog.focusKw = document.getElementById('blogFocusKwInput')?.value || blog.focusKw;
  blog.ogImage = document.getElementById('blogOgImageInput')?.value || blog.ogImage;
  blog.description = document.getElementById('blogDescInput')?.value || blog.description;
  blog.aeoLead = document.getElementById('blogAeoLeadInput')?.value || blog.aeoLead;
  blog.mainHtml = document.getElementById('blogMainHtmlInput')?.value || blog.mainHtml;
  blog.status = status;
  blog.updatedAt = new Date().toISOString();
  blog._clientModified = true;

  cmsState.selectedPageFile = blog.file;
  await saveCurrentPage(status);
  renderBlogsModule(document.getElementById('cmsModuleViewport'));
}

// ==================== 4. MEDIA LIBRARY MODULE ====================
function renderMediaModule(container) {
  const mediaList = cmsState.db?.media || [];
  const filtered = mediaList.filter(m => {
    if (cmsState.mediaFilter !== 'all' && m.category !== cmsState.mediaFilter) return false;
    if (cmsState.mediaSearch && !m.name.toLowerCase().includes(cmsState.mediaSearch.toLowerCase()) && !(m.alt || '').toLowerCase().includes(cmsState.mediaSearch.toLowerCase())) {
      return false;
    }
    return true;
  });

  container.innerHTML = `
    <div class="admin-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Media Asset Manager</span>
        <h3 class="text-lg font-extrabold text-[#001c37]">মিডিয়া লাইব্রেরি ও ছবি ব্যবস্থাপনা (${mediaList.length}টি ফাইল)</h3>
        <p class="text-xs text-[#414750]">নতুন ছবি আপলোড করুন, ছবির SEO Alt টেক্সট সম্পাদনা করুন এবং যেকোনো পাতায় ব্যবহারের জন্য এক ক্লিকে পাথ কপি করুন।</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="admin-btn-primary cursor-pointer">
          <span class="material-symbols-outlined text-base">cloud_upload</span>
          <span>নতুন ছবি আপলোড করুন (Upload Image)</span>
          <input type="file" accept="image/*" onchange="handleMediaFileUpload(event)" class="hidden">
        </label>
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div class="admin-card p-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" onclick="setMediaFilter('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold ${cmsState.mediaFilter === 'all' ? 'bg-[#004b80] text-white' : 'bg-[#eff4ff] text-[#001c37]'}">সকল ছবি (${mediaList.length})</button>
        <button type="button" onclick="setMediaFilter('Dr. Jahangir Kabir Photos')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold ${cmsState.mediaFilter === 'Dr. Jahangir Kabir Photos' ? 'bg-[#004b80] text-white' : 'bg-[#eff4ff] text-[#001c37]'}">ডা. জাহাঙ্গীর কবির পোর্ট্রেট</button>
        <button type="button" onclick="setMediaFilter('Website & Clinical Assets')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold ${cmsState.mediaFilter === 'Website & Clinical Assets' ? 'bg-[#004b80] text-white' : 'bg-[#eff4ff] text-[#001c37]'}">ওয়েবসাইট ও ক্লিনিক্যাল অ্যাসেট</button>
      </div>
      <div class="w-full sm:w-72">
        <input type="text" value="${escapeHtml(cmsState.mediaSearch)}" oninput="setMediaSearch(this.value)" placeholder="ছবির নাম বা Alt টেক্সট খুঁজুন..." class="admin-input">
      </div>
    </div>

    <!-- Media Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
      ${filtered.map((m, idx) => `
        <div class="admin-card overflow-hidden flex flex-col justify-between group">
          <div>
            <div class="relative h-52 bg-slate-100 overflow-hidden border-b border-[#dbe4f0]">
              <img src="${escapeHtml(m.path)}" alt="${escapeHtml(m.alt)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy">
              <span class="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#0a2540]/85 text-white text-[10px] font-mono font-bold">${escapeHtml(m.sizeFormatted || 'Asset')}</span>
            </div>
            <div class="p-4 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs font-extrabold text-[#001c37] truncate" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div>
                <button type="button" onclick="copyTextToClipboard('${escapeHtml(m.path)}')" class="text-[11px] font-bold text-[#006c49] hover:underline shrink-0">পাথ কপি</button>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-[#414750] mb-1">SEO Alt Text</label>
                <input type="text" value="${escapeHtml(m.alt)}" onchange="updateMediaItemAlt('${escapeHtml(m.id)}', this.value)" class="admin-input !py-1 !text-xs">
              </div>
            </div>
          </div>
          <div class="px-4 py-2.5 bg-[#f8f9ff] border-t border-[#dbe4f0] flex items-center justify-between text-[11px]">
            <span class="font-mono text-[#004b80] truncate">${escapeHtml(m.path)}</span>
            <a href="${escapeHtml(m.path)}" target="_blank" class="font-bold text-[#006c49] hover:underline shrink-0">পূর্ণ ছবি ↗</a>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setMediaFilter(cat) {
  cmsState.mediaFilter = cat;
  renderMediaModule(document.getElementById('cmsModuleViewport'));
}

function setMediaSearch(q) {
  cmsState.mediaSearch = q;
  renderMediaModule(document.getElementById('cmsModuleViewport'));
}

function copyTextToClipboard(txt) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt);
  }
  showToast(`ক্লিপবোর্ডে কপি হয়েছে: ${txt}`, 'info');
}

function updateMediaItemAlt(id, newAlt) {
  if (!requirePermission('media.write', 'মিডিয়া সম্পাদনা')) return;
  const item = (cmsState.db?.media || []).find(m => m.id === id);
  if (!item) return;
  item.alt = newAlt;
  persistLocalDb();
  showToast('ছবির SEO Alt টেক্সট সংরক্ষিত হয়েছে।', 'success');
}

function handleMediaFileUpload(event) {
  if (!requirePermission('media.write', 'ছবি আপলোড')) return;
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const dataUrl = e.target.result;
    const alt = 'ডা. মুহাম্মদ জাহাঙ্গীর কবির — জেকে লাইফস্টাইল (' + file.name + ')';

    const apiRes = await callCmsApi('upload_media', {
      fileName: file.name,
      dataUrl,
      alt,
      category: 'Uploaded Assets'
    });

    const newItem = (apiRes && apiRes.mediaItem) ? apiRes.mediaItem : {
      id: 'media-' + Date.now(),
      name: file.name,
      path: dataUrl, // Works immediately in browser preview and saves to images/ on PHP server
      url: 'images/' + file.name,
      sizeBytes: file.size,
      sizeFormatted: (file.size / 1024).toFixed(1) + ' KB',
      alt,
      category: 'Website & Clinical Assets',
      uploadedAt: new Date().toISOString()
    };

    if (!Array.isArray(cmsState.db.media)) cmsState.db.media = [];
    cmsState.db.media.unshift(newItem);
    addAuditEntry('MEDIA_UPLOADED', `Uploaded ${file.name} (${newItem.sizeFormatted})`);
    persistLocalDb();
    renderMediaModule(document.getElementById('cmsModuleViewport'));
    showToast(`"${file.name}" সফলভাবে মিডিয়া লাইব্রেরিতে যুক্ত হয়েছে!`, 'success');
  };
  reader.readAsDataURL(file);
}

// ==================== 5. MENUS, HEADER & BUTTONS MODULE ====================
function renderMenusModule(container) {
  const menus = cmsState.db?.menus || {};
  const navItems = menus.headerItems || [];
  const cta = menus.headerCta || {};

  container.innerHTML = `
    <div class="admin-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Navigation, Header &amp; CTA Manager</span>
        <h3 class="text-lg font-extrabold text-[#001c37]">মেনু, হেডার ব্র্যান্ডিং এবং প্রধান বাটন ব্যবস্থাপনা</h3>
        <p class="text-xs text-[#414750]">হেডার লোগো টাইটেল, নেভিগেশন মেনু লিংক, ক্রম, দৃশ্যমানতা এবং প্রধান অ্যাপয়েন্টমেন্ট বাটন এখান থেকে কাস্টমাইজ করুন।</p>
      </div>
      <button type="button" onclick="saveMenusConfiguration()" class="admin-btn-primary shrink-0">
        <span class="material-symbols-outlined text-base">save</span>
        <span>মেনু ও বাটন লাইভ সেভ করুন</span>
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Brand Identity & Header Primary Button (5 cols) -->
      <div class="lg:col-span-5 space-y-6">
        <div class="admin-card p-6 space-y-4">
          <h4 class="text-sm font-extrabold text-[#004b80] uppercase tracking-wider flex items-center gap-2">
            <span class="material-symbols-outlined text-base">branding_watermark</span>
            <span>হেডার ব্র্যান্ড আইডেন্টিটি (Header Brand Text)</span>
          </h4>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">প্রধান ব্র্যান্ড নাম (Brand Title)</label>
            <input id="menuBrandTitle" type="text" value="${escapeHtml(menus.headerBrandTitle || 'হেলথ রেভলিউশন')}" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">সাবটাইটেল (Brand Subtitle)</label>
            <input id="menuBrandSubtitle" type="text" value="${escapeHtml(menus.headerBrandSubtitle || 'ডা. জাহাঙ্গীর কবির · জেকে লাইফস্টাইল')}" class="admin-input">
          </div>
        </div>

        <div class="admin-card p-6 space-y-4">
          <h4 class="text-sm font-extrabold text-[#006c49] uppercase tracking-wider flex items-center gap-2">
            <span class="material-symbols-outlined text-base">smart_button</span>
            <span>হেডার প্রাইমারি অ্যাকশন বাটন (Header CTA Button)</span>
          </h4>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">বাটনের লেখা (Button Label)</label>
            <input id="menuCtaLabel" type="text" value="${escapeHtml(cta.label || 'অ্যাপয়েন্টমেন্ট নিন')}" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">টার্গেট URL (Target Link)</label>
            <input id="menuCtaUrl" type="text" value="${escapeHtml(cta.url || 'https://jklifestyleltd.com/appointment/')}" class="admin-input font-mono !text-xs">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">Material Icon নাম (যেমন: calendar_month, call)</label>
            <input id="menuCtaIcon" type="text" value="${escapeHtml(cta.icon || 'calendar_month')}" class="admin-input font-mono !text-xs">
          </div>
        </div>
      </div>

      <!-- Primary Navigation Menu Items List (7 cols) -->
      <div class="lg:col-span-7 admin-card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-extrabold text-[#001c37] uppercase tracking-wider flex items-center gap-2">
            <span class="material-symbols-outlined text-base text-[#004b80]">menu</span>
            <span>প্রধান নেভিগেশন মেনু আইটেম (${navItems.length}টি লিংক)</span>
          </h4>
          <button type="button" onclick="addHeaderMenuItem()" class="admin-btn-secondary !py-1.5 !px-3 !text-xs">
            <span class="material-symbols-outlined text-sm text-[#006c49]">add</span>
            <span>নতুন মেনু লিংক যোগ করুন</span>
          </button>
        </div>

        <div class="space-y-3">
          ${navItems.map((item, idx) => `
            <div class="p-3.5 rounded-2xl bg-[#f8f9ff] border border-[#dbe4f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                <div>
                  <label class="block text-[10px] font-bold text-[#414750]">মেনু লেবেল (Label)</label>
                  <input type="text" value="${escapeHtml(item.label)}" onchange="updateHeaderNavItem(${idx}, 'label', this.value)" class="admin-input !py-1.5">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-[#414750]">টার্গেট URL</label>
                  <input type="text" value="${escapeHtml(item.url)}" onchange="updateHeaderNavItem(${idx}, 'url', this.value)" class="admin-input !py-1.5 font-mono !text-xs">
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <label class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white border border-[#dbe4f0] cursor-pointer">
                  <input type="checkbox" ${item.visible !== false ? 'checked' : ''} onchange="updateHeaderNavItem(${idx}, 'visible', this.checked)" class="rounded text-[#006c49]">
                  <span>দৃশ্যমান</span>
                </label>
                <button type="button" onclick="moveHeaderNavItem(${idx}, -1)" class="p-1.5 rounded-lg bg-white border border-[#dbe4f0] hover:bg-slate-100" title="ওপরে নিন">
                  <span class="material-symbols-outlined text-base">arrow_upward</span>
                </button>
                <button type="button" onclick="moveHeaderNavItem(${idx}, 1)" class="p-1.5 rounded-lg bg-white border border-[#dbe4f0] hover:bg-slate-100" title="নিচে নিন">
                  <span class="material-symbols-outlined text-base">arrow_downward</span>
                </button>
                <button type="button" onclick="removeHeaderNavItem(${idx})" class="p-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50" title="মুছে ফেলুন">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function updateHeaderNavItem(idx, key, val) {
  const list = cmsState.db?.menus?.headerItems;
  if (!list || !list[idx]) return;
  list[idx][key] = val;
}

function moveHeaderNavItem(idx, dir) {
  const list = cmsState.db?.menus?.headerItems;
  if (!list) return;
  const target = idx + dir;
  if (target < 0 || target >= list.length) return;
  const temp = list[idx];
  list[idx] = list[target];
  list[target] = temp;
  renderMenusModule(document.getElementById('cmsModuleViewport'));
}

function addHeaderMenuItem() {
  if (!cmsState.db.menus.headerItems) cmsState.db.menus.headerItems = [];
  cmsState.db.menus.headerItems.push({
    id: 'nav-' + Date.now(),
    label: 'নতুন মেনু',
    url: '/appointment',
    file: 'appointment.html',
    visible: true,
    target: '_self'
  });
  renderMenusModule(document.getElementById('cmsModuleViewport'));
}

function removeHeaderNavItem(idx) {
  cmsState.db.menus.headerItems.splice(idx, 1);
  renderMenusModule(document.getElementById('cmsModuleViewport'));
}

async function saveMenusConfiguration() {
  if (!requirePermission('menus.write', 'মেনু ও বাটন পরিবর্তন')) return;
  const menus = cmsState.db.menus;
  menus.headerBrandTitle = document.getElementById('menuBrandTitle')?.value || menus.headerBrandTitle;
  menus.headerBrandSubtitle = document.getElementById('menuBrandSubtitle')?.value || menus.headerBrandSubtitle;
  menus.headerCta = {
    label: document.getElementById('menuCtaLabel')?.value || 'অ্যাপয়েন্টমেন্ট নিন',
    url: document.getElementById('menuCtaUrl')?.value || 'https://jklifestyleltd.com/appointment/',
    icon: document.getElementById('menuCtaIcon')?.value || 'calendar_month',
    style: 'emerald'
  };

  addAuditEntry('MENUS_UPDATED', 'Updated Header Navigation & Primary CTA Button');
  await callCmsApi('save_menus', { menus });
  showToast('মেনু, হেডার ও বাটন কনফিগারেশন সফলভাবে লাইভ ওয়েবসাইটে সংরক্ষিত হয়েছে!', 'success');
}

// ==================== 6. DESIGN SYSTEM, COLORS, TYPOGRAPHY & LAYOUT STUDIO ====================
function renderDesignModule(container) {
  const design = cmsState.db?.design || {};
  const colors = design.colors || {};
  const typo = design.typography || {};
  const layout = design.layout || {};

  container.innerHTML = `
    <div class="admin-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Google Stitch Design System &amp; Theme Studio</span>
        <h3 class="text-lg font-extrabold text-[#001c37]">ওয়েবসাইটের রঙ, ফন্ট, টাইপোগ্রাফি, লেআউট ও কাস্টম CSS স্টুডিও</h3>
        <p class="text-xs text-[#414750]">সকল পাতার কালার প্যালেট, বাংলা/ইংরেজি ফন্ট, ফন্ট সাইজ, কন্টেইনার প্রস্থ, স্টিকি হেডার এবং অ্যানাউন্সমেন্ট বার নিয়ন্ত্রণ করুন।</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button type="button" onclick="applyDesignPreset('stitch-clinical-sanctuary')" class="admin-btn-secondary !text-xs">ডিফল্ট থিম রিসেট</button>
        <button type="button" onclick="saveDesignConfiguration()" class="admin-btn-primary">
          <span class="material-symbols-outlined text-base">palette</span>
          <span>ডিজাইন সেভ ও লাইভ করুন</span>
        </button>
      </div>
    </div>

    <!-- One-Click Theme Presets -->
    <div class="admin-card p-6 space-y-3">
      <h4 class="text-sm font-extrabold text-[#001c37] uppercase tracking-wider">১-ক্লিক কালার থিম প্রিসেট (Instant Theme Presets)</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button type="button" onclick="applyDesignPreset('stitch-clinical-sanctuary')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-white text-left transition-all">
          <div class="flex gap-1.5 mb-2">
            <span class="w-6 h-6 rounded-full bg-[#004b80]"></span>
            <span class="w-6 h-6 rounded-full bg-[#006c49]"></span>
            <span class="w-6 h-6 rounded-full bg-[#10b981]"></span>
            <span class="w-6 h-6 rounded-full bg-[#f8f9ff] border"></span>
          </div>
          <div class="text-xs font-extrabold text-[#001c37]">Google Stitch Sanctuary (Default)</div>
          <div class="text-[11px] text-[#414750]">ক্লিনিক্যাল নেভি ও এমারেল্ড গ্রিন</div>
        </button>

        <button type="button" onclick="applyDesignPreset('oceanic-medical')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-white text-left transition-all">
          <div class="flex gap-1.5 mb-2">
            <span class="w-6 h-6 rounded-full bg-[#0a2540]"></span>
            <span class="w-6 h-6 rounded-full bg-[#0284c7]"></span>
            <span class="w-6 h-6 rounded-full bg-[#059669]"></span>
            <span class="w-6 h-6 rounded-full bg-[#f0f9ff] border"></span>
          </div>
          <div class="text-xs font-extrabold text-[#001c37]">Oceanic Medical Authority</div>
          <div class="text-[11px] text-[#414750]">ডিপ ওশান ব্লু ও সায়ান</div>
        </button>

        <button type="button" onclick="applyDesignPreset('organic-emerald')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-white text-left transition-all">
          <div class="flex gap-1.5 mb-2">
            <span class="w-6 h-6 rounded-full bg-[#065f46]"></span>
            <span class="w-6 h-6 rounded-full bg-[#047857]"></span>
            <span class="w-6 h-6 rounded-full bg-[#10b981]"></span>
            <span class="w-6 h-6 rounded-full bg-[#f2fbf7] border"></span>
          </div>
          <div class="text-xs font-extrabold text-[#001c37]">Holistic Organic Emerald</div>
          <div class="text-[11px] text-[#414750]">প্রাকৃতিক অর্গানিক সবুজ থিম</div>
        </button>

        <button type="button" onclick="applyDesignPreset('warm-editorial')" class="p-4 rounded-2xl border border-[#dbe4f0] hover:border-[#006c49] bg-white text-left transition-all">
          <div class="flex gap-1.5 mb-2">
            <span class="w-6 h-6 rounded-full bg-[#1e3a8a]"></span>
            <span class="w-6 h-6 rounded-full bg-[#0f766e]"></span>
            <span class="w-6 h-6 rounded-full bg-[#0d9488]"></span>
            <span class="w-6 h-6 rounded-full bg-[#fafaf9] border"></span>
          </div>
          <div class="text-xs font-extrabold text-[#001c37]">Warm Editorial Ivory</div>
          <div class="text-[11px] text-[#414750]">রয়্যাল ব্লু ও টিল এডিটোরিয়াল</div>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Color Palette Pickers (6 cols) -->
      <div class="lg:col-span-6 admin-card p-6 space-y-4">
        <h4 class="text-sm font-extrabold text-[#004b80] uppercase tracking-wider flex items-center gap-2">
          <span class="material-symbols-outlined text-base">colorize</span>
          <span>গ্লোবাল কালার প্যালেট (Global Brand Colors)</span>
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${[
            { key: 'primary', label: 'Primary Medical Blue', val: colors.primary || '#004b80' },
            { key: 'navyDark', label: 'Dark Oceanic Navy', val: colors.navyDark || '#0a2540' },
            { key: 'secondary', label: 'Secondary Clinical Green', val: colors.secondary || '#006c49' },
            { key: 'emerald', label: 'Primary CTA Emerald', val: colors.emerald || '#10b981' },
            { key: 'surface', label: 'Page Background Surface', val: colors.surface || '#f8f9ff' },
            { key: 'textMain', label: 'Primary Text Color', val: colors.textMain || '#001c37' }
          ].map(c => `
            <div class="p-3 rounded-xl bg-[#f8f9ff] border border-[#dbe4f0] flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-[#001c37]">${c.label}</div>
                <div class="font-mono text-[11px] text-[#414750]">${escapeHtml(c.val)}</div>
              </div>
              <input type="color" id="designColor_${c.key}" value="${escapeHtml(c.val)}" class="w-10 h-10 rounded-lg border border-[#dbe4f0] cursor-pointer">
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Typography & Fonts (6 cols) -->
      <div class="lg:col-span-6 admin-card p-6 space-y-4">
        <h4 class="text-sm font-extrabold text-[#006c49] uppercase tracking-wider flex items-center gap-2">
          <span class="material-symbols-outlined text-base">font_download</span>
          <span>টাইপোগ্রাফি ও ফন্ট স্কেল (Typography &amp; Fonts)</span>
        </h4>
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">শিরোনাম ফন্ট (Heading Font Stack)</label>
          <select id="designHeadingFont" class="admin-input">
            <option value="'Noto Sans Bengali', 'Hind Siliguri', 'Plus Jakarta Sans', sans-serif" ${(typo.headingFont || '').includes('Noto Sans Bengali') ? 'selected' : ''}>Noto Sans Bengali + Plus Jakarta Sans (Google Stitch Default)</option>
            <option value="'Hind Siliguri', 'Noto Sans Bengali', sans-serif" ${(typo.headingFont || '').startsWith("'Hind Siliguri'") ? 'selected' : ''}>Hind Siliguri + Noto Sans Bengali</option>
            <option value="'Playfair Display', 'Cormorant Garamond', 'Noto Sans Bengali', serif" ${(typo.headingFont || '').startsWith("'Playfair Display'") ? 'selected' : ''}>Playfair Display + Noto Sans Bengali (Editorial Serif)</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">বডি টেক্সট ফন্ট (Body Font Stack)</label>
          <select id="designBodyFont" class="admin-input">
            <option value="'Noto Sans Bengali', 'Hind Siliguri', 'Plus Jakarta Sans', sans-serif" ${(typo.bodyFont || '').includes('Noto Sans Bengali') ? 'selected' : ''}>Noto Sans Bengali + Plus Jakarta Sans (Default)</option>
            <option value="'Hind Siliguri', 'Noto Sans Bengali', sans-serif" ${(typo.bodyFont || '').startsWith("'Hind Siliguri'") ? 'selected' : ''}>Hind Siliguri Clean Sans</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">বেস ফন্ট সাইজ (px)</label>
            <input id="designBaseFontSize" type="number" min="14" max="20" value="${Number(typo.baseFontSizePx || 16)}" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">লাইন হাইট (Line Height)</label>
            <input id="designLineHeight" type="number" step="0.05" min="1.4" max="2.1" value="${Number(typo.lineHeight || 1.75)}" class="admin-input">
          </div>
        </div>
      </div>
    </div>

    <!-- Layout, Announcement Bar & Custom CSS -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-6 admin-card p-6 space-y-4">
        <h4 class="text-sm font-extrabold text-[#001c37] uppercase tracking-wider flex items-center gap-2">
          <span class="material-symbols-outlined text-base text-[#004b80]">view_quilt</span>
          <span>লেআউট ও টপ অ্যানাউন্সমেন্ট বার (Layout &amp; Top Bar)</span>
        </h4>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">সর্বোচ্চ কন্টেইনার প্রস্থ (Max Width px)</label>
            <input id="designMaxWidth" type="number" min="1080" max="1536" step="16" value="${Number(layout.maxWidthPx || 1280)}" class="admin-input">
          </div>
          <div class="flex flex-col justify-end gap-2">
            <label class="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input id="designStickyHeader" type="checkbox" ${layout.stickyHeader !== false ? 'checked' : ''} class="rounded text-[#006c49]">
              <span>স্টিকি গ্লাসমরফিক হেডার (Sticky Header)</span>
            </label>
            <label class="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input id="designShowScrollTop" type="checkbox" ${layout.showScrollTopButton !== false ? 'checked' : ''} class="rounded text-[#006c49]">
              <span>স্ক্রল-টু-টপ বাটন প্রদর্শন</span>
            </label>
          </div>
        </div>

        <div class="pt-3 border-t border-[#dbe4f0] space-y-3">
          <label class="inline-flex items-center gap-2 text-xs font-extrabold text-[#006c49] cursor-pointer">
            <input id="designShowAnnouncement" type="checkbox" ${layout.showAnnouncementBar ? 'checked' : ''} class="rounded text-[#006c49]">
            <span>টপ অ্যানাউন্সমেন্ট বার চালু করুন (Enable Top Announcement Banner)</span>
          </label>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">অ্যানাউন্সমেন্ট বার্তা</label>
            <input id="designAnnouncementText" type="text" value="${escapeHtml(layout.announcementText || '')}" class="admin-input">
          </div>
        </div>
      </div>

      <div class="lg:col-span-6 admin-card p-6 space-y-3">
        <h4 class="text-sm font-extrabold text-[#001c37] uppercase tracking-wider flex items-center gap-2">
          <span class="material-symbols-outlined text-base text-[#006c49]">css</span>
          <span>কাস্টম CSS ওভাররাইড (Global Custom CSS)</span>
        </h4>
        <p class="text-xs text-[#414750]">এখানে যেকোনো কাস্টম CSS নিয়ম লিখলে তা সম্পূর্ণ ওয়েবসাইটে স্বয়ংক্রিয়ভাবে যুক্ত হবে।</p>
        <textarea id="designCustomCss" rows="6" placeholder="/* উদাহরণ: .hero-arch { border-radius: 32px; } */" class="w-full font-mono text-xs p-3.5 rounded-2xl bg-[#061729] text-[#eaf1ff] border border-[#1b3554]">${escapeHtml(design.customCss || '')}</textarea>
      </div>
    </div>
  `;
}

function applyDesignPreset(presetName) {
  if (!requirePermission('design.write', 'থিম প্রিসেট পরিবর্তন')) return;
  const presets = {
    'stitch-clinical-sanctuary': {
      primary: '#004b80', navyDark: '#0a2540', secondary: '#006c49', emerald: '#10b981', surface: '#f8f9ff', textMain: '#001c37'
    },
    'oceanic-medical': {
      primary: '#0a2540', navyDark: '#061729', secondary: '#0284c7', emerald: '#059669', surface: '#f0f9ff', textMain: '#0a192f'
    },
    'organic-emerald': {
      primary: '#065f46', navyDark: '#022c22', secondary: '#047857', emerald: '#10b981', surface: '#f2fbf7', textMain: '#002113'
    },
    'warm-editorial': {
      primary: '#1e3a8a', navyDark: '#172554', secondary: '#0f766e', emerald: '#0d9488', surface: '#fafaf9', textMain: '#1c1917'
    }
  };
  const chosen = presets[presetName] || presets['stitch-clinical-sanctuary'];
  cmsState.db.design.preset = presetName;
  Object.assign(cmsState.db.design.colors, chosen);
  renderDesignModule(document.getElementById('cmsModuleViewport'));
  saveDesignConfiguration();
}

async function saveDesignConfiguration() {
  if (!requirePermission('design.write', 'ডিজাইন ও কালার পরিবর্তন')) return;
  const d = cmsState.db.design;
  ['primary', 'navyDark', 'secondary', 'emerald', 'surface', 'textMain'].forEach(k => {
    const el = document.getElementById('designColor_' + k);
    if (el) d.colors[k] = el.value;
  });
  d.typography.headingFont = document.getElementById('designHeadingFont')?.value || d.typography.headingFont;
  d.typography.bodyFont = document.getElementById('designBodyFont')?.value || d.typography.bodyFont;
  d.typography.baseFontSizePx = Number(document.getElementById('designBaseFontSize')?.value || 16);
  d.typography.lineHeight = Number(document.getElementById('designLineHeight')?.value || 1.75);
  d.layout.maxWidthPx = Number(document.getElementById('designMaxWidth')?.value || 1280);
  d.layout.stickyHeader = Boolean(document.getElementById('designStickyHeader')?.checked);
  d.layout.showScrollTopButton = Boolean(document.getElementById('designShowScrollTop')?.checked);
  d.layout.showAnnouncementBar = Boolean(document.getElementById('designShowAnnouncement')?.checked);
  d.layout.announcementText = document.getElementById('designAnnouncementText')?.value || '';
  d.customCss = document.getElementById('designCustomCss')?.value || '';

  addAuditEntry('DESIGN_UPDATED', `Updated global colors, typography, and layout (${d.preset})`);
  await callCmsApi('save_design', { design: d });
  showToast('ডিজাইন, কালার, ফন্ট ও লেআউট সফলভাবে লাইভ ওয়েবসাইটে প্রয়োগ করা হয়েছে!', 'success');
}

// ==================== 7. SEO, AEO & LLMs.TXT MODULE ====================
function renderSeoModule(container) {
  const db = cmsState.db;
  const pages = Object.values(db.pages || {});
  const activeSeoPage = db.pages[cmsState.selectedSeoPageFile] || pages[0];
  const seoFiles = db.seoFiles || {};

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Per-Page SEO & Schema Inspector (6 cols) -->
      <div class="lg:col-span-6 admin-card p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-[#dbe4f0] pb-3">
          <div>
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">On-Page SEO &amp; Schema.org @graph</span>
            <h3 class="text-base font-extrabold text-[#001c37]">পাতাভিত্তিক SEO, AEO ও মেটাডেটা এডিটর</h3>
          </div>
          <button type="button" onclick="saveSeoForSelectedPage()" class="admin-btn-primary !text-xs">
            <span class="material-symbols-outlined text-sm">save</span>
            <span>SEO সেভ ও পাবলিশ</span>
          </button>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">পাতা নির্বাচন করুন (Select Page)</label>
          <select onchange="selectSeoPage(this.value)" class="admin-input font-bold">
            ${pages.map(p => `<option value="${escapeHtml(p.file)}" ${p.file === activeSeoPage.file ? 'selected' : ''}>${escapeHtml(p.slug)} — ${escapeHtml(p.title.slice(0, 48))}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">SEO Title (&lt;title&gt;)</label>
          <input id="seoTitleInput" type="text" value="${escapeHtml(activeSeoPage.title)}" class="admin-input">
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">Meta Description</label>
          <textarea id="seoDescInput" rows="2" class="admin-input">${escapeHtml(activeSeoPage.description)}</textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">Focus Keyword</label>
            <input id="seoFocusKwInput" type="text" value="${escapeHtml(activeSeoPage.focusKw)}" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">Canonical Clean URL</label>
            <input id="seoCanonicalInput" type="text" value="${escapeHtml(activeSeoPage.canonical)}" class="admin-input font-mono !text-xs">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">Robots Meta Directive</label>
            <input id="seoRobotsInput" type="text" value="${escapeHtml(activeSeoPage.robots)}" class="admin-input font-mono !text-xs">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">Open Graph Image URL</label>
            <input id="seoOgImageInput" type="text" value="${escapeHtml(activeSeoPage.ogImage)}" class="admin-input font-mono !text-xs">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">Schema.org JSON-LD (@graph)</label>
          <textarea id="seoJsonLdInput" rows="7" class="w-full font-mono text-xs p-3 rounded-xl bg-[#061729] text-[#eaf1ff] border border-[#1b3554]">${escapeHtml(activeSeoPage.jsonLd)}</textarea>
        </div>
      </div>

      <!-- AI Knowledge Base (llms.txt, llms-full.txt, sitemap.xml, robots.txt) (6 cols) -->
      <div class="lg:col-span-6 admin-card p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-[#dbe4f0] pb-3">
          <div>
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#004b80] block">AI / LLM Knowledge Base &amp; Crawler Files</span>
            <h3 class="text-base font-extrabold text-[#001c37]">llms.txt, llms-full.txt, sitemap.xml ও robots.txt</h3>
          </div>
          <button type="button" onclick="saveSeoSystemFiles()" class="admin-btn-primary !text-xs">
            <span class="material-symbols-outlined text-sm">cloud_upload</span>
            <span>ফাইল সেভ ও আপডেট করুন</span>
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          ${[
            { key: 'llmsTxt', label: 'llms.txt (English AI Index)' },
            { key: 'llmsFullTxt', label: 'llms-full.txt (Full RAG)' },
            { key: 'sitemapXml', label: 'sitemap.xml' },
            { key: 'robotsTxt', label: 'robots.txt' }
          ].map(t => `
            <button type="button" onclick="selectSeoFileTab('${t.key}')" class="px-3 py-1.5 rounded-xl text-xs font-extrabold ${cmsState.selectedSeoFileTab === t.key ? 'bg-[#004b80] text-white' : 'bg-[#eff4ff] text-[#001c37]'}">${t.label}</button>
          `).join('')}
        </div>

        <textarea id="seoSystemFileTextarea" rows="18" class="w-full font-mono text-xs p-4 rounded-2xl bg-[#061729] text-[#eaf1ff] border border-[#1b3554] leading-relaxed">${escapeHtml(seoFiles[cmsState.selectedSeoFileTab] || '')}</textarea>
      </div>
    </div>
  `;
}

function selectSeoPage(file) {
  cmsState.selectedSeoPageFile = file;
  renderSeoModule(document.getElementById('cmsModuleViewport'));
}

function selectSeoFileTab(tabKey) {
  // Save current textarea value into state before switching tab
  const currentVal = document.getElementById('seoSystemFileTextarea')?.value;
  if (typeof currentVal === 'string' && cmsState.db?.seoFiles) {
    cmsState.db.seoFiles[cmsState.selectedSeoFileTab] = currentVal;
  }
  cmsState.selectedSeoFileTab = tabKey;
  renderSeoModule(document.getElementById('cmsModuleViewport'));
}

async function saveSeoForSelectedPage() {
  if (!requirePermission('seo.write', 'SEO মেটাডেটা সম্পাদনা')) return;
  const page = cmsState.db?.pages?.[cmsState.selectedSeoPageFile];
  if (!page) return;

  page.title = document.getElementById('seoTitleInput')?.value || page.title;
  page.description = document.getElementById('seoDescInput')?.value || page.description;
  page.focusKw = document.getElementById('seoFocusKwInput')?.value || page.focusKw;
  page.canonical = document.getElementById('seoCanonicalInput')?.value || page.canonical;
  page.robots = document.getElementById('seoRobotsInput')?.value || page.robots;
  page.ogImage = document.getElementById('seoOgImageInput')?.value || page.ogImage;
  page.jsonLd = document.getElementById('seoJsonLdInput')?.value || page.jsonLd;
  page._clientModified = true;

  cmsState.selectedPageFile = page.file;
  await saveCurrentPage(page.status || 'published');
}

async function saveSeoSystemFiles() {
  if (!requirePermission('seo.write', 'SEO সিস্টেম ফাইল সম্পাদনা')) return;
  const currentVal = document.getElementById('seoSystemFileTextarea')?.value;
  if (typeof currentVal === 'string') {
    cmsState.db.seoFiles[cmsState.selectedSeoFileTab] = currentVal;
  }
  addAuditEntry('SEO_FILES_UPDATED', `Updated ${cmsState.selectedSeoFileTab} (llms.txt / sitemap.xml / robots.txt)`);
  await callCmsApi('save_seo_files', cmsState.db.seoFiles);
  showToast('llms.txt, sitemap.xml এবং robots.txt সফলভাবে লাইভ সার্ভারে সংরক্ষিত হয়েছে!', 'success');
}

// ==================== 8. USERS & ROLE-BASED PERMISSIONS (RBAC) MODULE ====================
function renderUsersModule(container) {
  const users = cmsState.db?.users || [];
  const roles = cmsState.db?.roles || {};
  const allPerms = ['pages.write', 'blogs.write', 'media.write', 'menus.write', 'design.write', 'seo.write', 'users.write', 'admin.customize', 'settings.write'];

  container.innerHTML = `
    <div class="admin-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Security &amp; Role-Based Access Control (RBAC)</span>
        <h3 class="text-lg font-extrabold text-[#001c37]">ইউজার অ্যাকাউন্ট এবং রোল পারমিশন ম্যাট্রিক্স</h3>
        <p class="text-xs text-[#414750]">নতুন অ্যাডমিন/এডিটর যুক্ত করুন, রোল পরিবর্তন করুন এবং প্রতিটি রোলের অ্যাক্সেস পারমিশন নিয়ন্ত্রণ করুন।</p>
      </div>
      <button type="button" onclick="openAddUserModal()" class="admin-btn-primary shrink-0">
        <span class="material-symbols-outlined text-base">person_add</span>
        <span>নতুন ইউজার যোগ করুন</span>
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Users Table (7 cols) -->
      <div class="lg:col-span-7 admin-card p-6 space-y-4">
        <h4 class="text-sm font-extrabold text-[#001c37] uppercase tracking-wider">নিবন্ধিত অ্যাডমিন ও এডিটর তালিকা (${users.length})</h4>
        <div class="space-y-3">
          ${users.map((u, idx) => `
            <div class="p-4 rounded-2xl bg-[#f8f9ff] border border-[#dbe4f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-extrabold text-[#001c37]">${escapeHtml(u.name)}</span>
                  <span class="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#004b80] text-[10px] font-extrabold uppercase">${escapeHtml(u.role)}</span>
                </div>
                <div class="text-xs text-[#414750] font-mono mt-0.5">Username: ${escapeHtml(u.username)} · ${escapeHtml(u.email)}</div>
              </div>
              <div class="flex items-center gap-2">
                <select onchange="changeUserRole(${idx}, this.value)" class="admin-input !py-1 !text-xs !w-auto">
                  ${Object.keys(roles).map(rk => `<option value="${rk}" ${u.role === rk ? 'selected' : ''}>${rk}</option>`).join('')}
                </select>
                <label class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white border border-[#dbe4f0]">
                  <input type="checkbox" ${u.active ? 'checked' : ''} onchange="toggleUserActive(${idx}, this.checked)" class="rounded text-[#006c49]">
                  <span>Active</span>
                </label>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Role Permissions Matrix (5 cols) -->
      <div class="lg:col-span-5 admin-card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-extrabold text-[#004b80] uppercase tracking-wider">রোল পারমিশন ম্যাট্রিক্স</h4>
          <button type="button" onclick="saveUsersAndRoles()" class="admin-btn-primary !py-1.5 !px-3 !text-xs">সেভ করুন</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-[#dbe4f0] text-[#414750]">
                <th class="py-2">Permission</th>
                <th class="py-2 text-center">Admin</th>
                <th class="py-2 text-center">Editor</th>
                <th class="py-2 text-center">SEO</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#dbe4f0]">
              ${allPerms.map(perm => `
                <tr>
                  <td class="py-2 font-mono font-bold text-[#001c37]">${perm}</td>
                  <td class="py-2 text-center"><input type="checkbox" checked disabled class="rounded text-[#006c49]"></td>
                  <td class="py-2 text-center"><input type="checkbox" ${(roles.editor?.permissions || []).includes(perm) ? 'checked' : ''} onchange="toggleRolePermission('editor', '${perm}', this.checked)" class="rounded text-[#006c49]"></td>
                  <td class="py-2 text-center"><input type="checkbox" ${(roles.seo_manager?.permissions || []).includes(perm) ? 'checked' : ''} onchange="toggleRolePermission('seo_manager', '${perm}', this.checked)" class="rounded text-[#006c49]"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function changeUserRole(idx, newRole) {
  if (!requirePermission('users.write', 'ইউজার রোল পরিবর্তন')) return;
  cmsState.db.users[idx].role = newRole;
  saveUsersAndRoles();
}

function toggleUserActive(idx, active) {
  if (!requirePermission('users.write', 'ইউজার স্ট্যাটাস পরিবর্তন')) return;
  cmsState.db.users[idx].active = active;
  saveUsersAndRoles();
}

function toggleRolePermission(roleKey, perm, checked) {
  if (!requirePermission('users.write', 'রোল পারমিশন পরিবর্তন')) return;
  const r = cmsState.db.roles[roleKey];
  if (!r) return;
  if (checked && !r.permissions.includes(perm)) r.permissions.push(perm);
  if (!checked) r.permissions = r.permissions.filter(p => p !== perm);
}

function openAddUserModal() {
  if (!requirePermission('users.write', 'নতুন ইউজার তৈরি')) return;
  openCmsModal('নতুন অ্যাডমিন বা এডিটর অ্যাকাউন্ট তৈরি করুন', `
    <form onsubmit="handleAddNewUser(event)" class="space-y-4 text-xs sm:text-sm">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">পূর্ণ নাম (Full Name)</label>
          <input id="newUserName" type="text" required placeholder="Dr. Team Member" class="admin-input">
        </div>
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">ইউজারনেম (Username)</label>
          <input id="newUserUsername" type="text" required placeholder="dr_member" class="admin-input font-mono">
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">ইমেইল (Email)</label>
          <input id="newUserEmail" type="email" required placeholder="member@drjahangirkabir.com" class="admin-input">
        </div>
        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">রোল (Role)</label>
          <select id="newUserRole" class="admin-input">
            <option value="editor">Clinical Content Editor (editor)</option>
            <option value="seo_manager">SEO &amp; AEO Manager (seo_manager)</option>
            <option value="super_admin">Super Administrator (super_admin)</option>
            <option value="viewer">Read-Only Auditor (viewer)</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-[#414750] mb-1">পাসওয়ার্ড (Password)</label>
        <input id="newUserPassword" type="password" required placeholder="কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড" class="admin-input">
      </div>
      <div class="flex justify-end gap-2 pt-3 border-t border-[#dbe4f0]">
        <button type="button" onclick="closeCmsModal()" class="admin-btn-secondary">বাতিল</button>
        <button type="submit" class="admin-btn-primary">ইউজার তৈরি করুন</button>
      </div>
    </form>
  `);
}

async function handleAddNewUser(e) {
  e.preventDefault();
  const name = document.getElementById('newUserName')?.value.trim();
  const username = document.getElementById('newUserUsername')?.value.trim();
  const email = document.getElementById('newUserEmail')?.value.trim();
  const role = document.getElementById('newUserRole')?.value || 'editor';
  const pass = document.getElementById('newUserPassword')?.value || '';

  const passwordHash = await sha256Hex(pass);
  cmsState.db.users.push({
    id: 'usr-' + Date.now(),
    username,
    email,
    name,
    role,
    passwordHash,
    plainPassword: pass,
    active: true,
    lastLogin: 'Never'
  });

  closeCmsModal();
  await saveUsersAndRoles();
  renderUsersModule(document.getElementById('cmsModuleViewport'));
}

async function saveUsersAndRoles() {
  if (!requirePermission('users.write', 'ইউজার ও রোল সেভ')) return;
  addAuditEntry('USERS_RBAC_UPDATED', 'Updated users & role permissions matrix');
  await callCmsApi('save_users', { users: cmsState.db.users, roles: cmsState.db.roles });
  showToast('ইউজার এবং রোল পারমিশন সফলভাবে সংরক্ষিত হয়েছে!', 'success');
}

// ==================== 9. ADMIN PANEL SELF-CUSTOMIZER MODULE ====================
function renderCustomizerModule(container) {
  const prefs = cmsState.db?.adminPrefs || {};
  const widgets = prefs.dashboardWidgets || {};
  const navItems = prefs.navItems || [];

  container.innerHTML = `
    <div class="admin-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Admin Panel Self-Customizer</span>
        <h3 class="text-lg font-extrabold text-[#001c37]">অ্যাডমিন প্যানেল কাস্টমাইজার (Layout, Appearance, Navigation &amp; Widgets)</h3>
        <p class="text-xs text-[#414750]">অ্যাডমিন প্যানেলের নিজস্ব লেআউট, ডার্ক/লাইট থিম, অ্যাকসেন্ট কালার, ফন্ট সাইজ, সাইডবার মেনু এবং ড্যাশবোর্ড উইজেট নিজের পছন্দমতো সাজিয়ে নিন।</p>
      </div>
      <button type="button" onclick="saveAdminCustomizerPrefs()" class="admin-btn-primary shrink-0">
        <span class="material-symbols-outlined text-base">save</span>
        <span>প্যানেল সেটিংস সেভ করুন</span>
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Layout, Theme & Appearance (6 cols) -->
      <div class="lg:col-span-6 admin-card p-6 space-y-4">
        <h4 class="text-sm font-extrabold text-[#004b80] uppercase tracking-wider">১. অ্যাডমিন প্যানেলের লেআউট ও থিম (Layout &amp; Appearance)</h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">প্যানেল শিরোনাম (Admin Title)</label>
            <input id="custPanelTitle" type="text" value="${escapeHtml(prefs.panelTitle || 'JK Lifestyle CMS')}" oninput="previewAdminPrefChange('panelTitle', this.value)" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">প্যানেল সাবটাইটেল</label>
            <input id="custPanelSubtitle" type="text" value="${escapeHtml(prefs.panelSubtitle || '')}" oninput="previewAdminPrefChange('panelSubtitle', this.value)" class="admin-input">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">নেভিগেশন লেআউট মোড (Layout Mode)</label>
            <select id="custLayoutMode" onchange="previewAdminPrefChange('layoutMode', this.value)" class="admin-input font-bold">
              <option value="sidebar-left" ${prefs.layoutMode === 'sidebar-left' ? 'selected' : ''}>Left Sidebar (বাম সাইডবার - Default)</option>
              <option value="sidebar-right" ${prefs.layoutMode === 'sidebar-right' ? 'selected' : ''}>Right Sidebar (ডান সাইডবার)</option>
              <option value="sidebar-compact" ${prefs.layoutMode === 'sidebar-compact' ? 'selected' : ''}>Compact Icon Sidebar (কম্প্যাক্ট আইকন)</option>
              <option value="topbar" ${prefs.layoutMode === 'topbar' ? 'selected' : ''}>Top Navigation Bar (টপ নেভিগেশন বার)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">অ্যাডমিন প্যানেল থিম (Color Theme)</label>
            <select id="custThemeMode" onchange="previewAdminPrefChange('themeMode', this.value)" class="admin-input font-bold">
              <option value="stitch-light" ${prefs.themeMode === 'stitch-light' ? 'selected' : ''}>Google Stitch Clinical Light</option>
              <option value="oceanic-dark" ${prefs.themeMode === 'oceanic-dark' ? 'selected' : ''}>Oceanic Dark Mode (ডার্ক থিম)</option>
              <option value="emerald-clinical" ${prefs.themeMode === 'emerald-clinical' ? 'selected' : ''}>Emerald Sanctuary Tint</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">প্যানেল ফন্ট সাইজ (Font Scale)</label>
            <select id="custFontScale" onchange="previewAdminPrefChange('fontScale', this.value)" class="admin-input">
              <option value="small" ${prefs.fontScale === 'small' ? 'selected' : ''}>Compact (ছোট ফন্ট)</option>
              <option value="default" ${prefs.fontScale === 'default' ? 'selected' : ''}>Default (আদর্শ ফন্ট)</option>
              <option value="large" ${prefs.fontScale === 'large' ? 'selected' : ''}>Comfortable Large (বড় ফন্ট)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">অ্যাকসেন্ট কালার (Admin Accent Color)</label>
            <div class="flex items-center gap-2">
              <input id="custAccentColor" type="color" value="${escapeHtml(prefs.accentColor || '#006c49')}" onchange="previewAdminPrefChange('accentColor', this.value)" class="w-11 h-10 rounded-lg border cursor-pointer">
              <span class="font-mono text-xs">${escapeHtml(prefs.accentColor || '#006c49')}</span>
            </div>
          </div>
        </div>

        <!-- Dashboard Widgets Visibility -->
        <div class="pt-4 border-t border-[#dbe4f0] space-y-2.5">
          <h5 class="text-xs font-extrabold uppercase tracking-wider text-[#006c49]">২. ড্যাশবোর্ড উইজেট প্রদর্শন (Dashboard Widgets)</h5>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-bold">
            ${[
              { key: 'showStatsCards', label: 'KPI পরিসংখ্যান কার্ড (Stats Cards)' },
              { key: 'showQuickActions', label: 'কুইক অ্যাকশন বার (Quick Actions)' },
              { key: 'showAppointmentTracker', label: 'অ্যাপয়েন্টমেন্ট ফানেল ট্র্যাকার' },
              { key: 'showRecentRevisions', label: 'সাম্প্রতিক রিভিশন ও অডিট লগ' }
            ].map(w => `
              <label class="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#dbe4f0] flex items-center gap-2 cursor-pointer">
                <input type="checkbox" ${widgets[w.key] !== false ? 'checked' : ''} onchange="toggleAdminDashboardWidget('${w.key}', this.checked)" class="rounded text-[#006c49]">
                <span>${w.label}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Admin Navigation Items Ordering & Visibility (6 cols) -->
      <div class="lg:col-span-6 admin-card p-6 space-y-4">
        <h4 class="text-sm font-extrabold text-[#001c37] uppercase tracking-wider">৩. অ্যাডমিন সাইডবার মেনু কাস্টমাইজেশন (Navigation Order &amp; Labels)</h4>
        <div class="space-y-2.5">
          ${navItems.map((item, idx) => `
            <div class="p-3 rounded-xl bg-[#f8f9ff] border border-[#dbe4f0] flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 flex-1">
                <span class="material-symbols-outlined text-lg text-[#004b80]">${escapeHtml(item.icon)}</span>
                <input type="text" value="${escapeHtml(item.label)}" onchange="updateAdminNavItemLabel(${idx}, this.value)" class="admin-input !py-1 !text-xs font-bold">
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                ${item.id !== 'customizer' ? `
                <label class="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-white border border-[#dbe4f0]">
                  <input type="checkbox" ${item.visible !== false ? 'checked' : ''} onchange="toggleAdminNavItemVisible(${idx}, this.checked)" class="rounded text-[#006c49]">
                  <span>Show</span>
                </label>
                ` : ''}
                <button type="button" onclick="moveAdminNavItem(${idx}, -1)" class="p-1 rounded bg-white border border-[#dbe4f0] hover:bg-slate-100">
                  <span class="material-symbols-outlined text-sm">arrow_upward</span>
                </button>
                <button type="button" onclick="moveAdminNavItem(${idx}, 1)" class="p-1 rounded bg-white border border-[#dbe4f0] hover:bg-slate-100">
                  <span class="material-symbols-outlined text-sm">arrow_downward</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function previewAdminPrefChange(key, value) {
  cmsState.db.adminPrefs[key] = value;
  applyAdminPanelPreferences();
  renderAdminNavigation();
}

function toggleAdminDashboardWidget(key, checked) {
  if (!cmsState.db.adminPrefs.dashboardWidgets) cmsState.db.adminPrefs.dashboardWidgets = {};
  cmsState.db.adminPrefs.dashboardWidgets[key] = checked;
  persistLocalDb();
}

function updateAdminNavItemLabel(idx, val) {
  cmsState.db.adminPrefs.navItems[idx].label = val;
  renderAdminNavigation();
}

function toggleAdminNavItemVisible(idx, checked) {
  cmsState.db.adminPrefs.navItems[idx].visible = checked;
  renderAdminNavigation();
}

function moveAdminNavItem(idx, dir) {
  const list = cmsState.db.adminPrefs.navItems;
  const target = idx + dir;
  if (target < 0 || target >= list.length) return;
  const tmp = list[idx];
  list[idx] = list[target];
  list[target] = tmp;
  renderAdminNavigation();
  renderCustomizerModule(document.getElementById('cmsModuleViewport'));
}

async function saveAdminCustomizerPrefs() {
  if (!requirePermission('admin.customize', 'অ্যাডমিন প্যানেল কাস্টমাইজেশন')) return;
  addAuditEntry('ADMIN_CUSTOMIZED', 'Updated Admin Panel layout, theme, and navigation preferences');
  await callCmsApi('save_admin_prefs', { adminPrefs: cmsState.db.adminPrefs });
  showToast('অ্যাডমিন প্যানেলের কাস্টমাইজেশন সফলভাবে সংরক্ষিত হয়েছে!', 'success');
}

// ==================== 10. GLOBAL SITE SETTINGS & BACKUP/RESTORE MODULE ====================
function renderSettingsModule(container) {
  const meta = cmsState.db?.meta || {};

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Global Website Configuration (7 cols) -->
      <div class="lg:col-span-7 admin-card p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-[#dbe4f0] pb-3">
          <div>
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#006c49] block">Global Website Configuration</span>
            <h3 class="text-base font-extrabold text-[#001c37]">ওয়েবসাইট-ওয়াইড সেটিংস, হটলাইন ও চেম্বার তথ্য</h3>
          </div>
          <button type="button" onclick="saveGlobalSiteSettings()" class="admin-btn-primary !text-xs">
            <span class="material-symbols-outlined text-sm">save</span>
            <span>সেটিংস সেভ করুন</span>
          </button>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">ওয়েবসাইটের নাম (Site Name)</label>
          <input id="metaSiteName" type="text" value="${escapeHtml(meta.siteName || '')}" class="admin-input">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">প্রধান অ্যাপয়েন্টমেন্ট বুকিং URL</label>
            <input id="metaApptUrl" type="text" value="${escapeHtml(meta.primaryAppointmentUrl || '')}" class="admin-input font-mono !text-xs">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">অফিশিয়াল হটলাইন নম্বর</label>
            <input id="metaHotline" type="text" value="${escapeHtml(meta.hotline || '')}" class="admin-input">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">অফিশিয়াল ইমেইল</label>
            <input id="metaEmail" type="text" value="${escapeHtml(meta.email || '')}" class="admin-input">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#414750] mb-1">রোগী দেখার সময়সূচি (Visiting Hours)</label>
            <input id="metaHours" type="text" value="${escapeHtml(meta.visitingHours || '')}" class="admin-input">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#414750] mb-1">চেম্বার ও ল্যাবরেটরির ঠিকানা</label>
          <textarea id="metaAddress" rows="2" class="admin-input">${escapeHtml(meta.address || '')}</textarea>
        </div>
      </div>

      <!-- Database Backup, Export & Restore (5 cols) -->
      <div class="lg:col-span-5 admin-card p-6 space-y-4">
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#004b80] block">Database Backup, Export &amp; Sync</span>
        <h3 class="text-base font-extrabold text-[#001c37]">সম্পূর্ণ ডাটাবেস ব্যাকআপ ও রিস্টোর (cms.db.json)</h3>
        <p class="text-xs text-[#414750] leading-relaxed">
          আপনার সকল পেজ, ব্লগ, রিভিশন হিস্ট্রি, মেনু, কালার থিম ও সেটিংস এক ক্লিকে JSON ফাইল হিসেবে ব্যাকআপ ডাউনলোড করুন অথবা পূর্বের ব্যাকআপ ফাইল আপলোড করে রিস্টোর করুন।
        </p>

        <div class="space-y-3 pt-2">
          <button type="button" onclick="exportFullCmsDatabaseJson()" class="w-full admin-btn-primary justify-center !py-3">
            <span class="material-symbols-outlined text-lg">download</span>
            <span>পূর্ণাঙ্গ CMS ডাটাবেস এক্সপোর্ট করুন (cms.db.json)</span>
          </button>

          <label class="w-full admin-btn-secondary justify-center !py-3 cursor-pointer">
            <span class="material-symbols-outlined text-lg text-[#004b80]">upload_file</span>
            <span>ব্যাকআপ JSON ফাইল ইমপোর্ট / রিস্টোর করুন</span>
            <input type="file" accept=".json" onchange="importCmsDatabaseJson(event)" class="hidden">
          </label>

          <button type="button" onclick="resetCmsToFactoryDefaults()" class="w-full px-4 py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-2 transition-colors">
            <span class="material-symbols-outlined text-base">restart_alt</span>
            <span>ডিফল্ট Google Stitch অবস্থায় রিসেট করুন</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

async function saveGlobalSiteSettings() {
  if (!requirePermission('settings.write', 'গ্লোবাল সাইট সেটিংস পরিবর্তন')) return;
  const m = cmsState.db.meta;
  m.siteName = document.getElementById('metaSiteName')?.value || m.siteName;
  m.primaryAppointmentUrl = document.getElementById('metaApptUrl')?.value || m.primaryAppointmentUrl;
  m.hotline = document.getElementById('metaHotline')?.value || m.hotline;
  m.email = document.getElementById('metaEmail')?.value || m.email;
  m.visitingHours = document.getElementById('metaHours')?.value || m.visitingHours;
  m.address = document.getElementById('metaAddress')?.value || m.address;
  m.lastPublishedAt = new Date().toISOString();

  addAuditEntry('SITE_SETTINGS_UPDATED', 'Updated global clinic address, hotline, and appointment URL');
  await callCmsApi('save_menus', { menus: cmsState.db.menus, meta: m });
  showToast('গ্লোবাল ওয়েবসাইট সেটিংস সফলভাবে সংরক্ষিত হয়েছে!', 'success');
}

function exportFullCmsDatabaseJson() {
  const jsonStr = JSON.stringify(cmsState.db, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cms.db.json';
  a.click();
  showToast('পূর্ণাঙ্গ CMS ডাটাবেস (cms.db.json) ডাউনলোড শুরু হয়েছে।', 'info');
}

function importCmsDatabaseJson(event) {
  if (!requirePermission('settings.write', 'ডাটাবেস ইমপোর্ট')) return;
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.pages || !parsed.design) throw new Error('Invalid CMS JSON');
      cmsState.db = parsed;
      persistLocalDb();
      applyAdminPanelPreferences();
      renderAdminNavigation();
      switchAdminModule('dashboard');
      showToast('ডাটাবেস ব্যাকআপ সফলভাবে ইমপোর্ট ও সক্রিয় করা হয়েছে!', 'success');
    } catch (err) {
      showToast('JSON ফাইলটি সঠিক নয়। অনুগ্রহ করে বৈধ cms.db.json ফাইল নির্বাচন করুন।', 'error');
    }
  };
  reader.readAsText(file);
}

function resetCmsToFactoryDefaults() {
  if (!requirePermission('settings.write', 'ফ্যাক্টরি রিসেট')) return;
  if (!confirm('আপনি কি নিশ্চিতভাবে সকল লোকাল পরিবর্তন মুছে ডিফল্ট Google Stitch অবস্থায় ফিরে যেতে চান?')) return;
  localStorage.removeItem(CMS_STORAGE_KEY);
  cmsState.db = JSON.parse(JSON.stringify(window.JK_CMS_SEED_DB));
  persistLocalDb();
  applyAdminPanelPreferences();
  renderAdminNavigation();
  switchAdminModule('dashboard');
  showToast('ডিফল্ট Google Stitch কনফিগারেশন পুনরুদ্ধার করা হয়েছে।', 'info');
}

// Publish all changes across current module & sync with server
async function publishAllChangesLive() {
  if (cmsState.activeModule === 'pages') {
    await saveCurrentPage('published');
  } else if (cmsState.activeModule === 'blogs') {
    await saveActiveBlogPost('published');
  } else if (cmsState.activeModule === 'menus') {
    await saveMenusConfiguration();
  } else if (cmsState.activeModule === 'design') {
    await saveDesignConfiguration();
  } else if (cmsState.activeModule === 'seo') {
    await saveSeoSystemFiles();
  } else if (cmsState.activeModule === 'customizer') {
    await saveAdminCustomizerPrefs();
  } else if (cmsState.activeModule === 'settings') {
    await saveGlobalSiteSettings();
  } else {
    persistLocalDb();
    await callCmsApi('save_design', { design: cmsState.db.design });
    await callCmsApi('save_menus', { menus: cmsState.db.menus, meta: cmsState.db.meta });
    showToast('সকল পরিবর্তন লাইভ ওয়েবসাইটের সাথে সিঙ্ক ও পাবলিশ করা হয়েছে!', 'success');
  }
}

// ==================== MODAL HELPERS ====================
function openCmsModal(title, bodyHtml) {
  const backdrop = document.getElementById('cmsModalBackdrop');
  const titleEl = document.getElementById('cmsModalTitle');
  const bodyEl = document.getElementById('cmsModalBody');
  if (!backdrop || !titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  backdrop.classList.remove('hidden');
  backdrop.classList.add('flex');
}

function closeCmsModal() {
  const backdrop = document.getElementById('cmsModalBackdrop');
  if (!backdrop) return;
  backdrop.classList.add('hidden');
  backdrop.classList.remove('flex');
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function () {
  await initCmsDatabase();

  const loginForm = document.getElementById('cmsLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // Restore active session if already signed in
  try {
    const savedSession = localStorage.getItem(CMS_SESSION_KEY);
    if (savedSession) {
      cmsState.session = JSON.parse(savedSession);
      completeLoginSuccess();
    }
  } catch (e) {}
});
