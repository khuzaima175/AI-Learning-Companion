import { getUser, getToken, getSession, signOut } from './auth.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderBrowse }    from './pages/browse.js';
import { renderAddVideo }  from './pages/add_video.js';
import { renderFlashcards }from './pages/flashcards.js';
import { renderQuiz }      from './pages/quiz.js';
import { renderReview }    from './pages/review.js';
import { renderStats }     from './pages/stats.js';
import { renderManage }    from './pages/manage.js';
import { renderLogin }     from './pages/login.js';

// Route Definitions
const ROUTES = {
  'dashboard':  renderDashboard,
  'browse':     renderBrowse,
  'add-video':  renderAddVideo,
  'flashcards': renderFlashcards,
  'quiz':       renderQuiz,
  'review':     renderReview,
  'stats':      renderStats,
  'manage':     renderManage,
  'login':      renderLogin,
};

let _lastDueFetch = 0;
let _cachedDue = null;

// Progress Route Bar Simulation
export function startRouteBar() {
  const bar = document.getElementById('routebar');
  if (!bar) return;
  bar.style.opacity = '1';
  bar.style.width = '35%';
  setTimeout(() => { if (bar.style.opacity === '1') bar.style.width = '70%'; }, 120);
}

export function finishRouteBar() {
  const bar = document.getElementById('routebar');
  if (!bar) return;
  bar.style.width = '100%';
  setTimeout(() => {
    bar.style.opacity = '0';
    setTimeout(() => { bar.style.width = '0'; }, 300);
  }, 180);
}

