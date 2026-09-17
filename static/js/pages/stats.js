import { API, animateCount, icon, skel, mapStats } from '../app.js';

export async function renderStats(container) {
  container.innerHTML = `
    <!-- Header Banner with AI Visual Artwork -->
    <div class="hero-art-banner rev" style="--i:0">
      <img src="/static/img/analytics_matrix_art.jpg" alt="Telemetry Matrix" class="hero-art-bg" />
      <div class="hero-art-content">
        <div class="pill pill-teal" style="margin-bottom:12px;font-size:0.72rem">
          ${icon('bar-chart-3', '', 'width:12px;height:12px')}
          <span>Spaced Repetition Telemetry</span>
        </div>
        <h1 class="page-title" style="font-size:2.4rem;margin-bottom:8px">Learning <em>Analytics</em></h1>
        <p class="page-subtitle" style="margin-top:0;font-size:0.92rem;max-width:540px">
          Historical exam session performance, recall accuracy curves, and study volume tracking.
        </p>
      </div>
    </div>

    <div id="stats-body">
      <div style="display:grid;grid-template-columns:220px 1fr;gap:16px;margin-bottom:16px">
        ${skel('100%', 200, 14)}
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px">
          ${skel('100%', 90, 12)}
          ${skel('100%', 90, 12)}
          ${skel('100%', 90, 12)}
          ${skel('100%', 90, 12)}
        </div>
      </div>
      ${skel('100%', 240, 14)}
    </div>
  `;

  try {
    const raw = await API.get('/api/stats');
    const s = mapStats(raw);
    renderData(s);
  } catch (e) {
    document.getElementById('stats-body').innerHTML = `
      <div class="card" style="text-align:center;padding:48px;color:var(--coral)">
        Error: ${e.message}
      </div>`;
  }
}

