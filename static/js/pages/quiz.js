import { API, showToast, launchConfetti, icon, DailyGoal, navigate, skel } from '../app.js';

let _courses = [];
let _questions = [];
let _idx = 0;
let _sessionId = null;
let _answered = false;
let _score = 0;
let _timerHandle = null;
let _results = [];
let _keyListener = null;

let cfg = {
  scope: 'all',
  scopeId: null,
  count: 10,
  timer: 30,
  diff: ['easy', 'medium', 'hard'],
};

export async function renderQuiz(container) {
  if (_keyListener) {
    document.removeEventListener('keydown', _keyListener);
    _keyListener = null;
  }

  container.innerHTML = `
    <!-- Header -->
    <div style="margin-bottom:28px" class="rev" style="--i:0">
      <div class="pill pill-amber" style="margin-bottom:10px;font-size:0.72rem">
        ${icon('brain-circuit', '', 'width:12px;height:12px')}
        <span>Active Recall Engine</span>
      </div>
      <h1 class="page-title" style="font-size:2.3rem">Practice <em>Exam</em></h1>
      <p class="page-subtitle" style="margin-top:6px;font-size:0.92rem;max-width:540px">
        Timed active recall drills with real-time feedback, comprehension scoring, and interval adjustments.
      </p>
    </div>

    <!-- Quiz Setup Screen -->
    <div id="quiz-setup">
      <div style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start">

        <!-- Main Config Column -->
        <div class="card tilt-card rev" style="padding:28px;--i:1" id="quiz-config-card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
            <div class="icon-chip teal">${icon('brain-circuit', '', 'width:18px;height:18px')}</div>
            <h3 style="font-size:1.35rem">Exam Configuration</h3>
          </div>

          <!-- Scope Radio Cards -->
          <div class="form-group">
            <label class="form-label">Scope</label>
            <div class="rcard-grid">
              <div class="rcard active" data-scope="all">
                ${icon('library', '', 'width:20px;height:20px;color:var(--teal)')}
                <span style="font-weight:600;font-size:0.85rem">All Library</span>
                <span class="mono-meta" style="font-size:0.65rem">Comprehensive</span>
              </div>
              <div class="rcard" data-scope="course">
                ${icon('book-open', '', 'width:20px;height:20px;color:var(--teal)')}
                <span style="font-weight:600;font-size:0.85rem">By Course</span>
                <span class="mono-meta" style="font-size:0.65rem">Specific Subject</span>
              </div>
              <div class="rcard" data-scope="video">
                ${icon('clapperboard', '', 'width:20px;height:20px;color:var(--teal)')}
                <span style="font-weight:600;font-size:0.85rem">By Lecture</span>
                <span class="mono-meta" style="font-size:0.65rem">Single Video</span>
              </div>
            </div>

            <!-- Scope Selector Target -->
            <div id="scope-selector-wrap" style="margin-top:12px;display:none">
              <select id="scope-select" class="form-select">
                <option value="">Select scope target…</option>
              </select>
            </div>
          </div>

          <!-- Question Count Segmented Control -->
          <div class="form-group">
            <label class="form-label">Question Count</label>
            <div class="seg" id="seg-count">
              <button data-val="5">5 Qs</button>
              <button data-val="10" class="on">10 Qs</button>
              <button data-val="15">15 Qs</button>
              <button data-val="20">20 Qs</button>
            </div>
          </div>

          <!-- Timer Segmented Control -->
          <div class="form-group">
            <label class="form-label">Timer Per Question</label>
            <div class="seg" id="seg-timer">
              <button data-val="15">15s (Fast)</button>
              <button data-val="30" class="on">30s (Standard)</button>
              <button data-val="60">60s (Relaxed)</button>
              <button data-val="0">No Timer</button>
            </div>
          </div>

          <!-- Difficulty Filter Chips -->
          <div class="form-group">
            <label class="form-label">Difficulty Range</label>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem">
                <input type="checkbox" class="diff-chk" value="easy" checked style="accent-color:var(--teal)" />
                <span>Easy</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem">
                <input type="checkbox" class="diff-chk" value="medium" checked style="accent-color:var(--teal)" />
                <span>Medium</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem">
                <input type="checkbox" class="diff-chk" value="hard" checked style="accent-color:var(--teal)" />
                <span>Hard</span>
              </label>
            </div>
          </div>

          <!-- Start Button -->
          <button class="btn btn-primary btn-full btn-lg" id="quiz-start-btn" style="margin-top:10px">
            <span class="spin" id="q-start-spin" style="display:none"></span>
            <span id="q-start-lbl">Start Practice Exam</span>
          </button>
        </div>

        <!-- Right Rail: Question Generator + Session Stats -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- AI Generator Toggle Card -->
          <div class="card card-sm">
            <div id="ai-gen-toggle" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer">
              <div style="display:flex;align-items:center;gap:8px">
                <div class="icon-chip teal" style="width:28px;height:28px">${icon('sparkles', '', 'width:14px;height:14px')}</div>
                <span class="card-title" style="font-size:0.85rem">AI Question Generator</span>
              </div>
              <span id="ai-gen-chev" style="color:var(--faint);transition:transform 0.2s">${icon('chevron-down', '', 'width:14px;height:14px')}</span>
            </div>

            <div id="ai-gen-panel" style="display:none;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
              <div class="form-group" style="margin-bottom:12px">
                <label class="form-label" style="font-size:0.7rem">Target Lecture</label>
                <select id="gen-video-sel" class="form-select" style="font-size:0.8rem;padding:8px 32px 8px 10px">
                  <option value="">Select a video…</option>
                </select>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label" style="font-size:0.7rem">Count</label>
                  <select id="gen-num-sel" class="form-select" style="font-size:0.8rem;padding:8px 32px 8px 10px">
                    <option value="5">5 Qs</option>
                    <option value="10" selected>10 Qs</option>
                    <option value="20">20 Qs</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label" style="font-size:0.7rem">Difficulty</label>
                  <div style="display:flex;gap:6px;padding-top:6px;font-size:0.75rem">
                    <label><input type="checkbox" class="gdiff" value="easy" checked /> E</label>
                    <label><input type="checkbox" class="gdiff" value="medium" checked /> M</label>
                    <label><input type="checkbox" class="gdiff" value="hard" checked /> H</label>
                  </div>
                </div>
              </div>

              <div id="gen-msg" style="display:none;padding:8px 10px;border-radius:var(--r-sm);font-size:0.78rem;margin-bottom:10px"></div>

              <button id="gen-exec-btn" class="btn btn-ghost btn-full btn-sm">
                <span class="spin" id="gen-spin" style="display:none"></span>
                <span id="gen-lbl">Generate Questions</span>
              </button>
            </div>
          </div>

          <!-- Recent Sessions -->
          <div class="card card-sm">
            <div class="card-title" style="margin-bottom:10px">Recent Sessions</div>
            <div id="recent-sessions-list" style="display:flex;flex-direction:column;gap:8px">
              ${skel('100%', 24)}
              ${skel('100%', 24)}
            </div>
          </div>

        </div>

      </div>
    </div>

    <!-- Active Quiz Playing Panel -->
    <div id="quiz-play" style="display:none;max-width:720px;margin:0 auto"></div>

    <!-- Results Panel -->
    <div id="quiz-results" style="display:none;max-width:640px;margin:0 auto"></div>
  `;

  try {
    await initConfigData();
    bindConfigEvents();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function initConfigData() {
  const [courses, stats] = await Promise.allSettled([
    API.get('/api/courses'),
    API.get('/api/stats'),
  ]);

  _courses = courses.status === 'fulfilled' ? courses.value : [];
  populateScopeSelect();
  populateGeneratorVideos();

  const recentList = document.getElementById('recent-sessions-list');
  if (recentList && stats.status === 'fulfilled') {
    const sessions = (stats.value?.recent_sessions || []).filter(s => (s.answered || 0) > 0);
    if (!sessions.length) {
      recentList.innerHTML = `<span style="font-size:0.8rem;color:var(--faint)">No previous sessions recorded.</span>`;
    } else {
      recentList.innerHTML = sessions.slice(0, 3).map(s => {
        const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
        const pillCls = acc >= 80 ? 'pill-green' : acc >= 60 ? 'pill-amber' : 'pill-coral';
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem">
            <span class="mono-meta" style="color:var(--text);font-size:0.72rem">${s.date}</span>
            <span class="pill ${pillCls}" style="font-size:0.65rem">${acc}% (${s.correct}/${s.answered})</span>
          </div>`;
      }).join('');
    }
  }
}

function populateScopeSelect() {
  const sel = document.getElementById('scope-select');
  if (!sel) return;

  if (cfg.scope === 'course') {
    sel.innerHTML = _courses.map(c => `<option value="${c.id}">${c.name} (${c.question_count} Qs)</option>`).join('');
    cfg.scopeId = sel.value || null;
  } else if (cfg.scope === 'video') {
    let html = '';
    _courses.forEach(c => {
      (c.videos || []).forEach(v => {
        html += `<option value="${v.id}">${v.title} (${c.name})</option>`;
      });
    });
    sel.innerHTML = html || '<option value="">No lectures available</option>';
    cfg.scopeId = sel.value || null;
  }
}

function populateGeneratorVideos() {
  const gsel = document.getElementById('gen-video-sel');
  if (!gsel) return;
  let html = '';
  _courses.forEach(c => {
    (c.videos || []).forEach(v => {
      html += `<option value="${v.id}">${v.title}</option>`;
    });
  });
  gsel.innerHTML = html || '<option value="">No videos available</option>';
}

function bindConfigEvents() {
  document.querySelectorAll('.rcard[data-scope]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.rcard[data-scope]').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      cfg.scope = card.dataset.scope;

      const wrap = document.getElementById('scope-selector-wrap');
      if (wrap) wrap.style.display = cfg.scope === 'all' ? 'none' : 'block';
      populateScopeSelect();
    });
  });

  document.getElementById('scope-select')?.addEventListener('change', e => {
    cfg.scopeId = e.target.value;
  });

  document.querySelectorAll('#seg-count button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#seg-count button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      cfg.count = parseInt(btn.dataset.val);
    });
  });

  document.querySelectorAll('#seg-timer button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#seg-timer button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      cfg.timer = parseInt(btn.dataset.val);
    });
  });

  document.querySelectorAll('.diff-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      cfg.diff = [...document.querySelectorAll('.diff-chk:checked')].map(c => c.value);
    });
  });

  document.getElementById('quiz-start-btn')?.addEventListener('click', () => startQuiz());

  const aiToggle = document.getElementById('ai-gen-toggle');
  const aiPanel = document.getElementById('ai-gen-panel');
  const aiChev = document.getElementById('ai-gen-chev');
  let aiOpen = false;
  aiToggle?.addEventListener('click', () => {
    aiOpen = !aiOpen;
    if (aiPanel) aiPanel.style.display = aiOpen ? 'block' : 'none';
    if (aiChev) aiChev.style.transform = aiOpen ? 'rotate(180deg)' : '';
  });

  document.getElementById('gen-exec-btn')?.addEventListener('click', execQuestionGen);
}

async function execQuestionGen() {
  const vidId = document.getElementById('gen-video-sel')?.value;
  const num = parseInt(document.getElementById('gen-num-sel')?.value || '10');
  const diffs = [...document.querySelectorAll('.gdiff:checked')].map(x => x.value);
  const msg = document.getElementById('gen-msg');
  const btn = document.getElementById('gen-exec-btn');
  const spin = document.getElementById('gen-spin');
  const lbl = document.getElementById('gen-lbl');

  if (!vidId) { showToast('Select a video first', 'error'); return; }
  if (!diffs.length) { showToast('Select at least one difficulty', 'error'); return; }

  btn.classList.add('loading');
  btn.disabled = true;
  if (spin) spin.style.display = 'inline-block';
  if (lbl) lbl.textContent = 'Generating…';

  try {
    const res = await API.post('/api/quiz/generate', {
      video_id: parseInt(vidId),
      num_questions: num,
      difficulties: diffs,
    });
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = 'rgba(52, 211, 153, 0.15)';
      msg.style.color = 'var(--emerald)';
      msg.textContent = `Generated and saved ${res.count} questions.`;
    }
    showToast(`Generated ${res.count} new questions`, 'success');
  } catch (e) {
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = 'rgba(251, 113, 133, 0.15)';
      msg.style.color = 'var(--coral)';
      msg.textContent = `Error: ${e.message}`;
    }
    showToast(e.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    if (spin) spin.style.display = 'none';
    if (lbl) lbl.textContent = 'Generate Questions';
  }
}

async function startQuiz() {
  if (!cfg.diff.length) { showToast('Select at least one difficulty', 'error'); return; }

  const btn = document.getElementById('quiz-start-btn');
  const spin = document.getElementById('q-start-spin');
  const lbl = document.getElementById('q-start-lbl');

  if (btn) {
    btn.classList.add('loading');
    btn.disabled = true;
    if (spin) spin.style.display = 'inline-block';
    if (lbl) lbl.textContent = 'Preparing Exam…';
  }

  try {
    let params = `limit=${cfg.count}`;
    if (cfg.scope === 'course' && cfg.scopeId) {
      params = `scope=course&scope_id=${cfg.scopeId}&${params}`;
    } else if (cfg.scope === 'video' && cfg.scopeId) {
      params = `scope=video&scope_id=${cfg.scopeId}&${params}`;
    }

    _questions = await API.get(`/api/quiz/questions?${params}`);
    if (!_questions.length) {
      showToast('No questions found in this scope — add lectures or generate questions first', 'error');
      return;
    }

    const res = await API.post('/api/quiz/start-session', {});
    _sessionId = res.session_id;
    _idx = 0;
    _score = 0;
    _results = [];

    document.getElementById('quiz-setup').style.display = 'none';
    document.getElementById('quiz-play').style.display = 'block';
    document.getElementById('quiz-results').style.display = 'none';

    setupInQuizKeyboard();
    renderQuestion();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
      if (spin) spin.style.display = 'none';
      if (lbl) lbl.textContent = 'Start Practice Exam';
    }
  }
}

function renderQuestion() {
  clearTimer();
  const q = _questions[_idx];
  const total = _questions.length;
  const panel = document.getElementById('quiz-play');
  _answered = false;

  const pct = ((_idx + 1) / total) * 100;
  const LETTERS = ['A', 'B', 'C', 'D'];

  panel.innerHTML = `
    <!-- Top Progress Row -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="mono-meta">QUESTION ${_idx + 1} OF ${total}</span>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="mono-meta" style="color:var(--teal)">SCORE: ${_score}</span>
        <div style="display:flex;gap:4px">
          <span class="kbd">1</span>
          <span class="kbd">2</span>
          <span class="kbd">3</span>
          <span class="kbd">4</span>
        </div>
      </div>
    </div>

    <!-- Progress Track -->
    <div class="progress-track" style="margin-bottom:14px">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div>

    <!-- Countdown Timer Bar (If timer enabled) -->
    ${cfg.timer > 0 ? `
      <div class="tbar" id="quiz-tbar" style="margin-bottom:18px">
        <i id="quiz-tbar-fill" style="width:100%"></i>
      </div>` : ''}

    <!-- Question Card -->
    <div class="card" style="padding:32px">
      <div class="mono-meta" style="color:var(--teal);margin-bottom:12px">ACTIVE RECALL EXAM</div>
      <div style="font-size:1.15rem;font-weight:600;line-height:1.6;color:var(--text);margin-bottom:24px">
        ${q.question}
      </div>

      <div style="display:grid;gap:10px" id="quiz-options-list">
        ${q.options.map((opt, i) => `
          <button class="opt" data-val="${opt.replace(/"/g, '&quot;')}" data-key="${i + 1}">
            <span class="key">${LETTERS[i]}</span>
            <span style="flex:1">${opt}</span>
          </button>`).join('')}
      </div>

      <div id="q-feedback" style="display:none;margin-top:20px"></div>
    </div>
  `;

  panel.querySelectorAll('.opt').forEach(btn => {
    btn.addEventListener('click', () => selectAnswer(btn, q));
  });

  if (cfg.timer > 0) startTimer(cfg.timer, q);
}

function startTimer(dur, q) {
  const fill = document.getElementById('quiz-tbar-fill');
  const tbar = document.getElementById('quiz-tbar');
  const start = performance.now();

  _timerHandle = setInterval(() => {
    const elapsed = (performance.now() - start) / 1000;
    const remaining = Math.max(0, dur - elapsed);
    const pct = (remaining / dur) * 100;

    if (fill) fill.style.width = `${pct}%`;
    if (tbar) {
      if (pct < 25) tbar.className = 'tbar danger';
      else if (pct < 50) tbar.className = 'tbar warn';
    }

    if (remaining <= 0) {
      clearTimer();
      if (!_answered) timeOut(q);
    }
  }, 100);
}

function clearTimer() {
  if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }
}

function timeOut(q) {
  _answered = true;
  _results.push({ question: q.question, chosen: 'Timed Out', answer: q.answer, correct: false });
  document.querySelectorAll('#quiz-options-list .opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add('correct');
    else b.classList.add('dim');
  });
  showFeedback(false, q.answer, true);
}

async function selectAnswer(btn, q) {
  if (_answered) return;
  _answered = true;
  clearTimer();

  const chosen = btn.dataset.val;
  const correct = chosen === q.answer;
  if (correct) _score++;
  _results.push({ question: q.question, chosen, answer: q.answer, correct });

  document.querySelectorAll('#quiz-options-list .opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === q.answer) {
      b.classList.add('correct');
    } else if (b === btn && !correct) {
      b.classList.add('wrong');
    } else {
      b.classList.add('dim');
    }
  });

  showFeedback(correct, q.answer, false);
  DailyGoal.addProgress(1);

  try {
    await API.post('/api/quiz/answer', {
      session_id: _sessionId,
      question_id: q.id,
      is_correct: correct,
      performance: correct ? 'good' : 'hard',
    });
  } catch { /**/ }
}

function showFeedback(correct, answer, timedOut) {
  const fb = document.getElementById('q-feedback');
  if (!fb) return;
  fb.style.display = 'block';

  let msg = '';
  if (timedOut) msg = `<span style="color:var(--amber)">Time expired. Correct answer: ${answer}</span>`;
  else if (correct) msg = `<span style="color:var(--emerald)">Correct answer!</span>`;
  else msg = `<span style="color:var(--coral)">Correct answer: ${answer}</span>`;

  fb.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:16px;border-top:1px solid var(--line)">
      <div style="font-weight:600;font-size:0.92rem">${msg}</div>
      <button class="btn btn-primary btn-sm" id="next-q-btn">
        <span>${_idx + 1 < _questions.length ? 'Next Question' : 'View Results'}</span>
        ${icon('arrow-right', '', 'width:14px;height:14px')}
      </button>
    </div>`;

  document.getElementById('next-q-btn')?.addEventListener('click', () => {
    _idx++;
    if (_idx < _questions.length) renderQuestion();
    else renderResults();
  });
}

function renderResults() {
  clearTimer();
  if (_keyListener) {
    document.removeEventListener('keydown', _keyListener);
    _keyListener = null;
  }

  document.getElementById('quiz-play').style.display = 'none';
  const resPanel = document.getElementById('quiz-results');
  resPanel.style.display = 'block';

  const total = _questions.length;
  const pct = Math.round((_score / total) * 100);
  if (pct >= 70) launchConfetti();

  resPanel.innerHTML = `
    <div class="card" style="text-align:center;padding:48px 28px">
      <div class="icon-chip ${pct >= 70 ? 'teal' : 'amber'}" style="width:56px;height:56px;margin:0 auto 16px">
        ${icon(pct >= 70 ? 'target' : 'brain-circuit', '', 'width:28px;height:28px')}
      </div>

      <div class="page-title" style="font-size:2.2rem">Exam <em>Complete</em></div>
      <div class="serif-num" style="font-size:4.5rem;color:${pct >= 70 ? 'var(--teal)' : 'var(--amber)'};margin:8px 0">
        ${pct}%
      </div>
      <div style="font-size:0.95rem;color:var(--text);margin-bottom:10px">
        ${_score} correct out of ${total} questions
      </div>
      <span class="pill ${pct >= 80 ? 'pill-green' : pct >= 60 ? 'pill-teal' : 'pill-amber'}" style="margin-bottom:28px">
        ${pct >= 80 ? 'Mastery Retained' : pct >= 60 ? 'Solid Recall' : 'Needs Review'}
      </span>

      <!-- Question Breakdown -->
      <div style="text-align:left;margin-bottom:28px">
        <div class="card-title" style="margin-bottom:12px">Question Breakdown</div>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto;padding-right:4px">
          ${_results.map((r, i) => `
            <div class="card card-xs" style="border-left:3px solid ${r.correct ? 'var(--emerald)' : 'var(--coral)'};background:var(--sf2);padding:10px 14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span class="mono-meta" style="color:var(--teal)">Q${i + 1}</span>
                <span class="pill ${r.correct ? 'pill-green' : 'pill-coral'}" style="font-size:0.62rem">${r.correct ? 'Correct' : 'Missed'}</span>
              </div>
              <div style="font-weight:600;font-size:0.88rem;color:var(--text);margin-bottom:4px">${r.question}</div>
              <div style="font-size:0.78rem;color:var(--muted)">
                ${r.correct ? `Answer: ${r.answer}` : `Chosen: <span style="color:var(--coral)">${r.chosen}</span> · Correct: <span style="color:var(--teal)">${r.answer}</span>`}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-ghost btn-sm" id="quiz-config-btn">
          ${icon('settings-2', '', 'width:14px;height:14px')}
          <span>Change Settings</span>
        </button>
        <button class="btn btn-primary btn-sm" id="quiz-retry-btn">
          ${icon('rotate-cw', '', 'width:14px;height:14px')}
          <span>Take Another Quiz</span>
        </button>
      </div>
    </div>`;

  document.getElementById('quiz-config-btn')?.addEventListener('click', () => {
    document.getElementById('quiz-setup').style.display = 'block';
    resPanel.style.display = 'none';
  });

  document.getElementById('quiz-retry-btn')?.addEventListener('click', () => {
    startQuiz();
  });
}

function setupInQuizKeyboard() {
  _keyListener = e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      const opts = document.querySelectorAll('#quiz-options-list .opt');
      if (opts[idx] && !opts[idx].disabled) {
        opts[idx].click();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      const nextBtn = document.getElementById('next-q-btn');
      if (nextBtn) {
        e.preventDefault();
        nextBtn.click();
      }
    }
  };

  document.addEventListener('keydown', _keyListener);
}
