import { API, animateCount, navigate, Streak, DailyGoal, icon, skel, mapStats, getDueCount } from '../app.js';

const QUOTES = [
  { q: "The more that you read, the more things you will know.", a: "Dr. Seuss" },
  { q: "Education is not the filling of a pail, but the lighting of a fire.", a: "W.B. Yeats" },
  { q: "An investment in knowledge pays the best interest.", a: "Benjamin Franklin" },
  { q: "Live as if you were to die tomorrow. Learn as if you were to live forever.", a: "Mahatma Gandhi" },
  { q: "The beautiful thing about learning is that nobody can take it away from you.", a: "B.B. King" },
  { q: "Knowledge is power. Information is liberating.", a: "Kofi Annan" },
  { q: "Intellectual growth should commence at birth and cease only at death.", a: "Albert Einstein" },
  { q: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", a: "Benjamin Franklin" },
];

export async function renderDashboard(container) {
  let quoteIdx = Math.floor(Math.random() * QUOTES.length);
  const quote = QUOTES[quoteIdx];
  const streak = Streak.get();
  const goal = DailyGoal.get();
  const pct = DailyGoal.pct(goal);
  const done = DailyGoal.isDone(goal);

  // SVG Ring maths
  const R = 44;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (pct / 100) * CIRC;

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  // Calculate 7-day dot statuses
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Mon, 6 = Sun

  const dayDotsHtml = dayNames.map((name, i) => {
    const diff = i - dayOfWeek;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    const dateStr = targetDate.toLocaleDateString('en-CA');
    const isStudied = streak.history?.includes(dateStr) || (diff === 0 && streak.count > 0);
    const isFuture = diff > 0;
    return `
      <div class="day-dot ${isStudied ? 'active' : ''}" style="${isFuture ? 'opacity:0.35' : ''}">
        <div class="day-dot-circle"></div>
        <span class="day-dot-lbl">${name}</span>
      </div>`;
  }).join('');

  container.innerHTML = `
    <!-- Hero Banner with AI Visual Artwork Background -->
    <div class="hero-art-banner rev" style="--i:0">
      <img src="/static/img/hero_workspace.jpg" alt="Workspace Aura" class="hero-art-bg" />
      <div class="hero-art-content">
        <div class="pill pill-teal" style="margin-bottom:12px;font-size:0.72rem">
          ${icon('sparkles', '', 'width:12px;height:12px')}
          <span>AI Study Companion</span>
        </div>
        <h1 class="page-title" style="font-size:2.4rem;margin-bottom:8px">Welcome to your <em>Workspace</em></h1>
        <p class="page-subtitle" style="margin-top:0;font-size:0.92rem;max-width:520px">
          Continuous spaced repetition, active recall analytics, and lecture synthesis.
        </p>
        <div style="display:flex;align-items:center;gap:12px;margin-top:20px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="window.navigate('review')">
            ${icon('rotate-cw', '', 'width:14px;height:14px')}
            <span>Start Daily Review</span>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="window.navigate('add-video')">
            ${icon('plus', '', 'width:14px;height:14px')}
            <span>Import Lecture</span>
          </button>
          <div class="pill pill-amber" style="padding:6px 12px;font-size:0.75rem;margin-left:auto">
            ${icon('calendar', '', 'width:13px;height:13px')}
            <span>${todayDateStr}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bento Grid Row 1: Streak (span-1) | Daily Goal (span-1) | Quote (span-2) -->
    <div class="bento-grid rev" style="margin-bottom:16px;--i:1">

      <!-- 1. Active Streak Card -->
      <div class="card tilt-card span-1" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <span class="card-title">Active streak</span>
            <div class="flame-sticker">
              ${icon('flame', '', 'width:18px;height:18px')}
            </div>
          </div>
          <div style="display:flex;align-items:baseline;gap:6px;margin-top:10px">
            <span class="serif-num" style="font-size:3.4rem;color:var(--amber)" id="dash-streak-num">${streak.count || 1}</span>
            <span style="color:var(--muted);font-size:0.95rem;font-weight:600">days</span>
          </div>
        </div>
        <div>
          <div class="day-dots">${dayDotsHtml}</div>
          <div style="font-size:0.72rem;color:var(--faint);margin-top:12px">Review 1 card tomorrow to maintain streak.</div>
        </div>
      </div>

      <!-- 2. Daily Goal -->
      <div class="card tilt-card span-1" style="display:flex;flex-direction:column;justify-content:space-between">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title">Daily target</span>
          <button id="goal-edit-btn" class="btn btn-ghost btn-sm" style="padding:3px 7px" title="Change Target">
            ${icon('settings-2', '', 'width:13px;height:13px')}
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:16px;margin:8px 0">
          <div class="goal-ring-wrap">
            <svg class="goal-ring-svg" width="86" height="86" viewBox="0 0 100 100">
              <circle class="goal-ring-track" cx="50" cy="50" r="${R}" stroke-width="8"/>
              <circle id="dash-goal-fill" class="goal-ring-fill" cx="50" cy="50" r="${R}" stroke-width="8"
                      stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
            </svg>
            <div class="goal-ring-center">
              <div class="serif-num" style="font-size:1.35rem;color:var(--teal)" id="dash-goal-pct">0%</div>
            </div>
          </div>

          <div>
            <div style="font-size:0.92rem;font-weight:600;color:var(--text)">
              <span style="color:var(--teal)">${goal.progress}</span> / ${goal.target}
            </div>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:2px">cards reviewed today</div>
            <span class="pill ${done ? 'pill-green' : 'pill-teal'}" style="font-size:0.62rem;margin-top:6px">
              ${done ? 'Target Met' : 'In Progress'}
            </span>
          </div>
        </div>

        <div style="font-size:0.72rem;color:var(--faint)">Resets at midnight automatically.</div>
      </div>

      <!-- 3. Quote of the Day -->
      <div class="card tilt-card span-2" style="display:flex;flex-direction:column;justify-content:space-between;position:relative">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title" style="color:var(--muted)">Daily focus</span>
          <button id="dash-refresh-quote" class="btn btn-ghost btn-sm" style="padding:3px 7px" title="New Quote">
            ${icon('rotate-cw', '', 'width:13px;height:13px')}
          </button>
        </div>

        <div style="display:flex;gap:14px;align-items:flex-start;margin:12px 0">
          <div style="color:var(--teal);opacity:0.4;flex-shrink:0;margin-top:-2px">
            ${icon('quote', '', 'width:24px;height:24px')}
          </div>
          <div>
            <div id="dash-quote-text" style="font-size:1.15rem;line-height:1.45;color:var(--text);font-weight:500;letter-spacing:-0.01em">
              "${quote.q}"
            </div>
            <div id="dash-quote-author" style="margin-top:8px;font-size:0.8rem;font-weight:600;color:var(--teal)">
              — ${quote.a}
            </div>
          </div>
        </div>

        <div style="font-size:0.72rem;color:var(--faint)">Active recall forms stronger neural pathways than passive re-reading.</div>
      </div>
    </div>

    <!-- Bento Grid Row 2: Rotating Amber Border Due CTA (span-2) | Merged Library Metrics (span-2) -->
    <div class="bento-grid rev" style="margin-bottom:16px;--i:2">

      <!-- 4. Due Review Queue Card -->
      <div class="card tilt-card span-2 cta-live" style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 28px">
        <div style="display:flex;align-items:center;gap:18px">
          <div class="icon-chip amber" style="width:48px;height:48px">
            ${icon('alarm-clock', '', 'width:24px;height:24px')}
          </div>
          <div>
            <span class="card-title">Due for review</span>
            <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px">
              <span class="serif-num" style="font-size:3rem;color:var(--amber)" id="dash-due-count">0</span>
              <span style="color:var(--muted);font-size:0.9rem;font-weight:500">cards ready</span>
            </div>
            <div style="font-size:0.75rem;color:var(--faint);margin-top:2px">SM-2 interval scheduling algorithm active</div>
          </div>
        </div>

        <button class="btn btn-amber btn-lg" id="dash-start-review" style="white-space:nowrap">
          <span>Start Review</span>
          ${icon('arrow-right', '', 'width:16px;height:16px')}
        </button>
      </div>

      <!-- 5. Merged Library Metrics Card (3 Columns: Courses | Lectures | Questions) -->
      <div class="card tilt-card span-2 library-split-card" style="padding:14px 10px">
        
        <div class="library-split-col">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="icon-chip teal" style="width:28px;height:28px">${icon('book-open', '', 'width:14px;height:14px')}</div>
              <span class="card-title" style="font-size:0.8rem">Courses</span>
            </div>
            <div class="serif-num" style="font-size:2.2rem;margin:6px 0;color:var(--text-pure)" id="dash-courses-num">0</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="window.navigate('browse')" style="justify-content:space-between;padding:4px 8px;font-size:0.75rem">
            <span>Browse</span>
            ${icon('arrow-right', '', 'width:12px;height:12px')}
          </button>
        </div>

        <div class="library-split-col">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="icon-chip sky" style="width:28px;height:28px">${icon('clapperboard', '', 'width:14px;height:14px')}</div>
              <span class="card-title" style="font-size:0.8rem">Lectures</span>
            </div>
            <div class="serif-num" style="font-size:2.2rem;margin:6px 0;color:var(--text-pure)" id="dash-videos-num">0</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="window.navigate('add-video')" style="justify-content:space-between;padding:4px 8px;font-size:0.75rem">
            <span>Add New</span>
            ${icon('plus', '', 'width:12px;height:12px')}
          </button>
        </div>

        <div class="library-split-col">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="icon-chip amber" style="width:28px;height:28px">${icon('help-circle', '', 'width:14px;height:14px')}</div>
              <span class="card-title" style="font-size:0.8rem">Quiz Cards</span>
            </div>
            <div class="serif-num" style="font-size:2.2rem;margin:6px 0;color:var(--amber)" id="dash-questions-num">0</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="window.navigate('quiz')" style="justify-content:space-between;padding:4px 8px;font-size:0.75rem">
            <span>Take Quiz</span>
            ${icon('arrow-right', '', 'width:12px;height:12px')}
          </button>
        </div>

      </div>
    </div>

    <!-- 7-Day Activity Flex Bars -->
    <div class="card tilt-card rev" style="margin-bottom:24px;--i:3">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div>
          <h3 style="font-size:1.15rem">7-Day Study Volume</h3>
          <span class="mono-meta">Cards reviewed per day</span>
        </div>
        <span id="dash-act-max-lbl" class="mono-meta">MAX: 10 CARDS</span>
      </div>

      <div id="dash-activity-bars-wrap">
        <div class="activity-bars" id="dash-activity-bars">
          ${[0, 0, 0, 0, 0, 0, 0].map((_, i) => `
            <div class="act-bar-col">
              <div class="act-bar-fill" style="height:10%"></div>
              <span class="act-bar-lbl">${['M','T','W','T','F','S','S'][i]}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Quick Navigation Tiles -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px" class="rev" style="--i:4">
      <div class="quick-action-tile tilt-card" onclick="window.navigate('add-video')">
        <div class="icon-chip teal" style="width:42px;height:42px">
          ${icon('video', '', 'width:20px;height:20px')}
        </div>
        <div>
          <div style="font-weight:600;font-size:0.92rem;color:var(--text-pure)">Add Video Lecture</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px">Import YouTube transcripts to auto-generate cards.</div>
        </div>
        <span class="action-arrow">${icon('chevron-right', '', 'width:16px;height:16px')}</span>
      </div>

      <div class="quick-action-tile tilt-card" onclick="window.navigate('flashcards')">
        <div class="icon-chip sky" style="width:42px;height:42px">
          ${icon('layers', '', 'width:20px;height:20px')}
        </div>
        <div>
          <div style="font-weight:600;font-size:0.92rem;color:var(--text-pure)">3D Flashcard Decks</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px">Interactive concept flip cards with spacebar shortcuts.</div>
        </div>
        <span class="action-arrow">${icon('chevron-right', '', 'width:16px;height:16px')}</span>
      </div>

      <div class="quick-action-tile tilt-card" onclick="window.navigate('stats')">
        <div class="icon-chip amber" style="width:42px;height:42px">
          ${icon('bar-chart-3', '', 'width:20px;height:20px')}
        </div>
        <div>
          <div style="font-weight:600;font-size:0.92rem;color:var(--text-pure)">Retention Analytics</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px">Comprehension graphs & historical sessions.</div>
        </div>
        <span class="action-arrow">${icon('chevron-right', '', 'width:16px;height:16px')}</span>
      </div>
    </div>
  `;

  // Animate Goal Ring
  const fillEl = document.getElementById('dash-goal-fill');
  const pctEl = document.getElementById('dash-goal-pct');
  if (fillEl) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fillEl.style.strokeDashoffset = offset;
      });
    });
  }
  if (pctEl) animateCount(pctEl, pct, 700, '%');

  // Event Listeners
  document.getElementById('dash-start-review')?.addEventListener('click', () => navigate('review'));
  document.getElementById('dash-refresh-quote')?.addEventListener('click', () => {
    quoteIdx = (quoteIdx + 1) % QUOTES.length;
    const nq = QUOTES[quoteIdx];
    const qt = document.getElementById('dash-quote-text');
    const qa = document.getElementById('dash-quote-author');
    if (qt) qt.textContent = `"${nq.q}"`;
    if (qa) qa.textContent = `— ${nq.a}`;
  });

  document.getElementById('goal-edit-btn')?.addEventListener('click', () => {
    const target = prompt('Set daily card target (e.g. 15):', goal.target);
    if (target) {
      DailyGoal.save(goal.type, target);
      renderDashboard(container);
    }
  });

  // Hydrate Live Backend Data
  try {
    const [rawStats, courses, dueCount] = await Promise.all([
      API.get('/api/stats').catch(() => ({})),
      API.get('/api/courses').catch(() => []),
      getDueCount(),
    ]);

    const s = mapStats(rawStats);
    const totalCourses = s.courses || courses.length || 0;
    const totalVideos = s.videos || courses.reduce((a, c) => a + (c.videos?.length || c.video_count || 0), 0);
    const totalQuestions = s.questions || courses.reduce((a, c) => a + (c.question_count || 0), 0);
    const finalDue = dueCount || s.due || 0;

    animateCount(document.getElementById('dash-due-count'), finalDue);
    animateCount(document.getElementById('dash-questions-num'), totalQuestions);
    animateCount(document.getElementById('dash-courses-num'), totalCourses);
    animateCount(document.getElementById('dash-videos-num'), totalVideos);

    // Populate Activity Bars
    const sessions = s.recent_sessions || [];
    const barsWrap = document.getElementById('dash-activity-bars-wrap');
    const maxLbl = document.getElementById('dash-act-max-lbl');

    if (barsWrap) {
      if (!sessions.length || sessions.every(x => (x.answered || 0) === 0)) {
        barsWrap.innerHTML = `
          <div style="padding:28px 16px;text-align:center;color:var(--faint);font-size:0.85rem">
            No quiz sessions recorded yet — complete your first quiz or daily review to chart activity.
          </div>`;
      } else {
        const maxVal = Math.max(...sessions.map(x => x.answered || 0), 10);
        if (maxLbl) maxLbl.textContent = `PEAK: ${maxVal} CARDS`;
        const recent7 = sessions.slice(0, 7).reverse();
        const todayStr = new Date().toISOString().split('T')[0];

        barsWrap.innerHTML = `
          <div class="activity-bars" id="dash-activity-bars">
            ${recent7.map((sess, i) => {
              const heightPct = Math.max(10, Math.round(((sess.answered || 0) / maxVal) * 100));
              const isToday = sess.date === todayStr || i === recent7.length - 1;
              const dayLabel = sess.date ? new Date(sess.date).toLocaleDateString('en-US', { weekday: 'narrow' }) : '•';
              return `
                <div class="act-bar-col" title="${sess.date}: ${sess.answered} cards">
                  <div class="act-bar-fill ${isToday ? 'today' : ''}" style="height:${heightPct}%"></div>
                  <span class="act-bar-lbl" style="${isToday ? 'color:var(--amber);font-weight:700' : ''}">${dayLabel}</span>
                </div>`;
            }).join('')}
          </div>`;
      }
    }
  } catch (e) {
    console.error('Dashboard data load error:', e);
  }
}
