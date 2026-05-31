import { API, showToast, launchConfetti, staggerElements, DailyGoal } from '../app.js';

let _questions   = [];
let _idx         = 0;
let _sessionId   = null;
let _answered    = false;
let _score       = 0;
let _timerHandle = null;
let _results     = [];   // tracks {correct: bool} per question
const TIMER_S    = 30;

export async function renderQuiz(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap">🧠</div>
      <div class="page-title-text">
        <h1>Practice Quiz</h1>
        <p class="page-subtitle">Test your knowledge — ${TIMER_S}s per question</p>
      </div>
    </div>

    <div id="quiz-setup" class="enter" style="animation-delay:80ms">
      <div class="quiz-grid">
        <!-- Configuration Card -->
        <div class="card">
          <h3 style="font-family:'Space Grotesk',sans-serif;margin-bottom:20px;font-size:1.1rem">Configure Your Quiz</h3>

          <div class="form-group">
            <label class="form-label">Question Pool</label>
            <select id="q-scope" class="form-select">
              <option value="all">🌐 All videos</option>
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="form-group">
              <label class="form-label">Questions</label>
              <select id="q-count" class="form-select">
                <option value="5">5</option>
                <option value="10" selected>10</option>
                <option value="15">15</option>
                <option value="20">20</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Timer</label>
              <select id="q-timer" class="form-select">
                <option value="15">15 sec</option>
                <option value="30" selected>30 sec</option>
                <option value="60">60 sec</option>
                <option value="0">No timer</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Difficulty</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${['easy','medium','hard'].map(d => `
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.875rem;color:var(--text-2)">
                  <input type="checkbox" value="${d}" checked style="accent-color:var(--teal);width:15px;height:15px" />
                  ${d.charAt(0).toUpperCase() + d.slice(1)}
                </label>`).join('')}
            </div>
          </div>

          <button class="btn btn-teal btn-full btn-lg" id="start-btn" style="margin-top:8px">
            <span class="btn-text">🚀 Start Quiz</span>
          </button>

          <!-- ── Generate More Questions ── -->
          <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:16px">
            <button id="gen-toggle-btn" style="display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:0;text-align:left">
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:1.05rem">⚡</span>
                  <span style="font-weight:700;font-size:.9rem;color:var(--text-1)">Generate More Questions</span>
                  <span class="badge badge-teal" style="font-size:.68rem;padding:2px 7px">AI</span>
                </div>
                <div style="margin-top:3px;font-size:.76rem;color:var(--text-3);padding-left:30px">Use Gemini to create new questions and save them to the DB</div>
              </div>
              <span id="gen-chevron" style="color:var(--teal);font-size:.8rem;transition:transform .25s;display:inline-block;flex-shrink:0;margin-left:10px">▼</span>
            </button>

            <div id="gen-panel" style="display:none;margin-top:16px">
              <div style="background:var(--glass);border:1px solid var(--border);border-radius:var(--r-md);padding:18px;display:flex;flex-direction:column;gap:14px">

                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">📹 Generate questions for</label>
                  <select id="gen-video" class="form-select">
                    <option value="">Loading videos…</option>
                  </select>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label">How many</label>
                    <select id="gen-count" class="form-select">
                      <option value="5">5 questions</option>
                      <option value="10" selected>10 questions</option>
                      <option value="15">15 questions</option>
                      <option value="20">20 questions</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label">Difficulty</label>
                    <div style="display:flex;flex-direction:column;gap:6px;padding-top:6px">
                      ${['easy','medium','hard'].map((d,i) => `
                        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:.82rem;color:var(--text-2)">
                          <input type="checkbox" class="gen-diff" value="${d}" ${i<2?'checked':''} style="accent-color:var(--teal);width:14px;height:14px" />
                          <span>${d.charAt(0).toUpperCase()+d.slice(1)}</span>
                        </label>`).join('')}
                    </div>
                  </div>
                </div>

                <div id="gen-result" style="display:none;padding:10px 14px;border-radius:var(--r-sm);font-size:.82rem;font-weight:600"></div>

                <button id="gen-btn" class="btn btn-teal btn-full" style="margin-top:2px">
                  <span class="btn-text">⚡ Generate &amp; Save to Database</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar (Fills empty space beautifully on desktop) -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card card-sm" style="border-color:var(--border-t)">
            <div style="font-size:.8rem;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">🧠 Practice Guidelines</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;gap:10px;align-items:flex-start">
                <span style="font-size:1.15rem;flex-shrink:0">⏱️</span>
                <div>
                  <div style="font-size:.82rem;font-weight:700;color:var(--text)">Timed Recall</div>
                  <div style="font-size:.76rem;color:var(--text-2);margin-top:2px">Each question has a customizable countdown. Practice answering quickly under pressure.</div>
                </div>
              </div>
              <div style="display:flex;gap:10px;align-items:flex-start">
                <span style="font-size:1.15rem;flex-shrink:0">📊</span>
                <div>
                  <div style="font-size:.82rem;font-weight:700;color:var(--text)">Catalog Scope</div>
                  <div style="font-size:.76rem;color:var(--text-2);margin-top:2px">Select "All Videos" for a comprehensive exam, or isolate a specific course/video to review.</div>
                </div>
              </div>
              <div style="display:flex;gap:10px;align-items:flex-start">
                <span style="font-size:1.15rem;flex-shrink:0">🔄</span>
                <div>
                  <div style="font-size:.82rem;font-weight:700;color:var(--text)">Spaced Repetition Integration</div>
                  <div style="font-size:.76rem;color:var(--text-2);margin-top:2px">Wrong quiz answers are automatically integrated into your Daily Review queue via SRS.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card card-sm" style="border-color:var(--border-a)">
            <div style="font-size:.8rem;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Quick Tips</div>
            <ul class="bullet-list">
              <li>Use Easy/Medium questions for fast-paced active recall sessions.</li>
              <li>Toggle the AI Panel to auto-generate fresh lecture questions.</li>
              <li>Aim for at least 80% accuracy to unlock review achievements!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div id="quiz-play" style="display:none;max-width:640px"></div>
    <div id="quiz-results" style="display:none;max-width:500px"></div>
  `;

  await populateScopes();
  document.getElementById('start-btn').addEventListener('click', startQuiz);
  setupGeneratePanel();
}

async function populateScopes() {
  try {
    const courses = await API.get('/api/courses');
    const sel = document.getElementById('q-scope');
    for (const c of courses) {
      const g = document.createElement('optgroup'); g.label = c.name;
      const oc = document.createElement('option'); oc.value = `course:${c.id}`; oc.textContent = `📚 ${c.name} (all)`; g.appendChild(oc);
      for (const v of c.videos) {
        const ov = document.createElement('option'); ov.value = `video:${v.id}`; ov.textContent = `  📹 ${v.title}`; g.appendChild(ov);
      }
      sel.appendChild(g);
    }
    // Also populate the generate panel video dropdown
    populateGenVideoDropdown(courses);
  } catch { /**/ }
}

function populateGenVideoDropdown(courses) {
  const sel = document.getElementById('gen-video');
  if (!sel) return;
  sel.innerHTML = '';
  for (const c of courses) {
    const grp = document.createElement('optgroup');
    grp.label = `📚 ${c.name}`;
    for (const v of c.videos) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.title;
      grp.appendChild(opt);
    }
    sel.appendChild(grp);
  }
  if (!sel.options.length) {
    sel.innerHTML = '<option value="">No videos found</option>';
  }
}

function setupGeneratePanel() {
  const toggleBtn = document.getElementById('gen-toggle-btn');
  const panel     = document.getElementById('gen-panel');
  const chevron   = document.getElementById('gen-chevron');
  const genBtn    = document.getElementById('gen-btn');
  let open = false;

  toggleBtn.addEventListener('click', () => {
    open = !open;
    panel.style.display   = open ? '' : 'none';
    chevron.style.transform = open ? 'rotate(180deg)' : '';
  });

  genBtn.addEventListener('click', generateQuestions);
}

async function generateQuestions() {
  const videoId = document.getElementById('gen-video')?.value;
  const count   = parseInt(document.getElementById('gen-count')?.value || '10');
  const diffs   = [...document.querySelectorAll('.gen-diff:checked')].map(x => x.value);
  const resultEl = document.getElementById('gen-result');
  const btn      = document.getElementById('gen-btn');

  if (!videoId) { showToast('Please select a video first', 'error'); return; }
  if (!diffs.length) { showToast('Select at least one difficulty level', 'error'); return; }

  btn.classList.add('btn-loading'); btn.disabled = true;
  if (resultEl) { resultEl.style.display = 'none'; resultEl.textContent = ''; }

  try {
    const res = await API.post('/api/quiz/generate', {
      video_id: parseInt(videoId),
      num_questions: count,
      difficulties: diffs,
    });
    const diffLabel = diffs.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
    if (resultEl) {
      resultEl.style.display = '';
      resultEl.style.background = 'rgba(0,229,204,.12)';
      resultEl.style.color = 'var(--teal)';
      resultEl.style.border = '1px solid rgba(0,229,204,.25)';
      const skipped = (res.generated || res.count) - res.count;
      let msg = `✅ Generated ${res.generated ?? res.count} · Saved <strong>${res.count}</strong> new ${diffLabel} questions to database!`;
      if (skipped > 0) msg += ` <span style="color:var(--text-3);font-weight:400">(${skipped} skipped — already existed)</span>`;
      resultEl.innerHTML = msg;
    }
    showToast(`✅ ${res.count} new questions saved!`, 'success');
  } catch (e) {
    if (resultEl) {
      resultEl.style.display = '';
      resultEl.style.background = 'rgba(239,68,68,.12)';
      resultEl.style.color = 'var(--coral)';
      resultEl.style.border = '1px solid rgba(239,68,68,.25)';
      resultEl.textContent = `❌ ${e.message}`;
    }
    showToast(e.message, 'error');
  } finally {
    btn.classList.remove('btn-loading'); btn.disabled = false;
  }
}

async function startQuiz() {
  const scope   = document.getElementById('q-scope').value;
  const count   = parseInt(document.getElementById('q-count').value);
  const diffs   = [...document.querySelectorAll('#quiz-setup input[type=checkbox]:checked')].map(x => x.value);
  const timerV  = parseInt(document.getElementById('q-timer').value);

  if (!diffs.length) { showToast('Select at least one difficulty', 'error'); return; }

  let params = `limit=${count}`;
  if (scope.startsWith('course:')) params = `scope=course&scope_id=${scope.split(':')[1]}&${params}`;
  else if (scope.startsWith('video:')) params = `scope=video&scope_id=${scope.split(':')[1]}&${params}`;

  const btn = document.getElementById('start-btn');
  btn.classList.add('btn-loading'); btn.disabled = true;

  try {
    _questions = await API.get(`/api/quiz/questions?${params}`);
    if (!_questions.length) { showToast('No questions found — add some videos first!', 'error'); return; }
    const res = await API.post('/api/quiz/start-session', {});
    _sessionId = res.session_id; _idx = 0; _score = 0; _results = [];

    document.getElementById('quiz-setup').style.display   = 'none';
    document.getElementById('quiz-play').style.display    = '';
    document.getElementById('quiz-results').style.display = 'none';
    renderQuestion(timerV);
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.classList.remove('btn-loading'); btn.disabled = false; }
}

function renderQuestion(timerDur) {
  clearTimer();
  const q     = _questions[_idx];
  const total = _questions.length;
  const pct   = Math.round((_idx / total) * 100);
  const panel = document.getElementById('quiz-play');
  _answered   = false;

  panel.innerHTML = `
    <!-- Header bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:.82rem;color:var(--text-2)">Question <strong style="color:var(--teal)">${_idx + 1}</strong> / ${total}</span>
      <span style="font-size:.82rem;color:var(--text-2)">Score: <strong style="color:var(--amber)">${_score}</strong></span>
    </div>

    <!-- Overall progress -->
    <div class="progress-track" style="margin-bottom:${timerDur ? '6px' : '20px'}">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div>

    <!-- Timer bar -->
    ${timerDur ? `<div class="timer-bar" id="timer-bar" style="width:100%;margin-bottom:18px"></div>` : ''}

    <!-- Question card -->
    <div class="question-card">
      <div class="question-num">Question ${_idx + 1}</div>
      <div class="question-text">${q.question}</div>
      <div class="options-grid">
        ${q.options.map((opt, i) => `
          <button class="option-btn" data-val="${opt.replace(/"/g,'&quot;')}">
            <span class="option-letter">${String.fromCharCode(65+i)}</span>
            <span style="flex:1">${opt}</span>
          </button>`).join('')}
      </div>
      <div id="q-feedback" style="display:none;margin-top:18px"></div>
    </div>
  `;

  panel.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => selectAnswer(btn, q, timerDur));
  });

  if (timerDur) startTimer(timerDur, q);
}

function startTimer(dur, q) {
  const bar = document.getElementById('timer-bar');
  if (!bar) return;
  // Wait one frame so the bar renders at 100% before we start shrinking it
  requestAnimationFrame(() => {
    const start = performance.now();
    _timerHandle = setInterval(() => {
      const elapsed   = (performance.now() - start) / 1000;
      const remaining = Math.max(0, dur - elapsed);
      const pct       = (remaining / dur) * 100;
      bar.style.width = pct + '%';
      if (pct < 33) bar.classList.add('warn');
      if (pct < 15) bar.classList.add('crit');
      if (remaining <= 0) {
        clearTimer();
        if (!_answered) timeOut(q);
      }
    }, 80);
  });
}

function clearTimer() {
  if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }
}

function timeOut(q) {
  _answered = true;
  _results.push({ correct: false });
  document.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add('correct');
  });
  showFeedback(false, q.answer, true);
}

async function selectAnswer(btn, q, timerDur) {
  if (_answered) return;
  _answered = true;
  clearTimer();

  const chosen  = btn.dataset.val;
  const correct = chosen === q.answer;
  if (correct) _score++;
  _results.push({ correct });

  document.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add('correct');
    else if (b === btn && !correct) b.classList.add('wrong');
  });

  showFeedback(correct, q.answer, false);

  // Track daily goal progress (1 card reviewed)
  DailyGoal.addProgress(1);

  try {
    await API.post('/api/quiz/answer', {
      session_id: _sessionId, question_id: q.id,
      is_correct: correct, performance: correct ? 'good' : 'hard',
    });
  } catch { /**/ }
}

function showFeedback(correct, answer, timedOut) {
  const fb = document.getElementById('q-feedback');
  fb.style.display = '';

  let msg = '';
  if (timedOut)     msg = `<span style="color:var(--amber)">⏱️ Time's up! Answer: <em>${answer}</em></span>`;
  else if (correct) msg = `<span style="color:var(--emerald)">✅ Correct!</span>`;
  else              msg = `<span style="color:var(--coral)">❌ Correct: <em>${answer}</em></span>`;

  const timerDur = parseInt(document.getElementById('q-timer')?.value) || 0;
  fb.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div style="font-weight:600;font-size:.9rem">${msg}</div>
      <button class="btn btn-teal btn-sm" id="next-btn">
        ${_idx + 1 < _questions.length ? 'Next →' : '🎉 See Results'}
      </button>
    </div>`;

  document.getElementById('next-btn').addEventListener('click', () => {
    _idx++;
    if (_idx < _questions.length) renderQuestion(timerDur);
    else renderResults();
  });
}

function renderResults() {
  clearTimer();
  document.getElementById('quiz-play').style.display    = 'none';
  document.getElementById('quiz-results').style.display = '';

  const total = _questions.length;
  const pct   = Math.round((_score / total) * 100);

  if (pct >= 70) launchConfetti();

  document.getElementById('quiz-results').innerHTML = `
    <div class="card enter" style="text-align:center;padding:44px 36px">
      <div style="font-size:3.8rem;margin-bottom:14px">${pct >= 80 ? '🏆' : pct >= 60 ? '📈' : '💪'}</div>

      <div style="font-family:'Space Grotesk',sans-serif;font-size:3.2rem;font-weight:800;
                  background:var(--grad-${pct >= 70 ? 'teal' : 'amber'});-webkit-background-clip:text;
                  -webkit-text-fill-color:transparent;background-clip:text;line-height:1">
        ${pct}%
      </div>
      <div style="color:var(--text-2);margin:10px 0 6px;font-size:.9rem">
        ${_score} correct out of ${total} questions
      </div>
      <div class="badge badge-${pct >= 80 ? 'green' : pct >= 60 ? 'teal' : 'amber'}" style="margin-bottom:28px">
        ${pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good job' : 'Keep practicing'}
      </div>

      <div class="progress-track" style="margin-bottom:32px;height:10px">
        <div class="progress-fill${pct < 60 ? ' amber' : ''}" style="width:${pct}%"></div>
      </div>

      <!-- Per-question breakdown -->
      <div style="text-align:left;background:var(--glass);border:1px solid var(--border);border-radius:var(--r-md);padding:16px 18px;margin-bottom:28px;max-height:200px;overflow-y:auto">
        <div style="font-size:.78rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Results summary</div>
        ${_questions.map((q, i) => `
          <div style="display:flex;align-items:center;gap:8px;font-size:.8rem;padding:5px 0;border-bottom:1px solid var(--border)">
            <span style="color:${_results[i]?.correct ? 'var(--emerald)' : 'var(--coral)'}">${_results[i]?.correct ? '✅' : '❌'}</span>
            <span style="flex:1;color:var(--text-2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${q.question}</span>
          </div>`).join('')}
      </div>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-ghost" id="redo-btn">🔄 New Quiz</button>
        <button class="btn btn-teal" id="review-due-btn">🔁 Review Due Cards</button>
      </div>
    </div>
  `;

  document.getElementById('redo-btn').addEventListener('click', () => {
    document.getElementById('quiz-setup').style.display   = '';
    document.getElementById('quiz-results').style.display = 'none';
  });
  document.getElementById('review-due-btn').addEventListener('click', () => {
    import('../app.js').then(m => m.navigate('review'));
  });
}
