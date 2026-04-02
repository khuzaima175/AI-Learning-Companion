/**
 * AI Learning Companion – App v2
 * Router · API client · Toast · Confetti · Streak · Global state
 */

import { renderDashboard }  from './pages/dashboard.js';
import { renderAddVideo }   from './pages/add_video.js';
import { renderBrowse }     from './pages/browse.js';
import { renderFlashcards } from './pages/flashcards.js';
import { renderQuiz }       from './pages/quiz.js';
import { renderReview }     from './pages/review.js';
import { renderStats }      from './pages/stats.js';
import { renderManage }     from './pages/manage.js';

// ══════════════════════════════════════════════════════════════════
// In-memory API cache  (TTL-based, busted on mutations)
// ══════════════════════════════════════════════════════════════════
const _cache = new Map();   // path → { data, expiresAt }

function _cacheGet(path) {
  const entry = _cache.get(path);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(path); return null; }
  return entry.data;
}
function _cacheSet(path, data, ttlMs) {
  _cache.set(path, { data, expiresAt: Date.now() + ttlMs });
}
function _cacheBust(prefix) {
  for (const key of _cache.keys()) {
    if (prefix === '*' || key.startsWith(prefix)) _cache.delete(key);
  }
}

// TTL config per path prefix (ms)
const CACHE_TTL = {
  '/api/courses':         20_000,   // 20s  — most expensive call
  '/api/stats':           15_000,   // 15s
  '/api/review/due':      10_000,   // 10s
  '/api/quiz/questions':  10_000,   // 10s
  '/api/videos/':         30_000,   // 30s  — rarely changes
  'default':              10_000,
};

function _getTtl(path) {
  for (const [prefix, ttl] of Object.entries(CACHE_TTL)) {
    if (prefix !== 'default' && path.startsWith(prefix)) return ttl;
  }
  return CACHE_TTL['default'];
}

