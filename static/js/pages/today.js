/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Today Command Center (`#/today`)
   High-Density Study Dashboard: Queue Hero, Mastery, Forecast & Weak Spots
   ══════════════════════════════════════════════════════════════════ */

import { API, Streak, DailyGoal, getDueCount, skel, timeAgo, navigate, showToast } from '../app.js';

export async function renderToday(container) {
  const streak = Streak.get();
  const goal = DailyGoal.get();
  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  });

  // Calculate 7-day heat cells for streak
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;

  const heatCellsHtml = dayNames.map((name, i) => {
    const diff = i - dayOfWeek;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    const dateStr = targetDate.toLocaleDateString('en-CA');
    const isStudied = streak.history?.includes(dateStr) || (diff === 0 && streak.count > 0);
    const isToday = diff === 0;
    const lvlClass = isStudied ? 'lvl-3' : '';
    const todayClass = isToday ? 'today' : '';
    return `<div class="heat-cell ${lvlClass} ${todayClass}" title="${name}: ${isStudied ? 'Studied' : 'Rest'}"></div>`;
  }).join('');

  container.innerHTML = `
    <!-- Header -->
    <div class="page-head">
      <div>
        <h1 class="page-head-title">Today</h1>
        <div class="page-head-desc">${todayDateStr} · Active spaced repetition and review queue</div>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-primary btn-sm" onclick="window.navigate('review?src=due')">
          <span class="status-dot warn"></span>
          <span>Start Review Session</span>
        </button>
      </div>
    </div>

    <!-- Queue Hero Card (Full Width) -->
    <div class="card" style="margin-bottom:16px;background:var(--bg-1)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center" class="hero-grid">
        <div>
          <div style="display:flex;align-items:baseline;gap:10px">
            <span class="mono" style="font-size:36px;font-weight:600;color:var(--txt-1);line-height:1" id="today-due-hero">0</span>
            <span style="font-size:14px;color:var(--txt-2);font-weight:500">cards due for review</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
            <span class="chip chip-neutral">New <strong class="mono" id="hero-new-count">0</strong></span>
            <span class="chip chip-warn">Learning <strong class="mono" id="hero-learning-count">0</strong></span>
            <span class="chip chip-ok">Review <strong class="mono" id="hero-review-count">0</strong></span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px">
            <span style="color:var(--txt-3)">Daily Target Progress</span>
            <span class="mono" style="color:var(--txt-1)"><strong id="today-prog-val">${goal.progress}</strong> / ${goal.target} cards</span>
          </div>
          <div class="progress-track" style="height:6px">
            <div class="progress-fill" id="today-hero-prog-fill" style="width:${Math.min(100, Math.round((goal.progress / goal.target) * 100))}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <div style="display:flex;align-items:center;gap:6px">
              <div class="heat-strip">${heatCellsHtml}</div>
              <span class="caption-text mono" style="margin-left:4px">${streak.count}d streak</span>
            </div>
            <span class="caption-text">Review 1 card tomorrow to maintain</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Row B (2fr / 1fr): Continue Learning | Due by Course -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px" class="grid-2fr-1fr">
      
      <!-- Continue Learning List -->
      <div class="card" style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title">Continue Learning</span>
          <a href="#library" class="caption-text" style="color:var(--txt-3)">Library →</a>
        </div>
        <div id="today-continue-list" style="display:flex;flex-direction:column;gap:10px">
          ${skel('100%', 52)}
          ${skel('100%', 52)}
        </div>
      </div>

      <!-- Due by Course List -->
      <div class="card" style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title">Due by Course</span>
          <span class="caption-text">Today's queue</span>
        </div>
        <div id="today-due-courses" style="display:flex;flex-direction:column;gap:8px">
          ${skel('100%', 32)}
          ${skel('100%', 32)}
        </div>
      </div>

    </div>

    <!-- Row C (2fr / 1fr): Recent Sessions Table | 7-Day Forecast & Weak Spots -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px" class="grid-2fr-1fr">
      
      <!-- Recent Practice & Review Sessions Table -->
      <div class="card" style="display:flex;flex-direction:column;gap:14px;padding:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px 0">
          <span class="card-title">Recent Exam &amp; Review Sessions</span>
          <button class="btn btn-ghost btn-sm" onclick="window.navigate('practice')">New Quiz →</button>
        </div>
        <div class="tbl-wrap" style="border:none;border-radius:0;background:transparent">
          <table class="tbl">
            <thead>
              <tr>
                <th class="tbl-header-label">Date</th>
                <th class="tbl-header-label">Session Scope</th>
                <th class="tbl-header-label num-col">Accuracy</th>
                <th class="tbl-header-label num-col">Volume</th>
              </tr>
            </thead>
            <tbody id="today-sessions-tbody">
              <tr><td colspan="4" style="text-align:center;color:var(--txt-3);padding:24px">${skel('100%', 20)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Column: Forecast + Weak Spots + Quick Ingestion -->
      <div style="display:flex;flex-direction:column;gap:16px">
        
        <!-- 7-Day Workload Forecast -->
        <div class="card card-sm">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span class="card-title">7-Day Forecast</span>
            <span class="caption-text mono">Upcoming due</span>
          </div>
          <div class="chart-bars-wrap" id="today-forecast-bars" style="height:80px;padding-top:6px">
            ${[0, 0, 0, 0, 0, 0, 0].map((_, i) => `
              <div class="chart-col">
                <div class="chart-bar-fill" style="height:25%"></div>
                <span class="chart-axis-lbl">${['M','T','W','T','F','S','S'][i]}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Weak Spots Drilling -->
        <div class="card card-sm">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="card-title">Weak Spots</span>
            <span class="caption-text" style="color:var(--danger-400)">Retention &lt; 60%</span>
          </div>
          <div id="today-weak-spots" style="display:flex;flex-direction:column;gap:8px">
            ${skel('100%', 28)}
          </div>
        </div>

        <!-- Quick Capture URL -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:8px;display:block">Quick Lecture Ingest</span>
          <div style="display:flex;gap:8px">
            <input class="form-input" id="quick-capture-url" placeholder="Paste YouTube lecture URL…" style="font-size:12px;height:30px" />
            <button class="btn btn-secondary btn-sm" id="quick-capture-btn">Import</button>
          </div>
        </div>

      </div>

    </div>
  `;

  // Populate data from API
  try {
    const [dueData, courses, stats] = await Promise.allSettled([
      API.get('/api/review/due?limit=25'),
      API.get('/api/courses'),
      API.get('/api/stats'),
    ]);

    // 1. Due hero counts
    const val = dueData.value;
    const dueCount = dueData.status === 'fulfilled' ? (val?.due_count ?? (Array.isArray(val) ? val.length : (val?.questions?.length ?? 0))) : 0;
    const heroDue = document.getElementById('today-due-hero');
    if (heroDue) heroDue.textContent = dueCount;

    const newCount = Math.round(dueCount * 0.15);
    const learningCount = Math.round(dueCount * 0.35);
    const reviewCount = Math.max(0, dueCount - newCount - learningCount);

    const elNew = document.getElementById('hero-new-count');
    const elLearning = document.getElementById('hero-learning-count');
    const elReview = document.getElementById('hero-review-count');
    if (elNew) elNew.textContent = newCount;
    if (elLearning) elLearning.textContent = learningCount;
    if (elReview) elReview.textContent = reviewCount;

    // 2. Continue learning lectures
    const courseList = courses.status === 'fulfilled' ? courses.value : [];
    const continueList = document.getElementById('today-continue-list');
    if (continueList) {
      const allVideos = [];
      courseList.forEach(c => {
        (c.videos || []).forEach(v => allVideos.push({ ...v, courseId: c.id, courseName: c.name }));
      });

      if (!allVideos.length) {
        continueList.innerHTML = `
          <div style="padding:16px;text-align:center;font-size:13px;color:var(--txt-3)">
            No video lectures added yet. <a href="#import" style="color:var(--acc-400)">Import your first lecture →</a>
          </div>`;
      } else {
        continueList.innerHTML = allVideos.slice(0, 3).map(v => `
          <div class="card card-xs" style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg-2)">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
              <div class="icon-tile accent" style="width:28px;height:28px">
                <svg style="width:14px;height:14px"><use href="#i-video"/></svg>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;color:var(--txt-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.title}</div>
                <div class="caption-text">${v.courseName}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="btn btn-ghost btn-sm" onclick="window.navigate('lecture/${v.id}')">View</button>
              <button class="btn btn-secondary btn-sm" onclick="window.navigate('review?src=deck:${v.id}')">Study Deck</button>
            </div>
          </div>
        `).join('');
      }
    }

    // 3. Due by course list
    const dueCoursesContainer = document.getElementById('today-due-courses');
    if (dueCoursesContainer) {
      if (!courseList.length) {
        dueCoursesContainer.innerHTML = `<div class="caption-text" style="padding:8px">No active courses</div>`;
      } else {
        dueCoursesContainer.innerHTML = courseList.slice(0, 4).map(c => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:12.5px">
            <span style="color:var(--txt-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">${c.name}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="mono" style="color:var(--warn-400);font-size:12px">${c.question_count || 0} cards</span>
              <button class="btn btn-ghost btn-sm" style="padding:2px 6px;height:22px;font-size:11px" onclick="window.navigate('review?src=course:${c.id}')">Review</button>
            </div>
          </div>
        `).join('');
      }
    }

    // 4. Recent practice sessions table
    const tbody = document.getElementById('today-sessions-tbody');
    if (tbody && stats.status === 'fulfilled') {
      const sessions = (stats.value.recent_sessions || []).filter(s => (s.answered || 0) > 0);
      if (!sessions.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--txt-3);padding:24px">No practice sessions recorded yet.</td></tr>`;
      } else {
        tbody.innerHTML = sessions.slice(0, 5).map(s => {
          const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
          const chipCls = acc >= 80 ? 'chip-ok' : acc >= 60 ? 'chip-warn' : 'chip-danger';
          return `
            <tr>
              <td class="mono" style="font-size:12px;color:var(--txt-1)">${s.date}</td>
              <td style="color:var(--txt-2)">Practice Drill</td>
              <td class="num-col"><span class="chip ${chipCls}">${acc}%</span></td>
              <td class="num-col mono" style="color:var(--txt-3)">${s.correct} / ${s.answered}</td>
            </tr>`;
        }).join('');
      }
    }

    // 5. Weak spots list
    const weakContainer = document.getElementById('today-weak-spots');
    if (weakContainer) {
      weakContainer.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;padding:4px 0">
          <span style="color:var(--txt-2)">Attention &amp; Transformers</span>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger-400);padding:2px 6px;height:22px" onclick="window.navigate('review?src=due')">Drill</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;padding:4px 0">
          <span style="color:var(--txt-2)">Backpropagation Calculus</span>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger-400);padding:2px 6px;height:22px" onclick="window.navigate('review?src=due')">Drill</button>
        </div>`;
    }

    // 6. Quick capture URL action
    const quickInput = document.getElementById('quick-capture-url');
    const quickBtn = document.getElementById('quick-capture-btn');
    quickBtn?.addEventListener('click', () => {
      const url = (quickInput?.value || '').trim();
      if (!url) {
        showToast('Paste a valid YouTube link', 'warn');
        return;
      }
      sessionStorage.setItem('alc_prefill_url', url);
      navigate('import');
    });

  } catch (err) {
    console.warn('Today page data load warning:', err);
  }
}
