/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Practice & Drill Engine (`#/practice`)
   High-Density Exam Suite: Scope Config, Active Drill, Telemetry & Full History
   ══════════════════════════════════════════════════════════════════ */

import { API, showToast, DailyGoal, Streak, navigate, skel, invalidateDueCount } from '../app.js';

import { html, correctIndex, autoRate, paceBar, timeLabel, sessionHeader, choices, sessionPanel, feedback, completeMarkup } from '../session-ui.js';

let _practiceVersion = 0;
let _activeContainer = null;
let _sessionStarted = 0;
let _questionStarted = 0;
let _deadline = 0;
let _savePending = false;
let _pendingAnswer = null;
let _courses = [];
let _questions = [];
let _activeIdx = 0;
let _selectedOption = null;
let _score = 0;
let _sessionId = 0;
let _timerHandle = null;
let _results = [];
let _timerSeconds = 30;
let _timeLeft = 30;
let _keyHandler = null;
let _answered = false;
export function cleanupPractice() {
  _practiceVersion++;
  _activeContainer = null;
  clearInterval(_timerHandle);
  if (_keyHandler) window.removeEventListener('keydown',_keyHandler);
  _timerHandle = _keyHandler = null;
}

let _cfg = {
  scope: 'all',
  scopeId: null,
  count: 10,
  timer: 30,
  diff: ['easy', 'medium', 'hard'],
};

