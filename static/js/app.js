/**
 * AI Learning Companion – App v2
 * Router · API client · Toast · Confetti · Streak · Global state
 */

import { renderDashboard } from './pages/dashboard.js';
import { renderAddVideo } from './pages/add_video.js';
import { renderBrowse } from './pages/browse.js';
import { renderFlashcards } from './pages/flashcards.js';
import { renderQuiz } from './pages/quiz.js';
import { renderReview } from './pages/review.js';
import { renderStats } from './pages/stats.js';
import { renderManage } from './pages/manage.js';
import { getUser, getToken, getSession, onAuthChange, signOut } from './auth.js';
import { renderLogin } from './pages/login.js';

// ══════════════════════════════════════════════════════════════════
// Two-layer API cache:
//   L1 = in-memory Map        (instant, same page session)
//   L2 = localStorage         (persists across page refreshes)
// Strategy: stale-while-revalidate
//   → Return cached data immediately (even if slightly old)
//   → Simultaneously fetch fresh data in background
//   → Update UI when fresh data arrives (if different)
// ══════════════════════════════════════════════════════════════════
const _memCache = new Map();
const LS_PREFIX = 'alc_cache_';

// TTL config (ms) — L1 strict TTL, L2 soft TTL (stale ok, revalidate)
const CACHE_TTL = {
  '/api/courses': { l1: 20_000, l2: 5 * 60_000 },
  '/api/stats': { l1: 15_000, l2: 3 * 60_000 },
  '/api/review/due': { l1: 10_000, l2: 2 * 60_000 },
  '/api/quiz/questions': { l1: 10_000, l2: 2 * 60_000 },
  '/api/videos/': { l1: 60_000, l2: 10 * 60_000 },
  'default': { l1: 10_000, l2: 60_000 },
};

function _getTtl(path) {
  for (const [prefix, ttl] of Object.entries(CACHE_TTL)) {
    if (prefix !== 'default' && path.startsWith(prefix)) return ttl;
  }
  return CACHE_TTL['default'];
}

function _l1Get(path) {
  const e = _memCache.get(path);
  if (!e || Date.now() > e.ex) { _memCache.delete(path); return null; }
  return e.data;
}
function _l1Set(path, data, ttlMs) {
  _memCache.set(path, { data, ex: Date.now() + ttlMs });
}

function _l2Get(path) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + btoa(path));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function _l2Set(path, data, ttlMs) {
  try {
    localStorage.setItem(LS_PREFIX + btoa(path), JSON.stringify({
      data, ex: Date.now() + ttlMs, fresh: Date.now(),
    }));
  } catch { /* storage full — ignore */ }
}

function _cacheBust(prefix) {
  for (const key of _memCache.keys()) {
    if (prefix === '*' || key.startsWith(prefix)) _memCache.delete(key);
  }
  if (prefix === '*') {
    Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } else {
    try {
      const encoded = btoa(prefix);
      Object.keys(localStorage)
        .filter(k => k.startsWith(LS_PREFIX) && k.includes(encoded.slice(0, 10)))
        .forEach(k => localStorage.removeItem(k));
    } catch { /**/ }
  }
}

const _swr_listeners = new Map();
export function onFreshData(path, cb) { _swr_listeners.set(path, cb); }

// ══════════════════════════════════════════════════════════════════
// API Client
// ══════════════════════════════════════════════════════════════════
export const API = {
  async get(path, { revalidate = true } = {}) {
    const ttl = _getTtl(path);
    const token = await getToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const l1 = _l1Get(path);
    if (l1 !== null) return l1;

    const l2 = _l2Get(path);
    if (l2 !== null) {
      _l1Set(path, l2.data, ttl.l1);
      const isStale = Date.now() > l2.ex;
      if (revalidate && isStale) {
        fetch(path, { headers }).then(async r => {
          if (!r.ok) {
            if (r.status === 401) signOut();
            return;
          }
          const fresh = await r.json();
          _l1Set(path, fresh, ttl.l1);
          _l2Set(path, fresh, ttl.l2);
          const cb = _swr_listeners.get(path);
          if (cb) cb(fresh);
        }).catch(() => { });
      }
      return l2.data;
    }

    const r = await fetch(path, { headers });
    if (!r.ok) {
      if (r.status === 401) { signOut(); return; }
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
    const data = await r.json();
    _l1Set(path, data, ttl.l1);
    _l2Set(path, data, ttl.l2);
    return data;
  },

  async post(path, body) {
    const token = await getToken();
    const r = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      if (r.status === 401) { signOut(); return; }
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
    _cacheBust('/api/courses');
    _cacheBust('/api/stats');
    _cacheBust('/api/review/due');
    return r.json();
  },

  async del(path) {
    const token = await getToken();
    const r = await fetch(path, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!r.ok) {
      if (r.status === 401) { signOut(); return; }
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
    _cacheBust('*');
    return r.json();
  },
};

// ══════════════════════════════════════════════════════════════════
// Toast
// ══════════════════════════════════════════════════════════════════
let _toastTimer;
export function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = 'toast'; }, 3800);
}

