import { API, animateCount, navigate, Streak, staggerElements, DailyGoal, launchConfetti } from '../app.js';

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
  const quote  = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const streak = Streak.get();
  const goal   = DailyGoal.get();
  const pct    = DailyGoal.pct(goal);
  const done   = DailyGoal.isDone(goal);

  // SVG ring maths
  const R = 52, STROKE = 9;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (pct / 100) * CIRC;

  const goalTypeLabel = goal.type === 'minutes' ? 'min study' : 'cards';
  const goalEmoji     = done ? '🏆' : goal.type === 'minutes' ? '⏱️' : '🃏';

  container.innerHTML = `
    <div class="page-header enter" style="animation-delay:0ms">
      <div class="page-icon-wrap">🏠</div>
      <div class="page-title-text">
        <h1>Dashboard</h1>
        <p class="page-subtitle">${greeting()} Let's keep the momentum going.</p>
      </div>
    </div>

    <!-- Hero row: Streak | Goal Ring | Quote -->
    <div class="dashboard-hero enter">

      <!-- Streak -->
      <div class="streak-display" style="flex-direction:column;text-align:center;min-width:120px;justify-content:center">
        <div class="streak-flame">🔥</div>
        <div class="streak-num" id="streak-num">0</div>
        <div class="streak-label">Day Streak</div>
      </div>

      <!-- Daily Goal Ring -->
      <div class="goal-ring-card${done ? ' goal-done' : ''}" id="goal-ring-card">
        <button class="goal-ring-edit" id="goal-edit-btn" title="Set goal">⚙ Edit</button>

        <div class="goal-ring-wrap${done ? ' goal-done' : ''}" id="goal-ring-wrap">
          <!-- SVG with inline gradient + glow filter defs -->
          <svg class="goal-ring-svg" width="${R*2 + STROKE*2}" height="${R*2 + STROKE*2}"
               viewBox="0 0 ${R*2 + STROKE*2} ${R*2 + STROKE*2}">
            <defs>
              <linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#00e5cc"/>
                <stop offset="50%"  stop-color="#0ea5e9"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
              <filter id="goalGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <!-- Track -->
            <circle class="goal-ring-track"
              cx="${R + STROKE}" cy="${R + STROKE}" r="${R}"
              stroke-width="${STROKE}"/>
            <!-- Fill (starts from offset, animates to 0 = full) -->
            <circle class="goal-ring-fill" id="goal-ring-fill"
              cx="${R + STROKE}" cy="${R + STROKE}" r="${R}"
              stroke-width="${STROKE}"
              stroke-dasharray="${CIRC}"
              stroke-dashoffset="${CIRC}"/>
          </svg>

          <!-- Center label -->
          <div class="goal-ring-label">
            ${done
              ? `<div class="goal-ring-emoji">✅</div>
                 <div class="goal-ring-done-txt">Done!</div>`
              : `<div class="goal-ring-pct" id="goal-ring-pct">0%</div>`
            }
          </div>
        </div>

        <!-- Info below ring -->
        <div class="goal-ring-info">
          <div class="goal-ring-title">Daily Goal ${goalEmoji}</div>
          <div class="goal-ring-sub">${goal.target} ${goalTypeLabel}</div>
          <div class="goal-ring-progress-txt">
            <span>${goal.progress}</span> / ${goal.target} ${goalTypeLabel}
          </div>
        </div>
      </div>

      <!-- Quote -->
      <div class="card dashboard-quote" style="padding:20px 24px;display:flex;align-items:center">
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
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[1,2,3].map(() => `
          <div class="card card-sm skel-row" style="display:flex;justify-content:space-between;align-items:center">
            <div class="skel" style="width:140px;height:14px;border-radius:6px"></div>
            <div class="skel" style="width:50px;height:20px;border-radius:99px"></div>
          </div>`).join('')}
      </div>
    </div>
  `;

  // ── Animate ring fill ────────────────────────────────────────────
  const fillEl = document.getElementById('goal-ring-fill');
  const pctEl  = document.getElementById('goal-ring-pct');

  if (fillEl) {
    // Trigger animation next frame so CSS transition fires
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fillEl.style.strokeDashoffset = offset;
      });
    });
  }

  // Animate percentage number inside ring
  if (pctEl && !done) {
    let curr = 0;
    const target = pct;
    const dur = 1100;
    const start = performance.now();
    function animPct(now) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      curr = Math.round(target * ease);
      pctEl.textContent = curr + '%';
      if (t < 1) requestAnimationFrame(animPct);
    }
    requestAnimationFrame(animPct);
  }

  // ── Stagger & streak count ───────────────────────────────────────
  staggerElements('#metric-grid .metric-card', 70);
  staggerElements('#quick-actions .quick-card', 60);
  setTimeout(() => animateCount(document.getElementById('streak-num'), streak.count, 600), 200);

  document.querySelectorAll('.quick-card[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  // ── Goal edit popover ────────────────────────────────────────────
  document.getElementById('goal-edit-btn').addEventListener('click', () => openGoalEditor());

  // ── Load stats & courses in parallel ────────────────────────────
  try {
    const [s, courses] = await Promise.all([
      API.get('/api/stats'),
      API.get('/api/courses'),
    ]);

    fillMetric('courses',   s.courses || 0);
    fillMetric('videos',    s.videos  || 0);
    fillMetric('questions', s.total_questions || 0);
    fillMetric('due',       s.due_questions   || 0);
    fillMetric('accuracy',  s.accuracy || 0, '%');

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

// ── Goal editor popover ────────────────────────────────────────────
function openGoalEditor() {
  const card = document.getElementById('goal-ring-card');
  if (!card || card.querySelector('.goal-settings-popover')) return;

  const goal = DailyGoal.get();

  const pop = document.createElement('div');
  pop.className = 'goal-settings-popover';
  pop.innerHTML = `
    <h4>🎯 Set Daily Goal</h4>
    <div class="goal-type-row">
      <button class="goal-type-btn${goal.type === 'cards' ? ' active' : ''}" data-type="cards">🃏 Cards</button>
      <button class="goal-type-btn${goal.type === 'minutes' ? ' active' : ''}" data-type="minutes">⏱ Minutes</button>
    </div>
    <div class="goal-amount-row">
      <label>Target:</label>
      <input class="goal-amount-input" id="goal-amount-inp" type="number"
             min="1" max="999" value="${goal.target}" />
      <span style="font-size:.72rem;color:var(--text-3)" id="goal-unit-lbl">${goal.type === 'minutes' ? 'min' : 'cards'}</span>
    </div>
    <button class="goal-save-btn" id="goal-save-btn">✓ Save Goal</button>
    <button class="goal-cancel-btn" id="goal-cancel-btn">Cancel</button>
  `;
  card.appendChild(pop);

  // Type toggle
  let selectedType = goal.type;
  pop.querySelectorAll('.goal-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pop.querySelectorAll('.goal-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
      const lbl = document.getElementById('goal-unit-lbl');
      if (lbl) lbl.textContent = selectedType === 'minutes' ? 'min' : 'cards';
    });
  });

  document.getElementById('goal-save-btn').addEventListener('click', () => {
    const amt = document.getElementById('goal-amount-inp').value;
    DailyGoal.save(selectedType, amt);
    pop.remove();
    // Re-render dashboard to reflect new goal
    const container = document.getElementById('page-content');
    if (container) renderDashboard(container);
  });

  document.getElementById('goal-cancel-btn').addEventListener('click', () => pop.remove());
}

// ── Goal complete celebration (called externally if needed) ────────
export function celebrateGoalComplete() {
  const card = document.getElementById('goal-ring-card');
  if (!card) return;
  card.classList.add('just-completed');
  card.addEventListener('animationend', () => card.classList.remove('just-completed'), { once: true });
  launchConfetti();
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

