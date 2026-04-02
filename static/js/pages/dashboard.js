import { API, animateCount, navigate, Streak, staggerElements } from '../app.js';

const QUOTES = [
  { q: "The more that you read, the more things you will know.", a: "Dr. Seuss" },
  { q: "Education is not the filling of a pail, but the lighting of a fire.", a: "W.B. Yeats" },
  { q: "An investment in knowledge pays the best interest.", a: "Benjamin Franklin" },
  { q: "Live as if you were to die tomorrow. Learn as if you were to live forever.", a: "Gandhi" },
  { q: "The beautiful thing about learning is that nobody can take it away from you.", a: "B.B. King" },
  { q: "Knowledge is power. Information is liberating.", a: "Kofi Annan" },
  { q: "Intellectual growth should commence at birth and cease only at death.", a: "Albert Einstein" },
];

export async function renderDashboard(container) {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const streak = Streak.get();

  // Render full skeleton immediately — user sees layout in <16ms
  container.innerHTML = `
    <div class="page-header enter" style="animation-delay:0ms">
      <div class="page-icon-wrap">🏠</div>
      <div class="page-title-text">
        <h1>Dashboard</h1>
        <p class="page-subtitle">${greeting()} Let's keep the momentum going.</p>
      </div>
    </div>

    <!-- Streak + Quote row -->
    <div style="display:grid;grid-template-columns:auto 1fr;gap:16px;margin-bottom:28px;align-items:stretch" class="enter" style="animation-delay:60ms">
      <div class="streak-display" style="flex-direction:column;text-align:center;min-width:130px;justify-content:center">
        <div class="streak-flame">🔥</div>
        <div class="streak-num" id="streak-num">0</div>
        <div class="streak-label">Day Streak</div>
      </div>
      <div class="card" style="padding:20px 24px;display:flex;align-items:center">
        <div>
          <div style="font-size:1.1rem;font-weight:500;line-height:1.5;color:var(--text);font-style:italic">"${quote.q}"</div>
          <div style="font-size:.78rem;color:var(--text-3);margin-top:8px">— ${quote.a}</div>
        </div>
      </div>
    </div>

    <!-- Metrics skeleton -->
    <div class="metric-grid stagger-children" id="metric-grid">
      ${metric('📚','courses','Courses','teal')}
      ${metric('🎬','videos','Videos','teal')}
      ${metric('❓','questions','Questions','amber')}
      ${metric('🔔','due','Due Today','amber')}
      ${metric('🎯','accuracy','Accuracy','teal','%')}
    </div>

    <!-- Quick actions -->
    <div class="section-hdr enter" style="margin-top:8px">
      <div>
        <div class="section-title">Quick Actions</div>
        <div class="section-sub">Jump straight in</div>
      </div>
    </div>
    <div class="quick-actions stagger-children" id="quick-actions">
      <div class="quick-card card-tilt" data-goto="add-video">
        <div class="quick-card-icon">📚</div>
        <div class="quick-card-title">Add Video</div>
        <div class="quick-card-desc">Process a YouTube video with AI</div>
      </div>
      <div class="quick-card card-tilt" data-goto="flashcards">
        <div class="quick-card-icon">🃏</div>
        <div class="quick-card-title">Flashcards</div>
        <div class="quick-card-desc">Drill your key concepts</div>
      </div>
      <div class="quick-card card-tilt" data-goto="quiz">
        <div class="quick-card-icon">🧠</div>
        <div class="quick-card-title">Practice Quiz</div>
        <div class="quick-card-desc">Test what you know</div>
      </div>
      <div class="quick-card card-tilt" data-goto="review">
        <div class="quick-card-icon">🔁</div>
        <div class="quick-card-title">Daily Review</div>
        <div class="quick-card-desc">SRS cards due today</div>
      </div>
    </div>

    <!-- Recent courses -->
    <div class="section-hdr enter" style="margin-top:28px">
      <div>
        <div class="section-title">Recent Courses</div>
        <div class="section-sub">Your content library</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="window.navigate && navigate('browse')">View all →</button>
    </div>
    <div id="recent-courses">
      <!-- Skeleton rows -->
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[1,2,3].map(() => `
          <div class="card card-sm skel-row" style="display:flex;justify-content:space-between;align-items:center">
            <div class="skel" style="width:140px;height:14px;border-radius:6px"></div>
            <div class="skel" style="width:50px;height:20px;border-radius:99px"></div>
          </div>`).join('')}
      </div>
    </div>
  `;

  // Wire up interactions immediately (no awaiting)
  staggerElements('#metric-grid .metric-card', 70);
  staggerElements('#quick-actions .quick-card', 60);
  setTimeout(() => animateCount(document.getElementById('streak-num'), streak.count, 600), 200);
  document.querySelectorAll('.quick-card[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  // Load stats & courses in parallel (not sequentially!)
  try {
    const [s, courses] = await Promise.all([
      API.get('/api/stats'),
      API.get('/api/courses'),
    ]);

    // Fill metrics
    fillMetric('courses',   s.courses || 0);
    fillMetric('videos',    s.videos  || 0);
    fillMetric('questions', s.total_questions || 0);
    fillMetric('due',       s.due_questions   || 0);
    fillMetric('accuracy',  s.accuracy || 0, '%');

    // Recent courses — replace skeletons
    const rc = document.getElementById('recent-courses');
    if (!rc) return;
    if (!courses.length) {
      rc.innerHTML = `<div class="card card-sm" style="color:var(--text-2);text-align:center;padding:28px">
        No content yet — <span class="link" style="cursor:pointer" id="add-first">add your first video!</span>
      </div>`;
      document.getElementById('add-first')?.addEventListener('click', () => navigate('add-video'));
    } else {
      rc.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        ${courses.slice(0, 4).map((c, i) => `
          <div class="card card-sm" style="display:flex;justify-content:space-between;align-items:center;animation-delay:${i*60}ms;cursor:pointer" data-course="${c.id}">
            <div>
              <span style="font-weight:700;font-size:.9rem">${c.name}</span>
              <span style="margin-left:10px;font-size:.75rem;color:var(--text-3)">${c.video_count} video${c.video_count!==1?'s':''}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="badge badge-teal">${c.question_count} Qs</span>
              <span style="color:var(--text-3);font-size:.8rem">→</span>
            </div>
          </div>`).join('')}
      </div>`;
      document.querySelectorAll('[data-course]').forEach(el => {
        el.addEventListener('click', () => navigate('browse'));
      });
    }
  } catch { /**/ }
}

function metric(icon, id, label, color, suffix = '') {

  return `
    <div class="metric-card card-tilt">
      <div class="metric-icon">${icon}</div>
      <div class="metric-val ${color}" id="m-${id}">—</div>
      <div class="metric-label">${label}</div>
    </div>`;
}

function fillMetric(id, val, suffix = '') {
  const el = document.getElementById(`m-${id}`);
  if (el) animateCount(el, val, 800, suffix);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning! ☀️';
  if (h < 17) return 'Good afternoon! 🌤️';
  return 'Good evening! 🌙';
}