// Router
export async function navigate(page) {
  const user = getUser();
  const target = user ? (ROUTES[page] ? page : 'dashboard') : 'login';

  startRouteBar();

  window.location.hash = target;
  updateNav(target);

  const container = document.getElementById('page-content');
  if (!container) {
    finishRouteBar();
    return;
  }

  // Smooth Route Transition (exit fade, render, entry rise)
  container.classList.add('leaving');
  await new Promise(r => setTimeout(r, 120));

  container.innerHTML = '';
  container.className = 'page';

  try {
    await ROUTES[target](container);
    initRevealAnimations(container);
    initCardSpotlights(container);
    initImageFadeIns(container);
  } catch (err) {
    console.error(`Error rendering page "${target}":`, err);
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:48px 24px;border-color:rgba(251,113,133,0.3)">
        <div class="icon-chip coral" style="width:48px;height:48px;margin:0 auto 16px">
          ${icon('help-circle', '', 'width:24px;height:24px')}
        </div>
        <h3 style="font-size:1.8rem;color:var(--coral)">Something went wrong</h3>
        <p style="color:var(--muted);margin-top:8px;font-size:0.9rem">${err.message || 'Failed to render view'}</p>
        <button class="btn btn-ghost btn-sm" onclick="window.navigate('dashboard')" style="margin-top:20px">
          ${icon('arrow-left', '', 'width:14px;height:14px')}
          <span>Back to Dashboard</span>
        </button>
      </div>`;
  } finally {
    finishRouteBar();
    updateReviewBadge();
  }
}

window.navigate = navigate;

// Update active sidebar state
function updateNav(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('mobile-menu-btn');
  const overlay = document.getElementById('sidebar-overlay');
  const mainContent = document.getElementById('main-content');
  const isAuth = page !== 'login';
  
  if (sidebar) sidebar.style.display = isAuth ? 'flex' : 'none';
  if (menuBtn) menuBtn.style.display = isAuth && window.innerWidth <= 860 ? 'flex' : 'none';
  if (overlay && !isAuth) overlay.classList.remove('active');
  if (mainContent) mainContent.style.marginLeft = isAuth && window.innerWidth > 860 ? 'var(--sidebar-w)' : '0';

  if (window.innerWidth <= 860 && sidebar) {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    updateMenuIcon(false);
  }
}

// Single Source of Truth for Due Count (cached for 15s)
export async function getDueCount() {
  const now = Date.now();
  if (_cachedDue !== null && (now - _lastDueFetch) < 15000) {
    return _cachedDue;
  }
  try {
    const data = await API.get('/api/review/due?limit=1');
    _cachedDue = data.due_count ?? (data.questions ? data.questions.length : 0);
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

// Update review badge in sidebar
export async function updateReviewBadge() {
  const badge = document.getElementById('review-badge');
  if (!badge) return;

  try {
    const due = await getDueCount();
    if (due > 0) {
      badge.textContent = `${due} due`;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch {
    badge.style.display = 'none';
  }
}

// Defensive mapping of /api/stats response to ensure no zeros/placeholders
export function mapStats(s) {
  if (!s || typeof s !== 'object') s = {};
  const totalQ = s.total_questions || s.questions_count || s.total_cards || s.questions || 0;
  const totalC = s.total_courses || s.courses_count || s.courses || 0;
  const totalV = s.total_videos || s.videos_count || s.videos || 0;
  const dueVal = s.due_count ?? s.due ?? s.due_cards ?? 0;
  const accVal = Math.round(s.accuracy || s.accuracy_pct || s.recall_rate || 0);

  return {
    courses: totalC,
    videos: totalV,
    questions: totalQ,
    due: dueVal,
    accuracy: accVal,
    recent_sessions: Array.isArray(s.recent_sessions) ? s.recent_sessions : [],
    raw: s,
  };
}

// Scroll Reveal Observer with Immediate Fallback
export function initRevealAnimations(scope = document) {
  const elements = scope.querySelectorAll('.rev');
  if (!elements.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01 });

    elements.forEach((el, i) => {
      el.style.setProperty('--i', i);
      observer.observe(el);
      setTimeout(() => el.classList.add('in'), 150 + i * 40);
    });
  } else {
    elements.forEach(el => el.classList.add('in'));
  }
}

// Cursor Spotlight for Cards
export function initCardSpotlights(scope = document) {
  scope.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
    });
  });
}

// Smooth Image Fade-In
export function initImageFadeIns(scope = document) {
  scope.querySelectorAll('img.thumb').forEach(img => {
    if (img.complete) {
      img.classList.add('ld');
    } else {
      img.addEventListener('load', () => img.classList.add('ld'));
      img.addEventListener('error', () => {
        img.style.display = 'none';
      });
    }
  });
}

// Global Number Count-Up Animation
export function animateCount(el, target, duration = 650, suffix = '') {
  if (!el) return;
  const start = 0;
  const end = typeof target === 'number' ? target : parseInt(target, 10) || 0;
  if (end === 0) {
    el.textContent = `0${suffix}`;
    return;
  }
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * easeProgress);

    el.textContent = `${current}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = `${end}${suffix}`;
      el.classList.add('stat-pop');
      setTimeout(() => el.classList.remove('stat-pop'), 250);
    }
  }

  requestAnimationFrame(update);
}

// Skeleton Generator Helper
export function skel(w, h, r = 10, extraStyle = '') {
  const wStr = typeof w === 'number' ? `${w}px` : w;
  const hStr = typeof h === 'number' ? `${h}px` : h;
  const rStr = typeof r === 'number' ? `${r}px` : r;
  return `<div class="skel" style="width:${wStr};height:${hStr};border-radius:${rStr};${extraStyle}"></div>`;
}

// Streak Store
export const Streak = {
  KEY: 'alc_streak_v2',
  get() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      return {
        count: data.count || 1,
        lastDate: data.lastDate || new Date().toISOString().split('T')[0],
        history: data.history || [new Date().toISOString().split('T')[0]],
      };
    } catch {
      return { count: 1, lastDate: new Date().toISOString().split('T')[0], history: [] };
    }
  },
  recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    const s = this.get();
    if (s.lastDate === today) return s;

    const last = new Date(s.lastDate);
    const curr = new Date(today);
    const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      s.count += 1;
    } else if (diffDays > 1) {
      s.count = 1;
    }
    s.lastDate = today;
    if (!s.history.includes(today)) s.history.push(today);

    localStorage.setItem(this.KEY, JSON.stringify(s));
    updateSidebarStreak(s.count);
    return s;
  }
};