// ══════════════════════════════════════════════════════════════════
// Streak (localStorage)
// ══════════════════════════════════════════════════════════════════
export const Streak = {
  key: 'alc_streak',
  get() {
    try { return JSON.parse(localStorage.getItem(this.key)) || { count: 0, last: '' }; }
    catch { return { count: 0, last: '' }; }
  },
  bump() {
    const today = new Date().toISOString().slice(0, 10);
    const s = this.get();
    if (s.last === today) return s;
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const count = s.last === yesterday ? s.count + 1 : 1;
    const next = { count, last: today };
    localStorage.setItem(this.key, JSON.stringify(next));
    return next;
  },
};

// ══════════════════════════════════════════════════════════════════
// Animated number counter
// ══════════════════════════════════════════════════════════════════
export function animateCount(el, to, duration = 900, suffix = '') {
  const from = 0;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * ease) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ══════════════════════════════════════════════════════════════════
// Confetti
// ══════════════════════════════════════════════════════════════════
export function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = '';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#00e5cc', '#f59e0b', '#ff6b6b', '#0ea5e9', '#10b981', '#fff'];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    r: 6 + Math.random() * 6,
    d: 2 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt: (Math.random() - 0.5) * 20,
    tiltV: (Math.random() - 0.5) * 0.4,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.15,
  }));

  let frame;
  const last = performance.now();

  function draw(ts) {
    const elapsed = ts - last;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.y += p.d; p.tilt += p.tiltV; p.rot += p.rotV;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - p.y / canvas.height);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r / 2, p.r, p.tilt, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (alive) { frame = requestAnimationFrame(draw); }
    else { canvas.style.display = 'none'; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  frame = requestAnimationFrame(draw);
}

// ══════════════════════════════════════════════════════════════════
// Stagger animation helper
// ══════════════════════════════════════════════════════════════════
export function staggerElements(selector, delay = 60) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.style.animationDelay = `${i * delay}ms`;
  });
}

// ══════════════════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════════════════
const PAGES = {
  'dashboard': renderDashboard,
  'add-video': renderAddVideo,
  'browse': renderBrowse,
  'flashcards': renderFlashcards,
  'quiz': renderQuiz,
  'review': renderReview,
  'stats': renderStats,
  'manage': renderManage,
};

let _current = 'dashboard';

export function navigate(page) {
  if (!PAGES[page]) return;
  _current = page;

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );

  const content = document.getElementById('page-content');
  content.style.opacity = '0';
  content.style.transform = 'translateY(10px)';

  setTimeout(() => {
    content.innerHTML = '';
    PAGES[page](content);
    content.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';
  }, 120);

  if (window._closeMobileSidebar) window._closeMobileSidebar();
  else document.getElementById('sidebar').classList.remove('open');
  window.location.hash = page;
}

// ══════════════════════════════════════════════════════════════════
// Status bar (cloud connection check)
// ══════════════════════════════════════════════════════════════════
async function refreshStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    await API.get('/api/courses');
    if (dot) dot.className = 'status-dot ok';
    if (text) text.textContent = 'Connected ☑️';

    try {
      const rev = await API.get('/api/review/due?limit=0');
      const badge = document.getElementById('review-badge');
      if (badge) {
        if (rev.due_count > 0) {
          badge.textContent = rev.due_count;
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch { /**/ }
  } catch {
    if (dot) dot.className = 'status-dot bad';
    if (text) text.textContent = 'Server offline';
  }
}

// ══════════════════════════════════════════════════════════════════
// Mobile sidebar – toggle · overlay · swipe gestures
// ══════════════════════════════════════════════════════════════════
function initMobile() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('mobile-menu-btn');
  const overlay = document.getElementById('sidebar-overlay');
  const iconHam = document.getElementById('menu-icon-ham');
  const iconX = document.getElementById('menu-icon-close');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    btn.classList.add('sidebar-open');
    btn.setAttribute('aria-expanded', 'true');
    iconHam.style.display = 'none';
    iconX.style.display = '';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    btn.classList.remove('sidebar-open');
    btn.setAttribute('aria-expanded', 'false');
    iconHam.style.display = '';
    iconX.style.display = 'none';
  }

  function toggleSidebar() {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  }

  btn.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', closeSidebar);

  const SWIPE_THRESHOLD = 48;
  const EDGE_ZONE = 28;
  const VELOCITY_MIN = 0.25;
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0, swipeIntent = null;

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY; touchStartTime = Date.now();
    const sidebarOpen = sidebar.classList.contains('open');
    swipeIntent = (!sidebarOpen && touchStartX <= EDGE_ZONE) ? 'open'
      : sidebarOpen ? 'close' : null;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!swipeIntent) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dy > 50) { swipeIntent = null; return; }
    if (swipeIntent === 'open' && dx > 0) {
      sidebar.style.transition = 'none';
      sidebar.style.transform = `translateX(calc(-272px + ${dx}px))`;
      overlay.style.display = 'block';
      overlay.style.opacity = String(Math.min(dx / 272, 1) * 0.55);
    } else if (swipeIntent === 'close' && dx < 0) {
      sidebar.style.transition = 'none';
      sidebar.style.transform = `translateX(${dx}px)`;
      overlay.style.opacity = String((1 - Math.min(-dx / 272, 1)) * 0.55);
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!swipeIntent) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = Math.abs(t.clientY - touchStartY);
    const dt = Date.now() - touchStartTime;
    const vx = Math.abs(dx) / (dt || 1);
    sidebar.style.transition = ''; sidebar.style.transform = '';
    overlay.style.opacity = ''; overlay.style.display = '';
    if (dy > 60) { swipeIntent = null; return; }
    const isSwipe = Math.abs(dx) >= SWIPE_THRESHOLD || vx >= VELOCITY_MIN;
    if (swipeIntent === 'open' && dx > 0 && isSwipe) openSidebar();
    else if (swipeIntent === 'close' && dx < 0 && isSwipe) closeSidebar();
    swipeIntent = null;
  }, { passive: true });

  window._closeMobileSidebar = closeSidebar;
}