function renderData(s) {
  const sessions = (s.recent_sessions || []).filter(x => (x.answered || 0) > 0);
  const maxAns = Math.max(...sessions.map(x => x.answered || 0), 10);
  const body = document.getElementById('stats-body');
  if (!body) return;

  const R = 44;
  const C = 2 * Math.PI * R;
  const acc = s.accuracy || 0;
  const offset = C - (acc / 100) * C;

  body.innerHTML = `
    <!-- Top Grid: Accuracy Ring + 4 Metric Cards -->
    <div style="display:grid;grid-template-columns:220px 1fr;gap:16px;margin-bottom:16px;align-items:stretch">

      <!-- Accuracy Ring Card -->
      <div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px">
        <div class="goal-ring-wrap" style="margin-bottom:10px">
          <svg class="goal-ring-svg" width="108" height="108" viewBox="0 0 100 100">
            <circle class="goal-ring-track" cx="50" cy="50" r="${R}" stroke-width="8"/>
            <circle id="stat-acc-ring" class="goal-ring-fill" cx="50" cy="50" r="${R}" stroke-width="8"
                    stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
          </svg>
          <div class="goal-ring-center">
            <div class="serif-num" style="font-size:1.8rem;color:var(--teal)" id="stat-acc-val">0%</div>
            <div class="mono-meta" style="font-size:0.6rem">RETENTION</div>
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--muted);font-weight:500">${accLabel(acc)}</div>
      </div>

      <!-- 4 Bento Metric Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px">
        <div class="card card-sm">
          <div class="icon-chip teal" style="width:32px;height:32px;margin-bottom:8px">${icon('book-open', '', 'width:16px;height:16px')}</div>
          <div class="serif-num" style="font-size:2.2rem;color:var(--text)" id="sm-courses">0</div>
          <div class="card-title" style="font-size:0.8rem">Courses</div>
        </div>
        <div class="card card-sm">
          <div class="icon-chip sky" style="width:32px;height:32px;margin-bottom:8px">${icon('clapperboard', '', 'width:16px;height:16px')}</div>
          <div class="serif-num" style="font-size:2.2rem;color:var(--text)" id="sm-videos">0</div>
          <div class="card-title" style="font-size:0.8rem">Lectures</div>
        </div>
        <div class="card card-sm">
          <div class="icon-chip amber" style="width:32px;height:32px;margin-bottom:8px">${icon('brain-circuit', '', 'width:16px;height:16px')}</div>
          <div class="serif-num" style="font-size:2.2rem;color:var(--amber)" id="sm-questions">0</div>
          <div class="card-title" style="font-size:0.8rem">Questions</div>
        </div>
        <div class="card card-sm">
          <div class="icon-chip coral" style="width:32px;height:32px;margin-bottom:8px">${icon('alarm-clock', '', 'width:16px;height:16px')}</div>
          <div class="serif-num" style="font-size:2.2rem;color:var(--coral)" id="sm-due">0</div>
          <div class="card-title" style="font-size:0.8rem">Due Today</div>
        </div>
      </div>
    </div>

    <!-- Recent Sessions History -->
    <div class="card" style="margin-bottom:16px;padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <h3 style="font-size:1.25rem">Session History</h3>
          <span class="mono-meta">Recorded practice exam logs</span>
        </div>
        <span class="pill pill-teal">${sessions.length} sessions</span>
      </div>

      ${sessions.length === 0 ? `
        <div style="text-align:center;padding:24px;color:var(--muted);font-size:0.88rem">
          Complete a quiz to record telemetry metrics.
        </div>` : sessions.map((sess, i) => {
          const sessAcc = sess.answered ? Math.round((sess.correct / sess.answered) * 100) : 0;
          const barPct = Math.round((sess.answered / maxAns) * 100);
          const pillCls = sessAcc >= 80 ? 'pill-green' : sessAcc >= 60 ? 'pill-teal' : 'pill-coral';
          return `
            <div style="margin-bottom:${i < sessions.length - 1 ? '12px' : '0'};padding-bottom:${i < sessions.length - 1 ? '12px' : '0'};border-bottom:${i < sessions.length - 1 ? '1px solid var(--line)' : 'none'}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span class="mono-meta" style="color:var(--text)">${sess.date}</span>
                <div style="display:flex;gap:8px;align-items:center">
                  <span class="pill ${pillCls}" style="font-size:0.65rem">${sessAcc}%</span>
                  <span class="mono-meta" style="font-size:0.7rem">${sess.correct}/${sess.answered} correct</span>
                </div>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${sessAcc < 70 ? 'amber' : ''}" style="width:${barPct}%"></div>
              </div>
            </div>`;
        }).join('')}
    </div>

    <!-- Cloud Info -->
    <div class="card card-sm" style="display:flex;justify-content:space-between;align-items:center;background:rgba(45,212,168,0.03)">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--emerald);box-shadow:0 0 8px rgba(52,211,153,0.6)"></span>
        <div>
          <div style="font-weight:600;font-size:0.85rem">Supabase PostgreSQL Cloud DB</div>
          <div class="mono-meta" style="font-size:0.65rem">Multi-Tenant Tenant Isolation Active</div>
        </div>
      </div>
      <span class="pill pill-green">Online</span>
    </div>
  `;

  setTimeout(() => {
    animateCount(document.getElementById('sm-courses'), s.courses || 0);
    animateCount(document.getElementById('sm-videos'), s.videos || 0);
    animateCount(document.getElementById('sm-questions'), s.questions || 0);
    animateCount(document.getElementById('sm-due'), s.due || 0);

    const ring = document.getElementById('stat-acc-ring');
    const val = document.getElementById('stat-acc-val');
    if (ring) ring.style.strokeDashoffset = offset;
    if (val) animateCount(val, acc, 700, '%');
  }, 80);
}

function accLabel(acc) {
  if (acc >= 90) return 'High Mastery ✦';
  if (acc >= 75) return 'Solid Retention';
  if (acc >= 50) return 'Moderate Recall';
  if (acc > 0) return 'Building Memory';
  return 'No quiz data yet';
}