export async function renderPractice(container, options = {}) {
  cleanupPractice();
  const subpath = options.subpath;
  if (subpath !== 'session') { _questions = []; _results = []; _sessionStarted = 0; }
  if (subpath === 'session' && !_questions.length) { navigate('practice'); return; }
  if (subpath !== 'session') _cfg = {scope:['course','video'].includes(options.scope) ? options.scope : 'all',scopeId:options.scopeId || null,count:10,timer:30,diff:['easy','medium','hard']};

  if (subpath === 'session') {
    renderActiveSession(container);
    return;
  }

  // Render Practice
  container.innerHTML = `
    <!-- Header -->
    <div class="page-head">
      <div>
        <div class="chapter-tag"><span>03</span>Active recall</div><h1 class="page-head-title">Practice.</h1>
        <div class="page-head-desc">Choose a scope, set the pace, and test your understanding.</div>
      </div>
    </div>

    <!-- 2-Column Top Hub Layout -->
    <div class="practice-layout" data-stagger>
      
      <!-- Left Column: Exam Configuration -->
      <div class="card spot practice-config" style="display:flex;flex-direction:column;gap:18px">
        <span class="card-title">Session setup</span>

        <!-- Scope Radio Cards -->
        <div class="form-group">
          <label class="form-label">What would you like to practice?</label>
          <div class="radio-card-grid">
            <div class="radio-card active" data-scope="all">
              <div class="radio-card-title">All Library</div>
              <div class="radio-card-desc">A little of everything</div>
            </div>
            <div class="radio-card" data-scope="course">
              <div class="radio-card-title">By Course</div>
              <div class="radio-card-desc">Specific subject</div>
            </div>
            <div class="radio-card" data-scope="video">
              <div class="radio-card-title">By Lecture</div>
              <div class="radio-card-desc">Single lecture</div>
            </div>
          </div>

          <!-- Target Selector (Conditional) -->
          <div id="scope-target-wrap" style="margin-top:10px;display:none">
            <select id="scope-select" class="form-select"></select>
          </div>
        </div>

        <!-- Question Count Segmented Control -->
        <div class="form-group">
          <label class="form-label">Question Count</label>
          <div class="segmented" id="seg-count" style="width:100%">
            <button class="segmented-btn" data-val="5" style="flex:1">5 Qs</button>
            <button class="segmented-btn active" data-val="10" style="flex:1">10 Qs</button>
            <button class="segmented-btn" data-val="15" style="flex:1">15 Qs</button>
            <button class="segmented-btn" data-val="20" style="flex:1">20 Qs</button>
          </div>
        </div>

        <!-- Timer Segmented Control -->
        <div class="form-group">
          <label class="form-label">Timer Per Question</label>
          <div class="segmented" id="seg-timer" style="width:100%">
            <button class="segmented-btn" data-val="15" style="flex:1">15s Fast</button>
            <button class="segmented-btn active" data-val="30" style="flex:1">30s Standard</button>
            <button class="segmented-btn" data-val="60" style="flex:1">60s Relaxed</button>
            <button class="segmented-btn" data-val="0" style="flex:1">No Timer</button>
          </div>
        </div>

        <!-- Submit Button -->
        <button class="btn btn-primary btn-full btn-lg" id="quiz-start-btn" style="margin-top:4px">
          <span>Start session</span>
        </button>
      </div>

      <!-- Right Column: Telemetry & AI Generator -->
      <div class="practice-aside" style="display:flex;flex-direction:column;gap:0">
        
        <!-- Telemetry Card 1: Your recent accuracy -->
        <div class="card card-sm spot">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span class="card-title">Your recent accuracy</span>
            <span class="chip chip-ok mono" id="trend-delta-chip">Recent sessions</span>
          </div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px">
            <span class="stat-value" id="trend-avg-val" data-count="0" data-count-suffix="%">0%</span>
            <span class="stat-sub">avg accuracy</span>
          </div>
          <div class="chart-bars-wrap" id="trend-spark-bars" style="height:56px;gap:6px;align-items:flex-end">
<span class="caption-text">Complete a practice session to see your trend.</span>
          </div>
        </div>

        <div class="card card-sm spot"><div class="section-heading"><span class="card-title">Question bank</span><span class="chip chip-accent mono" id="bank-total-lbl">0 Qs</span></div><p class="body-text" style="margin-bottom:14px">Questions drawn from your imported lectures.</p><p class="study-tip">Use the lecture selector below to add more questions to a specific subject.</p></div>

        <!-- AI Generator Card -->
        <div class="card card-sm spot">
          <span class="card-title" style="margin-bottom:15px;display:block">Add practice questions</span>
        <!-- Difficulty Selection -->
        <div class="form-group difficulty-block">
          <label class="form-label">Question difficulty</label>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <label class="chk-label"><input type="checkbox" class="chk-input diff-chk" value="easy" checked /> Easy</label>
            <label class="chk-label"><input type="checkbox" class="chk-input diff-chk" value="medium" checked /> Medium</label>
            <label class="chk-label"><input type="checkbox" class="chk-input diff-chk" value="hard" checked /> Hard</label>
          </div>
        </div>


          <div style="display:flex;flex-direction:column;gap:8px">
            <select id="gen-video-sel" class="form-select" style="font-size:12px;height:28px">
              <option value="">Select target lecture…</option>
            </select>
            <div style="display:flex;gap:6px">
              <select id="gen-count-sel" class="form-select" style="font-size:12px;height:28px;flex:1">
                <option value="5">5 Qs</option>
                <option value="10" selected>10 Qs</option>
                <option value="20">20 Qs</option>
              </select>
              <button class="btn btn-secondary btn-sm" id="gen-btn" style="flex:1">Generate</button>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- Bottom Full-Width Session History & Drill Telemetry Table -->
    <div class="card spot practice-history" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div>
          <span class="card-title">Recent sessions</span>
          <div class="caption-text" style="margin-top:2px">Results from your recorded practice sessions.</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="window.navigate('insights')">
          <span>View Insights &amp; Analytics</span>
          <svg style="width:12px;height:12px"><use href="#i-arrow-right"/></svg>
        </button>
      </div>

      <div class="tbl-wrap" id="quiz-full-history-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="tbl-header-label">Date &amp; Time</th>
              <th class="tbl-header-label">Scope</th>
              <th class="tbl-header-label num-col">Score</th>
              <th class="tbl-header-label num-col">Accuracy</th>
              <th class="tbl-header-label">Performance Rating</th>
              <th class="tbl-header-label num-col" style="width:80px">Action</th>
            </tr>
          </thead>
          <tbody id="quiz-full-history-tbody">
            <tr>
              <td colspan="6" style="padding:24px;text-align:center;color:var(--txt-3)">
                ${skel('100%', 32)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Scope Selectors
  container.querySelectorAll('.radio-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      _cfg.scope = card.dataset.scope;
      updateScopeTargetUI();
    });
  });

  // Bind Segmented Controls
  bindSeg('#seg-count', val => _cfg.count = parseInt(val, 10));
  bindSeg('#seg-timer', val => _cfg.timer = parseInt(val, 10));

  function bindSeg(selector, cb) {
    container.querySelectorAll(`${selector} .segmented-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll(`${selector} .segmented-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cb(btn.dataset.val);
      });
    });
  }

  // Bind Generator Button
  document.getElementById('gen-btn')?.addEventListener('click', async () => {
    const videoId = document.getElementById('gen-video-sel')?.value;
    const count = parseInt(document.getElementById('gen-count-sel')?.value || '10', 10);
    if (!videoId) {
      showToast('Select a lecture first', 'warn');
      return;
    }
    if (!container.querySelector('.diff-chk:checked')) { showToast('Choose at least one difficulty for AI generation.', 'warn'); return; }
    const genBtn = document.getElementById('gen-btn');
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.textContent = 'Generating…';
    }
    try {
      await API.post('/api/quiz/generate', { video_id: parseInt(videoId, 10), num_questions: count, difficulties: [...container.querySelectorAll('.diff-chk:checked')].map(c => c.value) });
      showToast('New questions successfully generated!', 'success');
      initHubData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.textContent = 'Generate';
      }
    }
  });

  // Start Drill Button
  document.getElementById('quiz-start-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('quiz-start-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span>Preparing your questions…</span>'; }

    try {
      const scopeParam = _cfg.scope || 'all';
      const scopeIdParam = _cfg.scopeId ? parseInt(_cfg.scopeId, 10) : 0;
      const [rawData, saved] = await Promise.all([
        API.get(`/api/quiz/questions?scope=${scopeParam}&scope_id=${scopeIdParam}&limit=${_cfg.count}`),
        API.post('/api/quiz/start-session').catch(() => ({ session_id: 0 })),
      ]);
      const list = Array.isArray(rawData) ? rawData : rawData?.questions || [];
      _questions = list.filter(q => q.id && (q.question || q.concept) && Array.isArray(q.options) && q.options.length > 1 && correctIndex(q) >= 0).slice(0,_cfg.count);
      if (!_questions.length) {
        showToast('No usable multiple-choice questions in this scope. Generate questions for a lecture first.','warn');
        btn.disabled = false;
        btn.textContent = 'Start session';
        return;
      }
      _sessionId = saved?.session_id || 0;
      _sessionStarted = Date.now();
      _activeIdx = 0;
      _score = 0;
      _results = [];
      _timerSeconds = _cfg.timer;
      renderActiveSession(container);
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Start session</span>'; }
    }
  });

  // Load Data
  await initHubData();
  container.querySelectorAll('.radio-card').forEach(card => card.classList.toggle('active',card.dataset.scope === _cfg.scope));
  updateScopeTargetUI();
}

async function initHubData() {
  try {
    const [courses, stats] = await Promise.allSettled([
      API.get('/api/courses'),
      API.get('/api/stats'),
    ]);

    _courses = courses.status === 'fulfilled' ? courses.value : [];
    populateGeneratorSelect();
    const recent = stats.status === 'fulfilled' ? (stats.value.recent_sessions || []).filter(s => s.answered > 0) : [];
    const trend = document.getElementById('trend-avg-val');
    const average = recent.length ? Math.round(recent.reduce((n,s) => n + s.correct / s.answered * 100,0) / recent.length) : 0;
    if (trend) { trend.dataset.count = average; trend.textContent = `${average}%`; }
    const bars = document.getElementById('trend-spark-bars');
    if (bars && recent.length) bars.innerHTML = recent.slice(0,6).reverse().map(s => `<div style="flex:1;height:100%;display:flex;align-items:flex-end"><div class="chart-bar-fill" style="width:100%;height:${Math.round(s.correct/s.answered*100)}%;border-radius:5px" title="${s.date}: ${Math.round(s.correct/s.answered*100)}% correct"></div></div>`).join('');

    // Populate total questions badge
    let totalQuestions = 0;
    _courses.forEach(c => totalQuestions += (c.question_count || 0));
    const bankLbl = document.getElementById('bank-total-lbl');
    if (bankLbl) bankLbl.textContent = `${totalQuestions} Qs`;

    const tbody = document.getElementById('quiz-full-history-tbody');
    if (tbody && stats.status === 'fulfilled') {
      const sessions = (stats.value?.recent_sessions || []).filter(s => (s.answered || 0) > 0);
      if (!sessions.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="padding:28px 16px;text-align:center">
              <div class="caption-text" style="margin-bottom:8px">No practice drills completed yet.</div>
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('quiz-start-btn')?.click()">
                <span>Launch Your First Drill</span>
              </button>
            </td>
          </tr>`;
      } else {
        tbody.innerHTML = sessions.map(s => {
          const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
          const chipCls = acc >= 80 ? 'chip-ok' : acc >= 60 ? 'chip-warn' : 'chip-danger';
          const ratingLbl = acc >= 80 ? 'Mastery' : acc >= 60 ? 'Moderate' : 'Needs Review';
          return `
            <tr>
              <td class="mono" style="color:var(--txt-1)">${s.date}</td>
              <td>
                <span class="chip chip-neutral mono" style="font-size:11px">General Drill</span>
              </td>
              <td class="num-col mono font-medium">${s.correct} / ${s.answered}</td>
              <td class="num-col mono">
                <span class="chip ${chipCls}" style="font-size:11px">${acc}%</span>
              </td>
              <td>
                <span class="caption-text" style="color:var(--txt-2)">${ratingLbl}</span>
              </td>
              <td class="num-col">
                <button class="btn btn-ghost btn-sm" onclick="window.navigate('practice')" style="padding:0 8px;font-size:11.5px">
                  <span>Retake</span>
                </button>
              </td>
            </tr>`;
        }).join('');
      }
    }
  } catch { /**/ }
}

