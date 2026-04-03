import { API, animateCount, staggerElements } from '../app.js';

export async function renderStats(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap amber">📈</div>
      <div class="page-title-text">
        <h1 class="amber-title">Statistics</h1>
        <p class="page-subtitle">Your learning journey at a glance</p>
      </div>
    </div>
    <div id="stats-body">
      <div class="loading-state"><div class="spinner"></div><span>Loading your stats…</span></div>
    </div>
  `;

  try {
    const s = await API.get('/api/stats');
    renderData(s);
  } catch (e) {
    document.getElementById('stats-body').innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${e.message}</div></div>`;
  }
}

function renderData(s) {
  const sessions = s.recent_sessions || [];
  const maxAns   = Math.max(...sessions.map(x => x.answered), 1);
  const body     = document.getElementById('stats-body');

  // Accuracy ring circumference (r = 54)
  const R  = 54;
  const C  = 2 * Math.PI * R;
  const acc = s.accuracy || 0;
  const offset = C - (acc / 100) * C;

  body.innerHTML = `
    <!-- Top row: ring + metrics -->
    <div style="display:grid;grid-template-columns:200px 1fr;gap:24px;margin-bottom:28px;align-items:start" class="enter">

      <!-- Accuracy ring -->
      <div class="card" style="text-align:center;padding:28px 20px">
        <div class="ring-wrap" style="width:130px;height:130px;margin:0 auto 14px">
          <svg class="ring-svg" width="130" height="130" viewBox="0 0 130 130">
            <circle class="ring-track" cx="65" cy="65" r="${R}" stroke-width="10"/>
            <circle class="ring-fill" id="acc-ring" cx="65" cy="65" r="${R}" stroke-width="10"
              stroke-dasharray="${C}" stroke-dashoffset="${C}"
              style="transition:stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)"/>
          </svg>
          <div class="ring-label">
            <div id="acc-val" style="font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:800;
              background:var(--grad-teal);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
              0%
            </div>
            <div style="font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">Accuracy</div>
          </div>
        </div>
        <div style="font-size:.8rem;color:var(--text-2)">${accLabel(acc)}</div>
      </div>

      <!-- Metric grid -->
      <div class="metric-grid stagger-children" id="metric-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
        ${mcard('📚','courses', s.courses||0,'Courses','teal')}
        ${mcard('🎬','videos',  s.videos||0, 'Videos','teal')}
        ${mcard('❓','questions',s.total_questions||0,'Questions','amber')}
        ${mcard('🔔','due',     s.due_questions||0,'Due Today','amber')}
      </div>
    </div>

    <!-- Session history -->
    <div class="card enter" style="animation-delay:120ms">
      <div class="section-hdr" style="margin-bottom:20px">
        <div>
          <div class="section-title">Recent Sessions</div>
          <div class="section-sub">Last ${sessions.length} quiz/review sessions</div>
        </div>
        <span class="badge badge-teal">${sessions.length}</span>
      </div>

      ${sessions.length === 0
        ? `<div class="empty-state" style="padding:20px">
             <div class="empty-icon" style="font-size:1.8rem">📊</div>
             <div>Complete a quiz to see your history</div>
           </div>`
        : sessions.map((sess, i) => {
            const sessAcc = sess.answered ? Math.round((sess.correct / sess.answered) * 100) : 0;
            const barPct  = Math.round((sess.answered / maxAns) * 100);
            return `
              <div style="margin-bottom:${i < sessions.length - 1 ? '16px' : '0'}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                  <span style="font-size:.8rem;color:var(--text-2)">${sess.date}</span>
                  <div style="display:flex;gap:8px;align-items:center">
                    <span class="badge badge-${sessAcc >= 70 ? 'green' : 'amber'}">${sessAcc}%</span>
                    <span style="font-size:.78rem;color:var(--text-3)">${sess.correct}/${sess.answered}</span>
                  </div>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${barPct}%;background:${sessAcc >= 70 ? 'var(--grad-teal)' : 'var(--grad-amber)'}"></div>
                </div>
              </div>`;
          }).join('')}
    </div>

    <div class="card enter" style="margin-top:18px;animation-delay:160ms;border-color:var(--border-a)">
      <div class="section-hdr" style="margin-bottom:0">
        <div>
          <div class="section-title" style="color:var(--amber)">☁️ Database</div>
          <div class="section-sub">Connection: ${s.path || '—'}</div>
        </div>
        <span class="badge badge-amber">Online</span>
      </div>
    </div>
  `;

  // Animate metrics
  staggerElements('#metric-grid .metric-card', 70);
  setTimeout(() => {
    ['courses','videos','questions','due'].forEach(id => {
      const el = document.getElementById(`mv-${id}`);
      if (el) animateCount(el, parseFloat(el.getAttribute('data-val')), 900);
    });
    // Animate ring
    document.getElementById('acc-ring').style.strokeDashoffset = offset;
    animateCount(document.getElementById('acc-val'), acc, 1100, '%');
  }, 200);
}

function mcard(icon, id, val, label, color) {
  return `
    <div class="metric-card card-tilt">
      <div class="metric-icon">${icon}</div>
      <div class="metric-val ${color}" id="mv-${id}" data-val="${val}">0</div>
      <div class="metric-label">${label}</div>
    </div>`;
}

function accLabel(acc) {
  if (acc >= 90) return '⭐ Outstanding!';
  if (acc >= 80) return '✅ Great work!';
  if (acc >= 60) return '📈 Getting there!';
  if (acc  > 0)  return '💪 Keep practicing!';
  return 'Complete quizzes to track accuracy';
}
