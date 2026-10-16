/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Core Application Engine & Router (v3)
   Quiet Professional Dark Architecture with Global Command Palette
   ══════════════════════════════════════════════════════════════════ */

import { getUser, getToken, signOut } from './auth.js';
import { renderToday } from './pages/today.js';
import { renderLibrary } from './pages/library.js';
import { renderLectureDetail } from './pages/lecture_detail.js';
import { renderImport } from './pages/import.js';
import { cleanupReview, renderReview } from './pages/review.js';
import { cleanupPractice, renderPractice } from './pages/practice.js';
import { renderInsights } from './pages/insights.js';
import { renderSettings } from './pages/settings.js';
import { renderLogin } from './pages/login.js';
import { initMotion, cleanupMotion, reducedMotion } from './motion.js';

let _cachedDue = null;
let _lastDueFetch = 0;
let _cachedCourses = null;
let _currentLectureContext = null;

// Legacy Bookmark Route Mapping
const LEGACY_ROUTES = {
  'dashboard': 'today',
  'browse': 'library',
  'add-video': 'import',
  'flashcards': 'review?src=flashcards',
  'daily-review': 'review?src=due',
  'quiz': 'practice',
  'stats': 'insights',
  'manage': 'library',
};

// ── 1. API Client ────────────────────────────────────────────────
export const API = {
  async req(method, path, body = null) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
  get(path)        { return this.req('GET', path); },
  post(path, body) { return this.req('POST', path, body); },
  put(path, body)  { return this.req('PUT', path, body); },
  del(path)        { return this.req('DELETE', path); },
};

// ── 2. Parameterized Router ──────────────────────────────────────
let navigationQueue = Promise.resolve();
let navigationVersion = 0;
export function navigate(rawRoute) {
  const version = ++navigationVersion;
  const route = rawRoute || window.location.hash.slice(1) || 'today';
  navigationQueue = navigationQueue.catch(() => {}).then(() => {
    if (version !== navigationVersion) return;
    return performNavigate(route);
  });
  return navigationQueue;
}

