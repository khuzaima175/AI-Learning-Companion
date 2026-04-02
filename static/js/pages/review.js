import { API, showToast } from '../app.js';

let _questions  = [];
let _idx        = 0;
let _sessionId  = null;
let _answered   = false;
let _correct    = 0;

export async function renderReview(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap">🔁</div>
      <div class="page-title-text">
        <h1>Daily Review</h1>
        <p class="page-subtitle">Spaced Repetition — rate your recall to schedule next review</p>
      </div>
    </div>
    <div id="review-body">
      <div class="loading-state"><div class="spinner"></div><span>Checking due cards…</span></div>
    </div>
  `;
  await loadDue();
}

async function loadDue() {
  try {
    const data = await API.get('/api/review/due?limit=30');
    _questions = data.questions; _idx = 0; _correct = 0;
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
        <span style="font-size:.85rem;color:var(--text-2)"><strong style="color:var(--teal)">${_questions.length}</strong> card${_questions.length!==1?'s':''} due today</span>
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

function renderRevQ() {
  const area  = document.getElementById('rev-q-area');
  const q     = _questions[_idx];
  const total = _questions.length;
  const pct   = Math.round((_idx / total) * 100);
  document.getElementById('rev-bar').style.width = pct + '%';

  area.innerHTML = `
    <div class="question-card">
      <div class="question-num">Card ${_idx + 1} of ${total}</div>
      <div class="question-text">${q.question}</div>
      <div class="options-grid">
        ${q.options.map((opt, i) => `
          <button class="option-btn" data-val="${opt.replace(/"/g,'&quot;')}">
            <span class="option-letter">${String.fromCharCode(65+i)}</span>
            <span style="flex:1">${opt}</span>
          </button>`).join('')}
      </div>
      <div id="rev-feedback" style="display:none;margin-top:20px"></div>
    </div>
  `;

  _answered = false;
  area.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => onAnswer(btn, q));
  });
}

async function onAnswer(btn, q) {
  if (_answered) return;
  _answered = true;
  const correct = btn.dataset.val === q.answer;
  if (correct) _correct++;

  document.querySelectorAll('#rev-q-area .option-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add('correct');
    else if (b === btn && !correct) b.classList.add('wrong');
  });

  document.getElementById('score-badge').textContent = `${_correct} / ${_questions.length}`;

  const fb = document.getElementById('rev-feedback');
  fb.style.display = '';
  fb.innerHTML = `
    <div style="font-weight:600;font-size:.9rem;margin-bottom:14px;color:${correct?'var(--emerald)':'var(--coral)'}">
      ${correct ? '✅ Correct! How easy was that?' : `❌ Correct answer: <em>${q.answer}</em>`}
    </div>
    <div style="font-size:.78rem;color:var(--text-3);margin-bottom:10px">Rate your confidence to schedule next review:</div>
    <div class="srs-row">
      <button class="srs-btn srs-hard" data-perf="hard">😓 Hard<br><span style="font-size:.68rem;opacity:.7">1 day</span></button>
      <button class="srs-btn srs-good" data-perf="good">👍 Good<br><span style="font-size:.68rem;opacity:.7">3–7 days</span></button>
      <button class="srs-btn srs-easy" data-perf="easy">🚀 Easy<br><span style="font-size:.68rem;opacity:.7">14+ days</span></button>
    </div>
  `;

  fb.querySelectorAll('.srs-btn').forEach(b => {
    b.addEventListener('click', () => {
      fb.querySelectorAll('.srs-btn').forEach(x => x.disabled = true);
      
      const currentQ = q; // capture current question before incrementing
      const perf = b.dataset.perf;

      _idx++;
      if (_idx < _questions.length) renderRevQ();
      else renderDone();

      // Defer network request & cache busting to prevent UI thread jank
      setTimeout(() => {
        API.post('/api/review/answer', {
          session_id: _sessionId, question_id: currentQ.id,
          is_correct: correct, performance: perf,
        }).catch(e => console.error("Failed to save answer", e));
      }, 50);
    });
  });
}

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
