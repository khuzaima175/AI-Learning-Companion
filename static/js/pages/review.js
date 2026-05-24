import { API, showToast } from '../app.js';

let _questions    = [];
let _idx          = 0;
let _sessionId    = null;
let _answered     = false;
let _correct      = 0;
let _questionStart = 0;   // performance.now() timestamp when question rendered
let _hintUsed     = false;

// ─────────────────────────────────────────────────────────────────────────────
// Auto-rate based on time & correctness
//   wrong OR hint used → "hard"
//   right, < 15 s      → "easy"
//   right, 15–20 s     → "good"
//   right, > 20 s      → "hard"
// ─────────────────────────────────────────────────────────────────────────────
function autoRate(elapsedMs, isCorrect, hintUsed) {
  if (hintUsed || !isCorrect) return 'hard';
  const s = elapsedMs / 1000;
  if (s < 15)  return 'easy';
  if (s <= 20) return 'good';
  return 'hard';
}

const RATING_META = {
  easy: { emoji: '🚀', label: 'Easy',  note: 'Excellent recall! See you in 14+ days.',   color: 'var(--emerald)', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)'  },
  good: { emoji: '👍', label: 'Good',  note: 'Solid! Scheduled for 3–7 days.',            color: 'var(--teal)',    bg: 'rgba(0,229,204,0.10)',   border: 'rgba(0,229,204,0.28)'   },
  hard: { emoji: '😓', label: 'Hard',  note: 'No worries — reviewing again in 1 day.',   color: 'var(--coral)',   bg: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.30)' },
};

// ─────────────────────────────────────────────────────────────────────────────
export async function renderReview(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap">🔁</div>
      <div class="page-title-text">
        <h1>Daily Review</h1>
        <p class="page-subtitle">Answer fast → rated Easy. Take your time → rated Hard. No clicking required.</p>
      </div>
    </div>
    <div id="review-body">
      <div class="loading-state"><div class="spinner"></div><span>Checking due cards…</span></div>
    </div>
  `;
  await loadDue();
}

// ─────────────────────────────────────────────────────────────────────────────
async function loadDue() {
  try {
    const data = await API.get('/api/review/due?limit=25');
    _questions = data.questions; _idx = 0; _correct = 0;
    const totalDue = data.due_count ?? _questions.length;
    const body = document.getElementById('review-body');

    if (!_questions.length) {
      body.innerHTML = `
        <div class="card enter" style="max-width:480px;text-align:center;padding:52px 36px">
          <div style="font-size:3.5rem;margin-bottom:16px">🎉</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.5rem;font-weight:700;margin-bottom:10px">All caught up!</div>
          <div style="color:var(--text-2);font-size:.9rem;max-width:300px;margin:0 auto">No cards due for review today. Come back tomorrow to keep your streak going!</div>
          <div class="badge badge-green" style="margin-top:18px;font-size:.9rem;padding:6px 16px">✅ 0 due today</div>
        </div>`;
      return;
    }

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;max-width:640px;margin-bottom:10px">
        <span style="font-size:.85rem;color:var(--text-2)"><strong style="color:var(--teal)">${totalDue}</strong> card${totalDue!==1?'s':''} due today</span>
        <span id="score-badge" class="badge badge-amber">0 / ${_questions.length}</span>
      </div>
      <div class="progress-track" style="max-width:640px;margin-bottom:26px">
        <div class="progress-fill" id="rev-bar" style="width:0%"></div>
      </div>
      <div id="rev-q-area" style="max-width:640px"></div>
    `;

    const res = await API.post('/api/quiz/start-session', {});
    _sessionId = res.session_id;
    renderRevQ();
  } catch (e) {
    document.getElementById('review-body').innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${e.message}</div></div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function renderRevQ() {
  const area  = document.getElementById('rev-q-area');
  const q     = _questions[_idx];
  const total = _questions.length;
  const pct   = Math.round((_idx / total) * 100);
  document.getElementById('rev-bar').style.width = pct + '%';

  _hintUsed = false;
  _answered = false;

  area.innerHTML = `
    <div class="question-card enter">
      <div class="question-num">Card ${_idx + 1} of ${total}</div>

      <!-- Timer bar (shrinks over 20 s visually, purely decorative) -->
      <div id="timer-track" style="height:4px;border-radius:4px;background:var(--border);margin-bottom:18px;overflow:hidden">
        <div id="timer-fill" style="height:100%;width:100%;border-radius:4px;background:var(--grad-teal);transition:width 25s linear"></div>
      </div>
      <div id="timer-label" style="font-size:.72rem;color:var(--text-3);text-align:right;margin-top:-14px;margin-bottom:14px">
        ⏱ Answer quickly for a better rating
      </div>

      <div class="question-text">${q.question}</div>

      <div class="options-grid" id="rev-options">
        ${q.options.map((opt, i) => `
          <button class="option-btn" data-val="${opt.replace(/"/g,'&quot;')}">
            <span class="option-letter">${String.fromCharCode(65+i)}</span>
            <span style="flex:1">${opt}</span>
          </button>`).join('')}
      </div>

      <div id="rev-feedback" style="display:none;margin-top:20px"></div>

      <!-- Show Answer button -->
      <div id="hint-area" style="margin-top:16px;text-align:center">
        <button id="hint-btn" class="btn btn-ghost btn-sm" style="opacity:.55;font-size:.8rem">
          💡 Show Answer <span style="opacity:.6;font-size:.72rem">(counts as Hard)</span>
        </button>
      </div>
    </div>
  `;

  // Start timer
  _questionStart = performance.now();

  // Animate timer bar: start shrinking immediately
  requestAnimationFrame(() => {
    const fill = document.getElementById('timer-fill');
    if (fill) fill.style.width = '0%';
  });

  // Wire up answer buttons
  area.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => onAnswer(btn, q));
  });

  // Wire up Show Answer / Hint button
  document.getElementById('hint-btn').addEventListener('click', () => onShowAnswer(q));
}