function updateScopeTargetUI() {
  const wrap = document.getElementById('scope-target-wrap');
  const sel = document.getElementById('scope-select');
  if (!wrap || !sel) return;

  if (_cfg.scope === 'all') {
    wrap.style.display = 'none';
    _cfg.scopeId = null;
  } else if (_cfg.scope === 'course') {
    wrap.style.display = 'block';
    sel.innerHTML = _courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (_cfg.scopeId && [...sel.options].some(o => o.value === String(_cfg.scopeId))) sel.value = String(_cfg.scopeId);
    _cfg.scopeId = sel.value;
  } else if (_cfg.scope === 'video') {
    wrap.style.display = 'block';
    const opts = [];
    _courses.forEach(c => {
      (c.videos || []).forEach(v => opts.push(`<option value="${v.id}">${v.title}</option>`));
    });
    sel.innerHTML = opts.join('') || '<option>No lectures</option>';
    if (_cfg.scopeId && [...sel.options].some(o => o.value === String(_cfg.scopeId))) sel.value = String(_cfg.scopeId);
    _cfg.scopeId = sel.value;
  }

  sel.onchange = () => {
    _cfg.scopeId = sel.value;
  };
}

function populateGeneratorSelect() {
  const sel = document.getElementById('gen-video-sel');
  if (!sel) return;
  const opts = [];
  _courses.forEach(c => {
    (c.videos || []).forEach(v => opts.push(`<option value="${v.id}">${v.title}</option>`));
  });
  sel.innerHTML = opts.join('') || '<option value="">No lectures available</option>';
}

