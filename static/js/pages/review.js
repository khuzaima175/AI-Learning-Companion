import { API, showToast, DailyGoal, icon, launchConfetti, navigate, skel } from '../app.js';

let _questions = [];
let _idx = 0;
let _sessionId = null;
let _answered = false;
let _correct = 0;
let _questionStart = 0;
let _hintUsed = false;
let _keyListener = null;

function autoRate(elapsedMs, isCorrect, hintUsed) {
  if (hintUsed || !isCorrect) return 'hard';
  const s = elapsedMs / 1000;
  if (s < 15) return 'easy';
  if (s <= 20) return 'good';
  return 'hard';
}

const RATING_META = {
  easy: { label: 'Easy (Fast Recall)', note: 'Interval: +14–180 days', pill: 'pill-green' },
  good: { label: 'Good (Solid)', note: 'Interval: +3–7 days', pill: 'pill-teal' },
  hard: { label: 'Hard (Needs Review)', note: 'Reset: 1 day', pill: 'pill-coral' },
};

export async function renderReview(container) {
  if (_keyListener) {
    document.removeEventListener('keydown', _keyListener);
    _keyListener = null;
  }

  container.innerHTML = `
    <!-- Header -->
    <div style="margin-bottom:24px">
      <div class="page-title">Daily <em>Review</em></div>
      <p class="page-subtitle">Spaced repetition queue. Faster active recall earns longer intervals via the SM-2 algorithm.</p>
    </div>
    <div id="review-body">
      <div class="review-grid-v2">
        <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            ${skel(180, 16)}
            ${skel(80, 24, 99)}
          </div>
          ${skel('100%', 8, 99)}
          <div class="card" style="display:flex;flex-direction:column;gap:16px">
            ${skel(120, 14)}
            ${skel('90%', 24)}
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
              ${skel('100%', 48, 14)}
              ${skel('100%', 48, 14)}
              ${skel('100%', 48, 14)}
              ${skel('100%', 48, 14)}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
          ${skel('100%', 120, 12)}
          ${skel('100%', 130, 12)}
        </div>
      </div>
    </div>
  `;
  await loadDue();
}