async function performNavigate(rawRoute) {
  let routeStr = (rawRoute || window.location.hash.slice(1) || 'today').trim();
  if (routeStr.startsWith('/')) routeStr = routeStr.slice(1);
  if (routeStr.startsWith('#')) routeStr = routeStr.slice(1);

  // Parse path and query parameters
  const [pathPart, queryPart] = routeStr.split('?');
  const params = new URLSearchParams(queryPart || '');
  const segments = pathPart.split('/').filter(Boolean);
  const primary = segments[0] || 'today';

  // Legacy route redirections
  if (LEGACY_ROUTES[primary]) {
    const target = LEGACY_ROUTES[primary];
    return performNavigate(target);
  }

  const user = getUser();
  if (!user && primary !== 'login') {
    return performNavigate('login');
  }

  // Update URL Hash cleanly
  if (window.location.hash.slice(1) !== routeStr) history.pushState(null, '', '#' + routeStr);
  document.body.dataset.route = primary;

  // Auto-close mobile drawer on navigation
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
  document.getElementById('mobile-menu-btn')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');

  // Determine focused mode (Review and active practice drill)
  const isFocused = primary === 'review' || (primary === 'practice' && segments[1] === 'session');
  document.body.classList.toggle('mode-focused', isFocused);

  // Update Topbar and Sidebar active navigation
  updateNav(primary, routeStr);
  updateBreadcrumbs(primary, segments, params);

  const container = document.getElementById('page-content');
  if (!container) return;

  cleanupReview();
  cleanupPractice();
  cleanupMotion();
  if (primary !== 'lecture') _currentLectureContext = null;
  container.classList.remove('page-enter');
  container.setAttribute('aria-busy', 'true');
  window.scrollTo({ top: 0, behavior: 'instant' });
  const renderView = async render => {
    let work;
    const mount = () => {
      container.innerHTML = '';
      work = render();
      initMotion(container);
      container.classList.add('page-enter');
    };
    if (document.startViewTransition && !reducedMotion()) {
      const transition = document.startViewTransition(mount);
      transition.ready.catch(() => {});
      transition.finished.catch(() => {});
      await transition.updateCallbackDone;
    } else mount();
    await work;
  };

  try {
    if (primary === 'login') {
      await renderView(() => renderLogin(container));
    } else if (primary === 'today') {
      await renderView(() => renderToday(container));
    } else if (primary === 'library') {
      const courseId = segments[1] || null;
      await renderView(() => renderLibrary(container, { courseId }));
    } else if (primary === 'lecture') {
      const lectureId = segments[1];
      await renderView(() => renderLectureDetail(container, { lectureId }));
    } else if (primary === 'import') {
      await renderView(() => renderImport(container));
    } else if (primary === 'review') {
      const src = params.get('src') || 'due';
      await renderView(() => renderReview(container, { src }));
    } else if (primary === 'practice') {
      await renderView(() => renderPractice(container, { subpath: segments[1], id: segments[2], scope: params.get('scope'), scopeId: params.get('id') }));
    } else if (primary === 'insights') {
      await renderView(() => renderInsights(container));
    } else if (primary === 'settings') {
      await renderView(() => renderSettings(container));
    } else {
      await renderView(() => renderToday(container));
    }
  } catch (err) {
    console.error(`Route render error on "${routeStr}":`, err);
    container.innerHTML = `
      <div class="card empty-state" style="margin-top:40px">
        <div class="icon-tile danger" style="width:40px;height:40px">
          <svg style="width:20px;height:20px"><use href="#i-help-circle"/></svg>
        </div>
        <div class="empty-state-title">Failed to load view</div>
        <div class="empty-state-desc">${escapeHtml(err.message || 'An unexpected rendering error occurred.')}</div>
        <button class="btn btn-secondary btn-sm" onclick="window.navigate('today')">
          <span>Return to Today</span>
        </button>
      </div>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
    if (primary !== 'login') updateGlobalMetrics();
  }
}

window.navigate = navigate;

// ── 3. Shell State & Navigation Sync ─────────────────────────────
function updateNav(primary, routeStr) {
  const isFlashcardRoute = primary === 'review' && /src=(flashcards|deck:|course:)/.test(routeStr || '');
  const activeRouteKey = isFlashcardRoute ? 'flashcards' : primary;
  document.querySelectorAll('.nav-item').forEach(el => {
    const routeAttr = el.dataset.route;
    el.classList.toggle('active', routeAttr === activeRouteKey);
    if (routeAttr === activeRouteKey) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
    el.title = el.querySelector('.nav-label')?.textContent || primary;
  });

  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  const isAuth = primary !== 'login';

  if (sidebar) sidebar.style.display = isAuth ? 'flex' : 'none';
  if (topbar) topbar.style.display = isAuth ? 'flex' : 'none';
}

function updateBreadcrumbs(primary, segments, params) {
  const wrap = document.getElementById('topbar-breadcrumbs');
  if (!wrap) return;

  const crumbs = [];
  if (primary === 'today') {
    crumbs.push('<span class="breadcrumb-item active">Today</span>');
  } else if (primary === 'library') {
    crumbs.push('<a href="#library" class="breadcrumb-item">Library</a>');
    if (segments[1]) {
      crumbs.push('<span class="breadcrumb-sep">/</span><span class="breadcrumb-item active">Course</span>');
    }
  } else if (primary === 'lecture') {
    crumbs.push('<a href="#library" class="breadcrumb-item">Library</a>');
    crumbs.push('<span class="breadcrumb-sep">/</span><span class="breadcrumb-item active">Lecture</span>');
  } else if (primary === 'import') {
    crumbs.push('<span class="breadcrumb-item active">Import lecture</span>');
  } else if (primary === 'review') {
    const src = params?.get('src') || 'due';
    const isFlashcards = src === 'flashcards' || src.startsWith('deck:') || src.startsWith('course:');
    crumbs.push('<a href="#today" class="breadcrumb-item">Study</a>');
    crumbs.push(`<span class="breadcrumb-sep">/</span><span class="breadcrumb-item active">${isFlashcards ? 'Flashcards' : 'Review Session'}</span>`);
  } else if (primary === 'practice') {
    crumbs.push('<a href="#today" class="breadcrumb-item">Study</a>');
    crumbs.push('<span class="breadcrumb-sep">/</span><span class="breadcrumb-item active">Practice Hub</span>');
  } else if (primary === 'insights') {
    crumbs.push('<span class="breadcrumb-item active">Learning insights</span>');
  } else if (primary === 'settings') {
    crumbs.push('<span class="breadcrumb-item active">Settings</span>');
  }

  wrap.innerHTML = crumbs.join(' ');
}

export function setLectureContext(lecture) {
  _currentLectureContext = lecture;
}

// ── 4. Global Metrics & Dynamic Sidebar Courses ──────────────────
export async function getDueCount() {
  const now = Date.now();
  if (_cachedDue !== null && (now - _lastDueFetch) < 15000) {
    return _cachedDue;
  }
  try {
    const data = await API.get('/api/review/due?limit=1');
    _cachedDue = data?.due_count ?? (Array.isArray(data) ? data.length : (data?.questions ? data.questions.length : 0));
    _lastDueFetch = now;
    return _cachedDue;
  } catch {
    return 0;
  }
}

export function invalidateDueCount() {
  _cachedDue = null;
  _lastDueFetch = 0;
}

export async function updateGlobalMetrics() {
  try {
    const due = await getDueCount();
    const topDue = document.getElementById('top-due-count');
    const sideDue = document.getElementById('side-due-num');
    const sideBadge = document.getElementById('side-review-badge');

    if (topDue) topDue.textContent = due;
    if (sideDue) sideDue.textContent = due;
    if (sideBadge) sideBadge.style.display = due > 0 ? 'inline-flex' : 'none';

    const goal = DailyGoal.get();
    const goalValue = document.getElementById('side-goal-value');
    const goalFill = document.getElementById('side-goal-fill');
    const goalNote = document.getElementById('side-goal-note');
    if (goalValue) goalValue.textContent = `${goal.progress} / ${goal.target}`;
    if (goalFill) goalFill.style.width = `${Math.min(100,goal.progress/goal.target*100)}%`;
    if (goalNote) goalNote.textContent = goal.progress >= goal.target ? 'Target complete' : `${goal.target-goal.progress} cards remaining`;

    // Update Streak
    const streak = Streak.get();
    const topStreak = document.getElementById('top-streak-num');
    const sideStreak = document.getElementById('side-user-streak');
    if (topStreak) topStreak.textContent = `${streak.count}d`;
    if (sideStreak) sideStreak.textContent = `${streak.count} day streak`;

    // Load top courses into sidebar if not loaded
    loadSidebarCourses();
  } catch { /**/ }
}

async function loadSidebarCourses() {
  const container = document.getElementById('side-courses-list');
  if (!container) return;

  try {
    if (!_cachedCourses) {
      _cachedCourses = await API.get('/api/courses');
    }
    const top6 = (_cachedCourses || []).slice(0, 6);
    if (!top6.length) {
      container.innerHTML = `<div style="font-size:11.5px;color:var(--txt-3);padding:4px 10px">No courses yet</div>`;
      return;
    }

    container.innerHTML = top6.map(c => `
      <a class="side-course-item" href="#library/${c.id}">
        <span class="side-course-name">${c.name}</span>
        <span class="side-course-count">${c.question_count || 0}</span>
      </a>
    `).join('');
  } catch { /**/ }
}

export function invalidateCoursesCache() {
  _cachedCourses = null;
  loadSidebarCourses();
}

// ── 5. Global Command Palette (`⌘K` / `Ctrl+K`) ───────────────────
function initCommandPalette() {
  const backdrop = document.getElementById('cmd-palette-backdrop');
  const input = document.getElementById('cmd-palette-input');
  const results = document.getElementById('cmd-palette-results');
  const trigger = document.getElementById('cmd-search-btn');

  if (!backdrop || !input || !results) return;

  const ACTIONS = [
    { title: 'Start Due Review', meta: 'Study queue', route: 'review?src=due', icon: 'rotate-cw' },
    { title: 'Study Flashcards', meta: 'Basic concept cards', route: 'review?src=flashcards', icon: 'layers' },
    { title: 'Practice Hub & Exam', meta: 'Active drill', route: 'practice', icon: 'brain-circuit' },
    { title: 'Import Video Lecture', meta: 'Create study materials', route: 'import', icon: 'download-cloud' },
    { title: 'Browse Course Library', meta: 'All lectures & cards', route: 'library', icon: 'library' },
    { title: 'Learning Insights & Telemetry', meta: 'Analytics', route: 'insights', icon: 'bar-chart-3' },
    { title: 'Account Settings', meta: 'Preferences', route: 'settings', icon: 'settings-2' },
  ];

  let paletteReturnFocus = null;
  let activeIndex = 0;
  let currentItems = [];

  function openPalette() {
    paletteReturnFocus = document.activeElement;
    backdrop.classList.add('active');
    input.value = '';
    renderResults('');
    setTimeout(() => input.focus(), 50);
  }

  function closePalette() {
    backdrop.classList.remove('active');
    paletteReturnFocus?.focus();
  }

  async function renderResults(query = '') {
    const q = query.toLowerCase().trim();
    currentItems = [];

    // 1. Actions
    const matchingActions = ACTIONS.filter(a => a.title.toLowerCase().includes(q) || a.meta.toLowerCase().includes(q));
    
    // 2. Courses & Lectures Search
    let matchingCourses = [];
    let matchingVideos = [];

    if (_cachedCourses) {
      matchingCourses = _cachedCourses.filter(c => c.name.toLowerCase().includes(q)).slice(0, 4);
      _cachedCourses.forEach(c => {
        (c.videos || []).forEach(v => {
          if (v.title.toLowerCase().includes(q)) {
            matchingVideos.push({ ...v, courseName: c.name });
          }
        });
      });
      matchingVideos = matchingVideos.slice(0, 6);
    }

    let html = '';

    if (matchingActions.length) {
      html += `<div class="palette-group-label">Quick Actions</div>`;
      matchingActions.forEach(a => {
        const idx = currentItems.length;
        currentItems.push({ type: 'route', route: a.route });
        html += `
          <div class="palette-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
            <div style="display:flex;align-items:center;gap:10px">
              <svg style="width:14px;height:14px;color:var(--acc-400)"><use href="#i-${a.icon}"/></svg>
              <span>${a.title}</span>
            </div>
            <span class="caption-text">${a.meta}</span>
          </div>`;
      });
    }

    if (matchingCourses.length) {
      html += `<div class="palette-group-label">Courses</div>`;
      matchingCourses.forEach(c => {
        const idx = currentItems.length;
        currentItems.push({ type: 'route', route: `library/${c.id}` });
        html += `
          <div class="palette-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
            <div style="display:flex;align-items:center;gap:10px">
              <svg style="width:14px;height:14px;color:var(--txt-3)"><use href="#i-book-open"/></svg>
              <span>${c.name}</span>
            </div>
            <span class="caption-text mono">${c.video_count || 0} lectures</span>
          </div>`;
      });
    }

    if (matchingVideos.length) {
      html += `<div class="palette-group-label">Lectures</div>`;
      matchingVideos.forEach(v => {
        const idx = currentItems.length;
        currentItems.push({ type: 'route', route: `lecture/${v.id}` });
        html += `
          <div class="palette-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
            <div style="display:flex;align-items:center;gap:10px">
              <svg style="width:14px;height:14px;color:var(--txt-3)"><use href="#i-video"/></svg>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px">${v.title}</span>
            </div>
            <span class="caption-text">${v.courseName}</span>
          </div>`;
      });
    }

    if (!currentItems.length) {
      html = `<div style="padding:20px;text-align:center;font-size:13px;color:var(--txt-3)">No matching results found</div>`;
    }

    results.innerHTML = html;
    activeIndex = 0;

    results.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        executeItem(currentItems[idx]);
      });
    });
  }

  function executeItem(item) {
    if (!item) return;
    closePalette();
    if (item.type === 'route') {
      navigate(item.route);
    }
  }

  input.addEventListener('input', e => renderResults(e.target.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      highlightActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(currentItems[activeIndex]);
    } else if (e.key === 'Escape') {
      closePalette();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      input.focus();
    }
  });

  function highlightActive() {
    results.querySelectorAll('.palette-item').forEach((el, idx) => {
      el.classList.toggle('selected', idx === activeIndex);
    });
  }

  trigger?.addEventListener('click', openPalette);
  backdrop?.addEventListener('click', e => {
    if (e.target === backdrop) closePalette();
  });

  window.openCommandPalette = openPalette;
  window.closeCommandPalette = closePalette;
}

// ── 6. Global AI Assistant Drawer ────────────────────────────────
function initAiDrawer() {
  const drawer = document.getElementById('ai-drawer');
  const trigger = document.getElementById('top-assistant-btn');
  const closeBtn = document.getElementById('ai-drawer-close');
  const input = document.getElementById('ai-drawer-input');
  const sendBtn = document.getElementById('ai-drawer-send');
  const msgs = document.getElementById('ai-drawer-msgs');

  if (!drawer) return;

  function toggleDrawer(open) {
    drawer.classList.toggle('open', open !== undefined ? open : !drawer.classList.contains('open'));
    if (drawer.classList.contains('open') && input) {
      input.focus();
    }
  }

  trigger?.addEventListener('click', () => toggleDrawer());
  closeBtn?.addEventListener('click', () => toggleDrawer(false));

  async function handleSend(text) {
    const query = (text || input.value || '').trim();
    if (!_currentLectureContext?.id) { showToast('Open a lecture first so your tutor has its context.', 'info'); return; }
    if (!query) return;

    input.value = '';
    const userMsg = document.createElement('div');
    userMsg.className = 'drawer-bubble user';
    userMsg.textContent = query;
    msgs.appendChild(userMsg);
    msgs.scrollTop = msgs.scrollHeight;

    const aiMsg = document.createElement('div');
    aiMsg.className = 'drawer-bubble ai';
    aiMsg.textContent = 'Analyzing concept…';
    msgs.appendChild(aiMsg);
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const res = await API.post('/api/ask', { question: query, video_id: _currentLectureContext.id });
      aiMsg.textContent = res.answer || 'No answer returned. Try asking again.';
    } catch {
      aiMsg.textContent = 'Here to assist. Connect your Gemini API key in configuration for full multi-turn synthesis.';
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  sendBtn?.addEventListener('click', () => handleSend());
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSend();
  });

  window.sendTutorPrompt = (text) => {
    toggleDrawer(true);
    handleSend(text);
  };
}

// ── 7. Global Keyboard Shortcuts ─────────────────────────────────
function initGlobalKeyboard() {
  let gPrefix = false;

  window.addEventListener('keydown', e => {
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    // ⌘K or Ctrl+K -> Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.openCommandPalette?.();
      return;
    }

    // ⌘\ or Ctrl+\ -> Toggle Sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault();
      toggleSidebarCollapse();
      return;
    }

    // ESC closes active overlays
    if (e.key === 'Escape') {
      if (document.querySelector('dialog[open]')) return;
      const hadOverlay = !!document.querySelector('.palette-backdrop.active,#ai-drawer.open,#sidebar.mobile-open');
      window.closeCommandPalette?.();
      document.getElementById('shortcuts-backdrop')?.classList.remove('active');
      document.getElementById('ai-drawer')?.classList.remove('open');
      document.getElementById('sidebar')?.classList.remove('mobile-open');
      document.getElementById('mobile-overlay')?.classList.remove('active');
      document.body.classList.remove('nav-open');
      document.getElementById('mobile-menu-btn')?.setAttribute('aria-expanded', 'false');
      if (!hadOverlay && document.body.classList.contains('mode-focused')) navigate(document.body.dataset.sessionKind === 'practice' ? 'practice' : 'today');
      return;
    }

    if (isTyping) return;

    // ? -> Open Shortcuts Sheet
    if (e.key === '?') {
      e.preventDefault();
      document.getElementById('shortcuts-backdrop')?.classList.add('active');
      return;
    }

    // G + Key navigation sequences
    if (e.key.toLowerCase() === 'g') {
      gPrefix = true;
      setTimeout(() => { gPrefix = false; }, 1000);
      return;
    }

    if (gPrefix) {
      gPrefix = false;
      if (e.key.toLowerCase() === 't') navigate('today');
      if (e.key.toLowerCase() === 'l') navigate('library');
      if (e.key.toLowerCase() === 'i') navigate('import');
    }
  });

  // Shortcuts Modal backdrop close
  document.getElementById('shortcuts-backdrop')?.addEventListener('click', e => {
    if (e.target.id === 'shortcuts-backdrop') {
      e.target.classList.remove('active');
    }
  });
}

function toggleSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  localStorage.setItem('alc_sidebar_collapsed', isCollapsed);
}

// ── 8. Utility Helpers ───────────────────────────────────────────
export function skel(w, h, r = 8, extra = '') {
  const wStr = typeof w === 'number' ? `${w}px` : w;
  const hStr = typeof h === 'number' ? `${h}px` : h;
  const rStr = typeof r === 'number' ? `${r}px` : r;
  return `<div class="skel" style="width:${wStr};height:${hStr};border-radius:${rStr};${extra}"></div>`;
}

let toastTimer;
export function showToast(message, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.className = `toast-msg show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast-msg'; }, 4200);
}

export function icon(id, extraClass = '', extraStyle = '') {
  return `<svg class="icn ${extraClass}" style="${extraStyle}"><use href="#i-${id}"/></svg>`;
}

export function ytId(url) {
  if (!url || typeof url !== 'string') return null;
  const str = url.trim();
  if (str.startsWith('manual_')) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const m = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}

export function ytThumb(id) {
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

export function timeAgo(dateStr) {
  if (!dateStr) return 'recently';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function localDate() { return new Date().toLocaleDateString('en-CA'); }

// LocalStorage Migration
function migrateLocalStorage() {
  try {
    if (!localStorage.getItem('alc_streak_v3') && localStorage.getItem('alc_streak_v2')) {
      localStorage.setItem('alc_streak_v3', localStorage.getItem('alc_streak_v2'));
    }
    if (!localStorage.getItem('alc_daily_goal_v3') && localStorage.getItem('alc_daily_goal_v2')) {
      localStorage.setItem('alc_daily_goal_v3', localStorage.getItem('alc_daily_goal_v2'));
    }
    // Clean up old transient keys
    ['alc_cache_browse', 'alc_cache_quiz', 'alc_cache_stats'].forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('LocalStorage migration note:', e);
  }
}

// Streak Store
export const Streak = {
  KEY: 'alc_streak_v3',
  get() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      return {
        count: data.count || 0,
        lastDate: data.lastDate || '',
        history: data.history || [],
      };
    } catch {
      return { count: 0, lastDate: '', history: [] };
    }
  },
  recordActivity() {
    const today = localDate();
    const s = this.get();
    if (s.lastDate === today) return s;

    const last = new Date(s.lastDate);
    const curr = new Date(today);
    const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) s.count += 1;
    else s.count = 1;

    s.lastDate = today;
    if (!s.history.includes(today)) s.history.push(today);
    localStorage.setItem(this.KEY, JSON.stringify(s));
    return s;
  }
};