// Active session controller; the setup view above shares the same question bank.
function scopeLabel() {
  if (_cfg.scope === 'course') return _courses.find(c => String(c.id) === String(_cfg.scopeId))?.name || 'Selected course';
  if (_cfg.scope === 'video') return _courses.flatMap(c => c.videos || []).find(v => String(v.id) === String(_cfg.scopeId))?.title || 'Selected lecture';
  return 'All library';
}

function stopQuestion() {
  clearInterval(_timerHandle);
  if (_keyHandler) window.removeEventListener('keydown',_keyHandler);
  _timerHandle = _keyHandler = null;
}

function renderActiveSession(container) {
  stopQuestion();
  const version = ++_practiceVersion;
  _activeContainer = container;
  _answered = false;
  _savePending = false;
  _pendingAnswer = null;
  document.body.classList.add('mode-focused');
  document.body.dataset.sessionKind = 'practice';
  if (!_questions.length) { navigate('practice'); return; }
  if (_activeIdx >= _questions.length) { renderResultsView(container); return; }
  history.replaceState(null,'','#practice/session');
  if (!_sessionStarted) _sessionStarted = Date.now();
  const q = _questions[_activeIdx];
  _selectedOption = null;
  _timeLeft = _timerSeconds;
  _questionStarted = performance.now();
  _deadline = Date.now() + _timerSeconds*1000;
  container.innerHTML = sessionHeader({title:'Practice quiz',completed:_results.length,total:_questions.length,exitId:'session-abort-btn',timer:_timerSeconds ? `${_timeLeft}s` : 'Untimed',timerId:'drill-timer-chip'}) + `
    <main class="session-workspace"><div class="session-heading"><div><span class="session-kicker">Practice / ${html(_timerSeconds ? 'Timed quiz' : 'Untimed quiz')}</span><h1>Test your understanding.</h1><p>Answer quickly for Easy (&lt;15s) or Medium (15–20s) placement; slower or missed answers place as Hard.</p></div><span class="session-position">${String(_activeIdx+1).padStart(2,'0')} / ${String(_questions.length).padStart(2,'0')}</span></div><div class="session-layout"><div class="session-stage"><section class="session-question"><div class="session-question-main"><div class="session-question-meta"><span class="session-question-kind"><svg width="14" height="14"><use href="#i-brain-circuit"/></svg>Multiple choice <span class="mono">· ${String(_activeIdx+1).padStart(2,'0')}</span></span><span class="session-question-source">${html(scopeLabel())}</span></div>${paceBar({id:'drill-pace-fill'})}<h2 class="session-question-title" id="drill-question-title">${html(q.question || q.concept)}</h2>${choices(q,{id:'drill-options-wrap'})}<div id="drill-feedback-slot"></div></div><div class="session-question-actions"><span class="session-action-note" id="drill-action-note">Click an option or press <kbd>1–${q.options.length}</kbd> to answer immediately.</span><button class="btn btn-secondary session-primary-action" id="drill-submit-btn">Reveal answer (Hard)</button></div><div class="session-save-state" id="drill-save-state" role="status"></div></section><div class="session-under-note"><span>${html(scopeLabel())}</span><span>${_timerSeconds ? `${_timerSeconds} seconds per question` : 'No countdown · auto-rated by speed'}</span></div></div>${sessionPanel({items:_questions,index:_activeIdx,results:_results,kind:'practice',source:scopeLabel()})}</div></main>`;
  container.onclick = e => {
    const button = e.target.closest('button');
    if (!button || version !== _practiceVersion) return;
    if (button.id === 'session-abort-btn') navigate('practice');
    else if (button.matches('.session-choice')) selectQuizAnswer(Number(button.dataset.idx));
    else if (button.id === 'drill-submit-btn') {
      if (_answered) { _activeIdx++; renderActiveSession(container); }
      else submitAnswer(_selectedOption !== null ? _selectedOption : -2);
    } else if (button.id === 'drill-retry-save') saveQuizAnswer(version);
  };
  _timerHandle = setInterval(() => {
    if (version !== _practiceVersion || _answered) { clearInterval(_timerHandle); return; }
    const elapsedSec = (performance.now() - _questionStarted) / 1000;
    const paceFill = container.querySelector('#drill-pace-fill');
    const paceLbl = container.querySelector('#drill-pace-fill-lbl');
    if (paceFill) {
      const pct = Math.max(0, 100 - (elapsedSec / 25) * 100);
      paceFill.style.setProperty('--pct', pct.toFixed(1));
      paceFill.className = `pace-ring ${elapsedSec < 15 ? 'is-easy' : elapsedSec <= 20 ? 'is-medium' : 'is-hard'}`;
    }
    if (paceLbl) {
      const tier = elapsedSec < 15 ? 'Easy' : elapsedSec <= 20 ? 'Medium' : 'Hard';
      paceLbl.textContent = tier;
      const sec = paceFill && document.getElementById(paceFill.id + '-sec'); if (sec) sec.textContent = elapsedSec.toFixed(1);
    }
    if (_timerSeconds > 0) {
      _timeLeft = Math.max(0,Math.ceil((_deadline-Date.now())/1000));
      const chip = container.querySelector('#drill-timer-chip');
      if (chip) { chip.textContent = `${_timeLeft}s`; chip.classList.toggle('is-urgent',_timeLeft <= 5); }
      if (_timeLeft === 0) submitAnswer(-1);
    }
  }, 100);
  _keyHandler = e => {
    if (version !== _practiceVersion || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,textarea,select,[contenteditable="true"],dialog') || document.querySelector('.palette-backdrop.active')) return;
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); selectQuizAnswer(Number(e.key)-1); }
    else if (e.key === 'Enter' || e.code === 'Space') {
      if (e.target.closest('button') && !e.target.closest('.session-choice,#drill-submit-btn')) return;
      if (!_answered && e.code === 'Space') return;
      e.preventDefault();
      const button = container.querySelector('#drill-submit-btn');
      if (button && !button.disabled) button.click();
    }
  };
  window.addEventListener('keydown',_keyHandler);
}

