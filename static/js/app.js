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
// API Client
// ══════════════════════════════════════════════════════════════════
export const API = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) {
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
    return r.json();
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
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: 'DELETE' });
    if (!r.ok) {
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || `HTTP ${r.status}`);
    }
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

  document.getElementById('sidebar').classList.remove('open');
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
// Mobile sidebar
// ══════════════════════════════════════════════════════════════════
function initMobile() {
  document.getElementById('mobile-menu-btn')
    .addEventListener('click', () =>
      document.getElementById('sidebar').classList.toggle('open')
    );
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
});