async function loadDue() {
  const body = document.getElementById('review-body');
  if (!body) return;

  try {
    const data = await API.get('/api/review/due?limit=25');
    _questions = data.questions || [];
    _idx = 0;
    _correct = 0;
    const totalDue = data.due_count ?? _questions.length;

    if (!_questions.length) {
      body.innerHTML = `
        <div class="card" style="max-width:540px;margin:0 auto;text-align:center;padding:48px 24px">
          <div class="icon-chip teal" style="width:56px;height:56px;margin:0 auto 16px">
            ${icon('check', '', 'width:28px;height:28px')}
          </div>
          <h3 style="font-size:1.8rem">Queue Cleared!</h3>
          <p style="font-size:0.92rem;color:var(--muted);margin-top:8px;max-width:360px;margin-left:auto;margin-right:auto;line-height:1.6">
            Zero cards currently due for review today. Great job keeping your retention sharp!
          </p>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="window.navigate('dashboard')">
              ${icon('arrow-left', '', 'width:14px;height:14px')}
              <span>Dashboard</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.navigate('quiz')">
              <span>Practice Exam</span>
              ${icon('arrow-right', '', 'width:14px;height:14px')}
            </button>
          </div>
        </div>`;
      return;
    }

    body.innerHTML = `
      <div class="review-grid-v2">
        
        <!-- Main Column (Card & Options) -->
        <div id="rev-main-col" style="min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <span class="mono-meta"><strong style="color:var(--amber)">${totalDue}</strong> CARDS DUE TODAY</span>
            <span class="pill pill-teal" id="rev-score-pill">0 / ${_questions.length}</span>
          </div>

          <div class="progress-track" style="margin-bottom:18px">
            <div class="progress-fill" id="rev-progress-fill" style="width:${(1 / _questions.length) * 100}%"></div>
          </div>

          <div id="rev-card-area" style="min-width:0"></div>
        </div>

        <!-- Right Rail Column (Live Stats, Rating Legend, Up Next) -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Rail 1: Session Live Stats -->
          <div class="card card-sm">
            <div class="card-title" style="margin-bottom:12px">Session Stats</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div class="serif-num" style="font-size:1.8rem;color:var(--text)" id="rail-stat-answered">0</div>
                <div class="mono-meta" style="font-size:0.7rem">Answered</div>
              </div>
              <div>
                <div class="serif-num" style="font-size:1.8rem;color:var(--teal)" id="rail-stat-acc">0%</div>
                <div class="mono-meta" style="font-size:0.7rem">Accuracy</div>
              </div>
            </div>
          </div>

          <!-- Rail 2: Rating Legend -->
          <div class="card card-sm">
            <div class="card-title" style="margin-bottom:10px">SM-2 Spaced Intervals</div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:0.8rem">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:var(--emerald);font-weight:600">Easy (&lt;15s)</span>
                <span class="mono-meta" style="font-size:0.7rem">+14–180d</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:var(--teal);font-weight:600">Good (15–20s)</span>
                <span class="mono-meta" style="font-size:0.7rem">+3–7d</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:var(--coral);font-weight:600">Hard (&gt;20s / Hint)</span>
                <span class="mono-meta" style="font-size:0.7rem">1d reset</span>
              </div>
            </div>
          </div>

          <!-- Rail 3: Up Next Queue -->
          <div class="card card-sm">
            <div class="card-title" style="margin-bottom:10px">Up Next in Queue</div>
            <div id="rail-up-next" style="display:flex;flex-direction:column;gap:8px"></div>
          </div>

        </div>
      </div>
    `;

    const res = await API.post('/api/quiz/start-session', {});
    _sessionId = res.session_id;

    setupKeyboardBinds();
    renderRevQ();
  } catch (e) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:48px;color:var(--coral)">
        Error: ${e.message}
      </div>`;
  }
}

function renderRevQ() {
  const area = document.getElementById('rev-card-area');
  if (!area) return;

  const q = _questions[_idx];
  const total = _questions.length;
  const pct = ((_idx + 1) / total) * 100;

  const fill = document.getElementById('rev-progress-fill');
  if (fill) fill.style.width = `${pct}%`;

  _hintUsed = false;
  _answered = false;

  const LETTERS = ['A', 'B', 'C', 'D'];

  area.innerHTML = `
    <div class="card" style="min-width:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <span class="mono-meta">CARD ${_idx + 1} OF ${total}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="kbd">1</span>
          <span class="kbd">2</span>
          <span class="kbd">3</span>
          <span class="kbd">4</span>
        </div>
      </div>

      <div style="font-size:clamp(1rem, 3.5vw, 1.15rem);font-weight:600;line-height:1.55;color:var(--text);margin-bottom:20px;word-break:break-word">
        ${q.question}
      </div>

      <div style="display:grid;gap:10px;min-width:0" id="rev-options-list">
        ${q.options.map((opt, i) => `
          <button class="opt" data-val="${opt.replace(/"/g, '&quot;')}" data-key="${i + 1}">
            <span class="key">${LETTERS[i]}</span>
            <span style="flex:1;min-width:0;word-break:break-word;overflow-wrap:break-word">${opt}</span>
          </button>`).join('')}
      </div>

      <div id="rev-feedback" style="display:none;margin-top:20px;min-width:0"></div>

      <div id="hint-wrap" style="margin-top:16px;text-align:center">
        <button id="hint-btn" class="btn btn-ghost btn-sm" style="color:var(--muted);font-size:0.8rem;max-width:100%;white-space:normal">
          ${icon('help-circle', '', 'width:13px;height:13px;color:var(--amber)')}
          <span>Reveal Answer (Counts as Hard)</span>
        </button>
      </div>
    </div>
  `;

  _questionStart = performance.now();

  area.querySelectorAll('.opt').forEach(btn => {
    btn.addEventListener('click', () => onAnswer(btn, q));
  });

  document.getElementById('hint-btn')?.addEventListener('click', () => onShowAnswer(q));

  updateRailUpNext();
}

function updateRailUpNext() {
  const railNext = document.getElementById('rail-up-next');
  if (!railNext) return;

  const upcoming = _questions.slice(_idx + 1, _idx + 4);
  if (!upcoming.length) {
    railNext.innerHTML = `<span class="mono-meta" style="font-size:0.75rem;color:var(--faint)">Final card in queue</span>`;
    return;
  }

  railNext.innerHTML = upcoming.map((q, i) => `
    <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      <span class="mono-meta" style="color:var(--teal);font-size:0.7rem">+${i + 1}</span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.question}</span>
    </div>`).join('');
}

function updateLiveStats() {
  const answeredEl = document.getElementById('rail-stat-answered');
  const accEl = document.getElementById('rail-stat-acc');
  const answered = _idx + (_answered ? 1 : 0);
  if (answeredEl) answeredEl.textContent = String(answered);
  if (accEl && answered > 0) {
    accEl.textContent = `${Math.round((_correct / answered) * 100)}%`;
  }
}

async function onAnswer(btn, q) {
  if (_answered) return;
  _answered = true;

  const elapsed = performance.now() - _questionStart;
  const isCorrect = btn.dataset.val === q.answer;
  const perf = autoRate(elapsed, isCorrect, _hintUsed);

  if (isCorrect) _correct++;

  document.querySelectorAll('#rev-options-list .opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) {
      b.classList.add('correct');
    } else if (b === btn && !isCorrect) {
      b.classList.add('wrong');
    } else {
      b.classList.add('dim');
    }
  });

  const badge = document.getElementById('rev-score-pill');
  if (badge) badge.textContent = `${_correct} / ${_questions.length}`;

  DailyGoal.addProgress(1);
  updateLiveStats();
  showFeedback(isCorrect, elapsed, perf, q.answer);

  try {
    await API.post('/api/review/answer', {
      session_id: _sessionId,
      question_id: q.id,
      is_correct: isCorrect,
      performance: perf,
    });
  } catch { /**/ }
}

async function onShowAnswer(q) {
  if (_answered) return;
  _answered = true;
  _hintUsed = true;

  document.querySelectorAll('#rev-options-list .opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add('correct');
    else b.classList.add('dim');
  });

  const elapsed = performance.now() - _questionStart;
  DailyGoal.addProgress(1);
  updateLiveStats();
  showFeedback(false, elapsed, 'hard', q.answer, true);

  try {
    await API.post('/api/review/answer', {
      session_id: _sessionId,
      question_id: q.id,
      is_correct: false,
      performance: 'hard',
    });
  } catch { /**/ }
}

function showFeedback(isCorrect, elapsedMs, perf, correctAnswer, isHint = false) {
  const fb = document.getElementById('rev-feedback');
  const hintWrap = document.getElementById('hint-wrap');
  if (hintWrap) hintWrap.style.display = 'none';
  if (!fb) return;

  const m = RATING_META[perf];
  const secs = (elapsedMs / 1000).toFixed(1);

  fb.style.display = 'block';
  fb.innerHTML = `
    <div style="background:var(--sf2);border:1px solid var(--line);border-radius:var(--r-ctl);padding:16px 20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div style="font-weight:600;font-size:0.95rem">
          ${isCorrect ? '<span style="color:var(--emerald)">Correct Answer</span>' : `<span style="color:var(--coral)">Correct: ${correctAnswer}</span>`}
        </div>
        <span class="pill ${m.pill}">${m.label} (${secs}s)</span>
      </div>
      <div style="font-size:0.78rem;color:var(--muted)">${m.note}</div>
      <button id="next-rev-btn" class="btn btn-primary btn-full btn-sm" style="margin-top:14px">
        <span>Next Review Card</span>
        ${icon('arrow-right', '', 'width:14px;height:14px')}
      </button>
    </div>`;

  document.getElementById('next-rev-btn')?.addEventListener('click', () => {
    _idx++;
    if (_idx < _questions.length) renderRevQ();
    else renderDone();
  });
}

function renderDone() {
  if (_keyListener) {
    document.removeEventListener('keydown', _keyListener);
    _keyListener = null;
  }

  const col = document.getElementById('rev-main-col');
  const pct = Math.round((_correct / _questions.length) * 100);
  launchConfetti();

  if (!col) return;

  col.innerHTML = `
    <div class="card" style="text-align:center;padding:52px 28px">
      <div class="icon-chip teal" style="width:56px;height:56px;margin:0 auto 16px">
        ${icon('target', '', 'width:28px;height:28px')}
      </div>
      <div class="page-title" style="font-size:2.2rem">Queue <em>Cleared!</em></div>
      <div class="serif-num" style="font-size:4.5rem;color:var(--teal);margin:10px 0">
        ${pct}%
      </div>
      <div style="font-size:0.95rem;color:var(--text);margin-bottom:8px">
        ${_correct} of ${_questions.length} cards remembered
      </div>
      <div class="pill pill-green" style="margin-bottom:28px">Intervals updated in database</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-ghost btn-sm" onclick="window.navigate('dashboard')">
          ${icon('arrow-left', '', 'width:14px;height:14px')}
          <span>Dashboard</span>
        </button>
        <button class="btn btn-primary btn-sm" id="rev-again-btn">
          ${icon('rotate-cw', '', 'width:14px;height:14px')}
          <span>Review Again</span>
        </button>
      </div>
    </div>`;

  document.getElementById('rev-again-btn')?.addEventListener('click', () => {
    renderReview(document.getElementById('page-content'));
  });
}

function setupKeyboardBinds() {
  _keyListener = e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      const opts = document.querySelectorAll('#rev-options-list .opt');
      if (opts[idx] && !opts[idx].disabled) {
        opts[idx].click();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      const nextBtn = document.getElementById('next-rev-btn');
      if (nextBtn) {
        e.preventDefault();
        nextBtn.click();
      }
    }
  };

  document.addEventListener('keydown', _keyListener);
}