function selectQuizAnswer(index) {
  if (_answered || !_activeContainer || !_questions[_activeIdx]?.options?.[index]) return;
  _selectedOption = index;
  submitAnswer(index);
}

function submitAnswer(chosenIdx) {
  if (_answered || !_activeContainer || chosenIdx === null || _activeIdx >= _questions.length) return;
  _answered = true;
  clearInterval(_timerHandle);
  const elapsedMs = Math.max(0, performance.now() - _questionStarted);
  const q = _questions[_activeIdx];
  const correctIdx = correctIndex(q);
  const isHint = chosenIdx === -2;
  const isTimeout = chosenIdx === -1;
  const isCorrect = !isHint && !isTimeout && chosenIdx === correctIdx;
  const rating = autoRate(elapsedMs, isCorrect, isHint || isTimeout);
  const result = {question:q,chosenIdx,correctIdx,isCorrect,performance:rating,rating,elapsedMs,chosen:q.options[chosenIdx] || (isTimeout ? 'Time expired' : isHint ? 'Answer revealed' : ''),answer:q.options[correctIdx]};
  _pendingAnswer = result;
  if (result.isCorrect) _score++;
  _results.push(result);
  try { DailyGoal.addProgress(1); } catch { /**/ }

  _activeContainer.querySelector('#drill-options-wrap').outerHTML = choices(q,{selected:chosenIdx >= 0 ? chosenIdx : null,revealed:true,id:'drill-options-wrap'});
  _activeContainer.querySelector('#drill-feedback-slot').innerHTML = feedback({
    id:'drill-feedback-box',
    title: isTimeout ? 'Time’s up. Here’s the answer.' : isHint ? 'Answer revealed.' : isCorrect ? 'That’s correct.' : 'Here’s the correct answer.',
    answer:q.options[correctIdx],
    explanation:q.explanation,
    correct:isCorrect,
    performance:rating,
    elapsedMs,
    isHint,
  });
  _activeContainer.querySelector('#drill-action-note').textContent = 'Press Enter or Space to continue to the next question.';
  const btn = _activeContainer.querySelector('#drill-submit-btn');
  if (btn) {
    btn.className = 'btn btn-primary session-primary-action';
    btn.disabled = false;
    btn.textContent = _activeIdx + 1 >= _questions.length ? 'See results →' : 'Next question →';
  }
  const status = _activeContainer.querySelector('#drill-save-state');
  if (status) {
    status.className = 'session-save-state';
    status.textContent = 'Answer & difficulty placement recorded.';
  }
  const inspector = _activeContainer.querySelector('.session-inspector');
  if (inspector) {
    inspector.outerHTML = sessionPanel({items:_questions,index:_activeIdx,results:_results,kind:'practice',source:scopeLabel()});
  }
  const fill = _activeContainer.querySelector('#session-prog-fill');
  if (fill) {
    fill.style.width = `${Math.round(_results.length/_questions.length*100)}%`;
    fill.parentElement?.setAttribute('aria-valuenow',String(_results.length));
  }
  const lbl = _activeContainer.querySelector('#session-prog-lbl');
  if (lbl) lbl.textContent = `${_results.length} / ${_questions.length}`;

  saveQuizAnswer(_practiceVersion, result);
}

async function saveQuizAnswer(version, resultToSave = null) {
  const result = resultToSave || _pendingAnswer;
  if (!result) return;
  try {
    await API.post('/api/quiz/answer',{session_id:_sessionId,question_id:result.question.id,is_correct:result.isCorrect,performance:result.performance});
    invalidateDueCount();
  } catch {
    // Background save is non-blocking so quiz flow stays instant
  }
}

function renderResultsView(container) {
  const seconds = Math.floor((Date.now()-_sessionStarted)/1000);
  cleanupPractice();
  document.body.classList.add('mode-focused');
  document.body.dataset.sessionKind = 'practice';
  history.replaceState(null,'','#practice');
  container.innerHTML = sessionHeader({title:'Practice complete',completed:_results.length,total:_questions.length,exitId:'session-abort-btn',timer:timeLabel(seconds)}) + completeMarkup({title:'Session Results',total:_questions.length,correct:_score,seconds,rows:_results,mode:'practice'});
  container.onclick = e => { if (e.target.closest('#session-abort-btn')) navigate('practice'); };
}