// ══════════════════════════════════════════════════════════════════
// Show login — fullscreen, bypasses sidebar layout
// ══════════════════════════════════════════════════════════════════
function showLoginScreen() {
  const sidebar = document.getElementById('sidebar');
  const mobileBtn = document.getElementById('mobile-menu-btn');

  if (sidebar) sidebar.style.display = 'none';
  if (mobileBtn) mobileBtn.style.display = 'none';

  const appEl = document.getElementById('app');
  if (appEl) appEl.style.display = 'block';

  const mainEl = document.getElementById('main-content');
  if (mainEl) {
    mainEl.style.marginLeft = '0';
    mainEl.style.padding = '0';
    mainEl.style.minHeight = '100vh';
    mainEl.style.display = 'flex';
    mainEl.style.alignItems = 'center';
    mainEl.style.justifyContent = 'center';
  }

  const pageContent = document.getElementById('page-content');
  if (pageContent) {
    pageContent.style.width = '100%';
    renderLogin(pageContent);
  }
}

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════════════════════════
function init() {
  // Show a minimal loading state while Supabase restores session
  const pageContent = document.getElementById('page-content');
  if (pageContent) {
    pageContent.innerHTML = `
      <div style="display:flex;align-items:center;
                  justify-content:center;flex-direction:column;gap:16px;
                  padding-top:120px">
        <div style="font-size:2rem">🎓</div>
        <div style="color:var(--text-3);font-size:.9rem">Loading…</div>
      </div>`;
  }

  let booted = false;

  onAuthChange(async (event, session) => {
    // INITIAL_SESSION fires once on load with the persisted session (or null)
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      if (booted) return; // prevent double-boot if both events fire
      booted = true;

      if (!session?.user) {
        booted = false;
        showLoginScreen();
        return;
      }
      await bootApp();
    }

    if (event === 'SIGNED_OUT') {
      window.location.reload();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function bootApp() {
  const sidebar = document.getElementById('sidebar');
  const mobileBtn = document.getElementById('mobile-menu-btn');
  if (sidebar) { sidebar.style.visibility = 'visible'; sidebar.style.display = ''; }
  if (mobileBtn) { mobileBtn.style.visibility = 'visible'; mobileBtn.style.display = ''; }

  // Reset any inline styles set by showLoginScreen()
  const mainEl = document.getElementById('main-content');
  if (mainEl) {
    mainEl.style.marginLeft = '';
    mainEl.style.padding = '';
    mainEl.style.minHeight = '';
    mainEl.style.display = '';
    mainEl.style.alignItems = '';
    mainEl.style.justifyContent = '';
  }
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.display = '';
  const pageContent = document.getElementById('page-content');
  if (pageContent) pageContent.style.width = '';

  // Force browser to recalculate layout with sidebar visible BEFORE rendering page
  if (sidebar) void sidebar.offsetWidth;

  initMobile();
  refreshStatus();
  Streak.bump();

  // Ambient mouse light glow spotlight
  const glow = document.getElementById('cursor-glow');
  if (glow) {
    let curX = 0, curY = 0, tgtX = 0, tgtY = 0;
    window.addEventListener('mousemove', e => {
      tgtX = e.clientX + window.scrollX;
      tgtY = e.clientY + window.scrollY;
      glow.style.opacity = '1';
    }, { passive: true });
    
    function updateGlow() {
      curX += (tgtX - curX) * 0.08;
      curY += (tgtY - curY) * 0.08;
      glow.style.transform = `translate3d(calc(${curX}px - 225px), calc(${curY}px - 225px), 0)`;
      requestAnimationFrame(updateGlow);
    }
    requestAnimationFrame(updateGlow);
  }

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
  });

  const hash = window.location.hash.replace('#', '');
  navigate(PAGES[hash] ? hash : 'dashboard');

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => signOut());

  let _lastPing = 0;
  const PING_INTERVAL = 4 * 60 * 1000;
  function _maybePing() {
    const now = Date.now();
    if (now - _lastPing > PING_INTERVAL) {
      _lastPing = now;
      fetch('/api/ping').catch(() => { });
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') _maybePing();
  });
  _maybePing();
}