// ══════════════════════════════════════════════════════════════════
// API Client
// ══════════════════════════════════════════════════════════════════
export const API = {
  async get(path) {
    const cached = _cacheGet(path);
    if (cached !== null) return cached;

    const r = await fetch(path);
    if (!r.ok) {
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
    const data = await r.json();
    _cacheSet(path, data, _getTtl(path));
    return data;
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
    // Bust related caches after any write
    _cacheBust('/api/courses');
    _cacheBust('/api/stats');
    _cacheBust('/api/review/due');
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: 'DELETE' });
    if (!r.ok) {
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
    _cacheBust('*');   // full bust on delete
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
  canvas.width  = window.innerWidth;
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
  let elapsed = 0;
  const last = performance.now();

  function draw(ts) {
    elapsed = ts - last;
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
  'dashboard':   renderDashboard,
  'add-video':   renderAddVideo,
  'browse':      renderBrowse,
  'flashcards':  renderFlashcards,
  'quiz':        renderQuiz,
  'review':      renderReview,
  'stats':       renderStats,
  'manage':      renderManage,
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
  content.style.transform = 'translateY(14px)';

  setTimeout(() => {
    content.innerHTML = '';
    PAGES[page](content);
    content.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';
  }, 120);

  // Close sidebar on mobile when navigating
  if (window._closeMobileSidebar) window._closeMobileSidebar();
  else document.getElementById('sidebar').classList.remove('open');
  window.location.hash = page;
}

// ══════════════════════════════════════════════════════════════════
// Status bar (cloud connection check)
// ══════════════════════════════════════════════════════════════════
async function refreshStatus() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    await API.get('/api/courses');
    dot.className    = 'status-dot ok';
    text.textContent = 'Connected ☑️';

    // Update daily review badge
    try {
      const rev = await API.get('/api/review/due?limit=0');
      const badge = document.getElementById('review-badge');
      if (rev.due_count > 0) {
        badge.textContent   = rev.due_count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    } catch { /**/ }
  } catch {
    dot.className    = 'status-dot bad';
    text.textContent = 'Server offline';
  }
}

// ══════════════════════════════════════════════════════════════════
// Mobile sidebar – toggle · overlay · swipe gestures
// ══════════════════════════════════════════════════════════════════
function initMobile() {
  const sidebar  = document.getElementById('sidebar');
  const btn      = document.getElementById('mobile-menu-btn');
  const overlay  = document.getElementById('sidebar-overlay');
  const iconHam  = document.getElementById('menu-icon-ham');
  const iconX    = document.getElementById('menu-icon-close');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    btn.classList.add('sidebar-open');
    btn.setAttribute('aria-expanded', 'true');
    iconHam.style.display  = 'none';
    iconX.style.display    = '';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    btn.classList.remove('sidebar-open');
    btn.setAttribute('aria-expanded', 'false');
    iconHam.style.display  = '';
    iconX.style.display    = 'none';
  }

  function toggleSidebar() {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  }

  // Hamburger button
  btn.addEventListener('click', toggleSidebar);

  // Tap overlay to close
  overlay.addEventListener('click', closeSidebar);

  // ── Swipe gestures ──────────────────────────────────────────────
  const SWIPE_THRESHOLD   = 48;   // px minimum horizontal travel
  const EDGE_ZONE         = 28;   // px from left edge to start open-swipe
  const VELOCITY_MIN      = 0.25; // px/ms minimum speed
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let swipeIntent = null;         // 'open' | 'close' | null

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX    = t.clientX;
    touchStartY    = t.clientY;
    touchStartTime = Date.now();

    const sidebarOpen = sidebar.classList.contains('open');
    // Only capture relevant starting zones
    if (!sidebarOpen && touchStartX <= EDGE_ZONE) {
      swipeIntent = 'open';
    } else if (sidebarOpen) {
      swipeIntent = 'close';
    } else {
      swipeIntent = null;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    // provide live visual drag preview while swiping
    if (!swipeIntent) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dy > 50) { swipeIntent = null; return; } // vertical scroll – cancel

    if (swipeIntent === 'open' && dx > 0) {
      const progress = Math.min(dx / 272, 1);
      sidebar.style.transition = 'none';
      sidebar.style.transform  = `translateX(calc(-272px + ${dx}px))`;
      overlay.style.display    = 'block';
      overlay.style.opacity    = String(progress * 0.55);
    } else if (swipeIntent === 'close' && dx < 0) {
      const progress = Math.min(-dx / 272, 1);
      sidebar.style.transition = 'none';
      sidebar.style.transform  = `translateX(${dx}px)`;
      overlay.style.opacity    = String((1 - progress) * 0.55);
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!swipeIntent) return;
    const t    = e.changedTouches[0];
    const dx   = t.clientX - touchStartX;
    const dy   = Math.abs(t.clientY - touchStartY);
    const dt   = Date.now() - touchStartTime;
    const vx   = Math.abs(dx) / (dt || 1);

    // Reset inline styles so CSS transitions take over
    sidebar.style.transition = '';
    sidebar.style.transform  = '';
    overlay.style.opacity    = '';
    overlay.style.display    = '';

    if (dy > 60) { swipeIntent = null; return; } // was a scroll

    const isSwipe = Math.abs(dx) >= SWIPE_THRESHOLD || vx >= VELOCITY_MIN;

    if (swipeIntent === 'open'  && dx > 0 && isSwipe) openSidebar();
    else if (swipeIntent === 'close' && dx < 0 && isSwipe) closeSidebar();
    // If swipe was too short, sidebar snaps back via CSS transition

    swipeIntent = null;
  }, { passive: true });

  // Expose closeSidebar so navigate() can call it
  window._closeMobileSidebar = closeSidebar;
}

// ══════════════════════════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initMobile();
  refreshStatus();
  Streak.bump(); // bump streak on daily open

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
  });

  const hash = window.location.hash.replace('#', '');
  navigate(PAGES[hash] ? hash : 'dashboard');

  // ── Keep-alive ping ─────────────────────────────────────────────
  // When the user returns to the tab after being away, fire a silent
  // ping so Vercel warms up BEFORE they interact (hides cold start).
  let _lastPing = 0;
  const PING_INTERVAL = 4 * 60 * 1000; // 4 minutes

  function _maybePing() {
    const now = Date.now();
    if (now - _lastPing > PING_INTERVAL) {
      _lastPing = now;
      fetch('/api/ping').catch(() => {}); // fire-and-forget
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') _maybePing();
  });

  _maybePing(); // also ping on first load
});