// Daily Goal Store
export const DailyGoal = {
  KEY: 'alc_daily_goal_v3',
  get() {
    try {
      const today = localDate();
      const data = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      if (data.date !== today) {
        return { target: data.target || 20, progress: 0, date: today };
      }
      return data;
    } catch {
      return { target: 20, progress: 0, date: localDate() };
    }
  },
  save(type, target) {
    const goal = this.get();
    goal.target = target;
    localStorage.setItem(this.KEY, JSON.stringify(goal));
    return goal;
  },
  addProgress(n = 1) {
    const g = this.get();
    g.progress += n;
    localStorage.setItem(this.KEY, JSON.stringify(g));
    Streak.recordActivity();
    return g;
  }
};

// ── 9. Bootloader ────────────────────────────────────────────────
function bootApp() {
  // Migrate legacy local storage keys
  migrateLocalStorage();

  // Restore collapsed sidebar preference
  if (localStorage.getItem('alc_sidebar_collapsed') === 'true') {
    document.getElementById('sidebar')?.classList.add('sidebar-collapsed');
    document.body.classList.add('sidebar-collapsed');
  }

  // Sidebar collapse button listener
  document.getElementById('sidebar-collapse-btn')?.addEventListener('click', toggleSidebarCollapse);

  // Mobile menu listeners
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');

  mobileBtn?.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active', isOpen);
    mobileBtn.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    mobileBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  });

  // Logout listener
  document.getElementById('logout-btn')?.addEventListener('click', signOut);

  // Init interactive services
  initCommandPalette();
  initAiDrawer();
  initGlobalKeyboard();

  // Load user profile
  const user = getUser();
  if (user) {
    const email = user.email || 'student';
    const initials = email.slice(0, 2).toUpperCase();
    const topAvatar = document.getElementById('top-user-avatar');
    const sideAvatar = document.getElementById('side-user-avatar');
    const sideName = document.getElementById('side-user-name');
    if (topAvatar) topAvatar.textContent = initials;
    if (sideAvatar) sideAvatar.textContent = initials;
    if (sideName) sideName.textContent = email;
  }

  // Start route
  const initial = window.location.hash.slice(1) || 'today';
  navigate(initial);

  window.addEventListener('hashchange', () => {
    const current = window.location.hash.slice(1) || 'today';
    navigate(current);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