// ─────────────────────────────────────────────────────────────────────────────
async function onAnswer(btn, q) {
  if (_answered) return;
  _answered = true;

  const elapsed   = performance.now() - _questionStart;
  const isCorrect = btn.dataset.val === q.answer;
  const perf      = autoRate(elapsed, isCorrect, _hintUsed);

  if (isCorrect) _correct++;

  // Visually lock all buttons
  document.querySelectorAll('#rev-options .option-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add('correct');
    else if (b === btn && !isCorrect) b.classList.add('wrong');
  });

  document.getElementById('score-badge').textContent = `${_correct} / ${_questions.length}`;

  // Hide hint button
  const hintArea = document.getElementById('hint-area');
  if (hintArea) hintArea.style.display = 'none';

  // Stop timer bar
  const fill = document.getElementById('timer-fill');
  if (fill) {
    const pct = Math.max(0, 100 - (elapsed / 200));   // visual snapshot
    fill.style.transition = 'none';
    fill.style.width = pct + '%';
  }

  // Show feedback with auto-rating info
  showFeedback(isCorrect, elapsed, perf, q.answer, isCorrect ? null : btn.dataset.val);

  // Save to backend (fire-and-forget)
  setTimeout(() => {
    API.post('/api/review/answer', {
      session_id:  _sessionId,
      question_id: q.id,
      is_correct:  isCorrect,
      performance: perf,
    }).catch(e => console.error('Failed to save answer', e));
  }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
async function onShowAnswer(q) {
  if (_answered) return;
  _answered = true;
  _hintUsed = true;

  // Lock option buttons
  document.querySelectorAll('#rev-options .option-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add('correct');
  });

  // Hide hint button
  const hintArea = document.getElementById('hint-area');
  if (hintArea) hintArea.style.display = 'none';

  // Stop timer bar
  const fill = document.getElementById('timer-fill');
  if (fill) { fill.style.transition = 'none'; fill.style.width = '0%'; }

  const elapsed = performance.now() - _questionStart;
  showFeedback(false, elapsed, 'hard', q.answer, null, /*isHint=*/true);

  setTimeout(() => {
    API.post('/api/review/answer', {
      session_id:  _sessionId,
      question_id: q.id,
      is_correct:  false,
      performance: 'hard',
    }).catch(e => console.error('Failed to save answer', e));
  }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
function showFeedback(isCorrect, elapsedMs, perf, correctAnswer, chosenWrong, isHint = false) {
  const fb = document.getElementById('rev-feedback');
  const m  = RATING_META[perf];
  const secs = (elapsedMs / 1000).toFixed(1);

  let resultLine;
  if (isHint) {
    resultLine = `<span style="color:var(--text-2)">💡 You revealed the answer.</span>`;
  } else if (isCorrect) {
    resultLine = `<span style="color:var(--emerald)">✅ Correct!</span>`;
  } else {
    resultLine = `<span style="color:var(--coral)">❌ Correct answer: <em>${correctAnswer}</em></span>`;
  }

  fb.style.display = '';
  fb.innerHTML = `
    <div style="border-radius:14px;background:var(--glass);border:1px solid var(--glass-border);padding:18px 20px">
      <div style="font-weight:600;font-size:.95rem;margin-bottom:12px">${resultLine}</div>

      <!-- Auto-rating chip -->
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;
                  background:${m.bg};
                  border:1px solid ${m.border}">
        <span style="font-size:1.5rem">${m.emoji}</span>
        <div>
          <div style="font-weight:700;color:${m.color};font-size:.9rem">
            ${m.label}
            <span style="font-weight:400;font-size:.78rem;color:var(--text-3);margin-left:6px">
              ⏱ ${secs}s${isHint ? ' · hint used' : ''}
            </span>
          </div>
          <div style="font-size:.78rem;color:var(--text-3);margin-top:2px">${m.note}</div>
        </div>
      </div>

      <button id="next-btn" class="btn btn-teal btn-sm" style="margin-top:14px;width:100%">
        Next Card ➡️
      </button>
    </div>
  `;

  document.getElementById('next-btn').addEventListener('click', () => {
    _idx++;
    if (_idx < _questions.length) renderRevQ();
    else renderDone();
  });

  // Auto-focus next button for keyboard flow
  document.getElementById('next-btn').focus();
}

// ─────────────────────────────────────────────────────────────────────────────
function renderDone() {
  document.getElementById('rev-bar').style.width = '100%';
  const pct = Math.round((_correct / _questions.length) * 100);
  document.getElementById('rev-q-area').innerHTML = `
    <div class="card enter" style="text-align:center;padding:40px">
      <div style="font-size:3.2rem;margin-bottom:12px">${pct >= 80 ? '🏆' : '💪'}</div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:2.5rem;font-weight:800;
                  background:var(--grad-teal);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
        ${pct}%
      </div>
      <div style="color:var(--text-2);margin:8px 0 6px">${_correct} / ${_questions.length} correct</div>
      <div class="badge badge-teal" style="margin-bottom:22px">Next reviews scheduled via SRS</div>
      <div class="progress-track" style="margin-bottom:24px">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <button class="btn btn-teal btn-sm" id="rev-again-btn">🔄 Review Again</button>
    </div>`;
  document.getElementById('rev-again-btn').addEventListener('click', loadDue);
}