function updateSidebarStreak(count) {
  const countEl = document.getElementById('sidebar-streak-count');
  if (countEl) countEl.textContent = `${count} day${count !== 1 ? 's' : ''}`;
}

// Daily Goal Store
export const DailyGoal = {
  KEY: 'alc_daily_goal_v2',
  get() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      if (data.date !== today) {
        return { target: data.target || 15, progress: 0, date: today, type: 'cards' };
      }
      return data;
    } catch {
      return { target: 15, progress: 0, date: new Date().toISOString().split('T')[0], type: 'cards' };
    }
  },
  save(type, target) {
    const g = this.get();
    g.type = type || g.type;
    g.target = parseInt(target, 10) || g.target;
    localStorage.setItem(this.KEY, JSON.stringify(g));
    return g;
  },
  addProgress(n = 1) {
    const g = this.get();
    g.progress += n;
    localStorage.setItem(this.KEY, JSON.stringify(g));
    Streak.recordActivity();
    return g;
  },
  pct(g) {
    return Math.min(100, Math.round((g.progress / (g.target || 1)) * 100));
  },
  isDone(g) {
    return g.progress >= g.target;
  }
};

// Toast Service
export function showToast(message, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3400);
}

// SVG Icon Helper
export function icon(id, extraClass = '', extraStyle = '') {
  return `<svg class="icn ${extraClass}" style="${extraStyle}"><use href="#i-${id}"/></svg>`;
}

// YouTube Helpers
export function ytId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}

export function ytThumb(id) {
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

// Confetti Effect
export function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const pieces = Array.from({ length: 60 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 14,
    vy: (Math.random() - 0.5) * 14 - 3,
    size: Math.random() * 8 + 4,
    color: ['#5eead4', '#2dd4a8', '#fbbf24', '#f97316', '#7dd3fc', '#34d399', '#fb7185'][Math.floor(Math.random() * 7)],
    alpha: 1,
    rot: Math.random() * 360,
    vrot: (Math.random() - 0.5) * 10,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28;
      p.rot += p.vrot;
      p.alpha -= 0.015;
      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive && frame++ < 120) {
      requestAnimationFrame(draw);
    } else {
      canvas.style.display = 'none';
    }
  }
  requestAnimationFrame(draw);
}

// API Service
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

function updateMenuIcon(isOpen) {
  const ham = document.getElementById('menu-icon-ham');
  const close = document.getElementById('menu-icon-close');
  if (ham && close) {
    ham.style.display = isOpen ? 'none' : 'block';
    close.style.display = isOpen ? 'block' : 'none';
  }
}

// Init App Bootloader
function bootApp() {
  const initialHash = window.location.hash.slice(1) || 'dashboard';

  // Navigation Links
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = el.dataset.page;
      navigate(page);
    });
  });

  // Mobile Menu
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  mobileBtn?.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    mobileBtn.setAttribute('aria-expanded', isOpen);
    updateMenuIcon(isOpen);
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    mobileBtn.setAttribute('aria-expanded', 'false');
    updateMenuIcon(false);
  });

  // Logout Button
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    signOut();
  });

  // Update user avatar in sidebar
  const user = getUser();
  if (user) {
    const emailChip = document.getElementById('user-email-chip');
    const avatarChip = document.getElementById('user-avatar-chip');
    if (emailChip) emailChip.textContent = user.email || 'student';
    if (avatarChip) avatarChip.textContent = (user.email || 'ST').slice(0, 2).toUpperCase();
  }

  const s = Streak.get();
  updateSidebarStreak(s.count);

  navigate(initialHash);

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigate(hash);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

