/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Practice Hub & Drill Engine (`#/practice`)
   High-Density Exam Suite: Scope Config, Active Drill & Deep Results Review
   ══════════════════════════════════════════════════════════════════ */

import { API, showToast, DailyGoal, Streak, navigate, skel } from '../app.js';

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

let _cfg = {
  scope: 'all',
  scopeId: null,
  count: 10,
  timer: 30,
  diff: ['easy', 'medium', 'hard'],
};

export async function renderPractice(container, options = {}) {
  const subpath = options.subpath;

  if (subpath === 'session') {
    renderActiveSession(container);
    return;
  }

  // Render Practice Hub
  container.innerHTML = `
    <!-- Header -->
    <div class="page-head">
      <div>
        <h1 class="page-head-title">Practice Hub</h1>
        <div class="page-head-desc">Timed active recall exam drills with real-time feedback, comprehension telemetry, and review queue calibration.</div>
      </div>
    </div>

    <!-- 2-Column Hub Layout -->
    <div class="grid-2fr-1fr">
      
      <!-- Left Column: Exam Configuration -->
      <div class="card" style="display:flex;flex-direction:column;gap:18px">
        <span class="card-title">Configure Practice Session</span>

        <!-- Scope Radio Cards -->
        <div class="form-group">
          <label class="form-label">Drill Scope</label>
          <div class="radio-card-grid">
            <div class="radio-card active" data-scope="all">
              <div class="radio-card-title">All Library</div>
              <div class="radio-card-desc">Comprehensive suite</div>
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

        <!-- Difficulty Selection -->
        <div class="form-group">
          <label class="form-label">Difficulty Filter</label>
          <div style="display:flex;gap:16px">
            <label class="chk-label"><input type="checkbox" class="chk-input diff-chk" value="easy" checked /> Easy</label>
            <label class="chk-label"><input type="checkbox" class="chk-input diff-chk" value="medium" checked /> Medium</label>
            <label class="chk-label"><input type="checkbox" class="chk-input diff-chk" value="hard" checked /> Hard</label>
          </div>
        </div>

        <!-- Submit Button -->
        <button class="btn btn-primary btn-full btn-lg" id="quiz-start-btn" style="margin-top:8px">
          <span>Start Practice Drill</span>
        </button>
      </div>

      <!-- Right Column: AI Question Generator & Recent Practice Sessions -->
      <div style="display:flex;flex-direction:column;gap:16px">
        
        <!-- AI Generator Card -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:10px;display:block">AI Question Generator</span>
          <div style="display:flex;flex-direction:column;gap:10px">
            <select id="gen-video-sel" class="form-select" style="font-size:12.5px;height:30px">
              <option value="">Select target lecture…</option>
            </select>
            <div style="display:flex;gap:8px">
              <select id="gen-count-sel" class="form-select" style="font-size:12.5px;height:30px;flex:1">
                <option value="5">5 Qs</option>
                <option value="10" selected>10 Qs</option>
                <option value="20">20 Qs</option>
              </select>
              <button class="btn btn-secondary btn-sm" id="gen-btn" style="flex:1">Generate</button>
            </div>
          </div>
        </div>

        <!-- Recent Sessions History -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:10px;display:block">Session History</span>
          <div id="quiz-recents-list" style="display:flex;flex-direction:column;gap:8px">
            ${skel('100%', 28)}
            ${skel('100%', 28)}
          </div>
        </div>

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
    const genBtn = document.getElementById('gen-btn');
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.textContent = 'Generating…';
    }
    try {
      await API.post('/api/quiz/generate', { video_id: parseInt(videoId, 10), count });
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
    if (btn) { btn.disabled = true; btn.innerHTML = '<span>Calibrating Questions…</span>'; }

    try {
      const scopeParam = _cfg.scope || 'all';
      const scopeIdParam = _cfg.scopeId ? parseInt(_cfg.scopeId, 10) : 0;
      let rawData = null;

      try {
        rawData = await API.get(`/api/quiz/questions?scope=${scopeParam}&scope_id=${scopeIdParam}&limit=${_cfg.count}`);
      } catch {
        rawData = await API.get('/api/review/due?limit=30');
      }

      // Robust array parsing (backend returns array directly or inside .questions)
      const list = Array.isArray(rawData) ? rawData : (rawData?.questions || []);
      _questions = list.slice(0, _cfg.count);

      if (!_questions.length) {
        // If scope had 0, try fetching from due review as ultimate fallback
        const fallback = await API.get('/api/review/due?limit=30').catch(() => ({ questions: [] }));
        const fallbackList = Array.isArray(fallback) ? fallback : (fallback?.questions || []);
        _questions = fallbackList.slice(0, _cfg.count);
      }

      if (!_questions.length) {
        showToast('No questions found in this scope. Ingest a lecture first.', 'warn');
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>Start Practice Drill</span>'; }
        return;
      }

      // Start quiz session with backend
      try {
        const sess = await API.post('/api/quiz/session');
        _sessionId = sess?.session_id || 0;
      } catch {
        _sessionId = 0;
      }

      _activeIdx = 0;
      _score = 0;
      _results = [];
      _timerSeconds = _cfg.timer;
      renderActiveSession(container);
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Start Practice Drill</span>'; }
    }
  });

  // Load Data
  await initHubData();
}

async function initHubData() {
  try {
    const [courses, stats] = await Promise.allSettled([
      API.get('/api/courses'),
      API.get('/api/stats'),
    ]);

    _courses = courses.status === 'fulfilled' ? courses.value : [];
    populateGeneratorSelect();

    const recents = document.getElementById('quiz-recents-list');
    if (recents && stats.status === 'fulfilled') {
      const sessions = (stats.value?.recent_sessions || []).filter(s => (s.answered || 0) > 0);
      if (!sessions.length) {
        recents.innerHTML = `<div class="caption-text">No practice drills recorded yet.</div>`;
      } else {
        recents.innerHTML = sessions.slice(0, 4).map(s => {
          const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
          const chipCls = acc >= 80 ? 'chip-ok' : acc >= 60 ? 'chip-warn' : 'chip-danger';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12.5px">
              <span class="mono caption-text" style="color:var(--txt-1)">${s.date}</span>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="chip ${chipCls}" style="font-size:11px">${acc}%</span>
                <span class="caption-text mono">${s.correct}/${s.answered}</span>
              </div>
            </div>`;
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
    _cfg.scopeId = sel.value;
  } else if (_cfg.scope === 'video') {
    wrap.style.display = 'block';
    const opts = [];
    _courses.forEach(c => {
      (c.videos || []).forEach(v => opts.push(`<option value="${v.id}">${v.title}</option>`));
    });
    sel.innerHTML = opts.join('') || '<option>No lectures</option>';
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

// ── Active Drill Session Mode ────────────────────────────────────
function renderActiveSession(container) {
  document.body.classList.add('mode-focused');

  if (_activeIdx >= _questions.length) {
    renderResultsView(container);
    return;
  }

  const q = _questions[_activeIdx];
  _selectedOption = null;
  _timeLeft = _timerSeconds;

  const optionsList = Array.isArray(q.options) && q.options.length > 0 ? q.options : [
    'Computes scaled dot-product attention across key-value pairs',
    'Applies recurrent sequential state updates across tokens',
    'Convolves spatial features using fixed sliding kernels',
    'Normalizes batch activations across sample instances',
  ];

  const questionTitle = q.question || q.concept || 'Select the correct conceptual definition below:';

  // Build Queue Dot Matrix HTML
  const dotMatrixHtml = _questions.map((_, i) => {
    let stateCls = '';
    if (i < _activeIdx) {
      stateCls = _results[i]?.isCorrect ? 'done-ok' : 'done-err';
    } else if (i === _activeIdx) {
      stateCls = 'active';
    }
    return `<div class="queue-dot ${stateCls}" title="Question #${i + 1}"></div>`;
  }).join('');

  container.innerHTML = `
    <!-- Session Bar -->
    <div id="focused-session-bar">
      <div class="session-bar-left">
        <button class="btn btn-ghost btn-sm" id="session-abort-btn">
          <svg style="width:14px;height:14px"><use href="#i-x"/></svg>
          <span class="session-exit-label">Exit Drill (<span class="kbd" style="font-size:10px">Esc</span>)</span>
        </button>
        <span class="caption-text session-sep" style="color:var(--txt-3)">|</span>
        <div class="session-src-wrap">
          <div class="icon-tile accent" style="width:24px;height:24px">
            <svg style="width:13px;height:13px"><use href="#i-brain-circuit"/></svg>
          </div>
          <span style="font-size:13.5px;font-weight:600;color:var(--txt-1)" id="session-src-title">Practice Drill</span>
        </div>
      </div>

      <div class="session-bar-center">
        <div class="progress-track" style="height:6px">
          <div class="progress-fill" style="width:${Math.round(((_activeIdx + 1) / _questions.length) * 100)}%"></div>
        </div>
        <span class="caption-text mono" id="session-prog-lbl" style="white-space:nowrap;font-weight:500">${_activeIdx + 1} / ${_questions.length}</span>
      </div>

      <div class="session-bar-right">
        ${_timerSeconds > 0 ? `<div class="chip chip-warn mono" id="drill-timer-chip" style="font-size:13px">${_timeLeft}s</div>` : ''}
      </div>
    </div>

    <!-- Main 2-Column Drill Workspace -->
    <div class="review-scene-wrap">
      <div class="study-cockpit-grid">
        
        <!-- Left: Question & Options Card -->
        <div class="card" style="padding:34px 32px;min-height:420px;display:flex;flex-direction:column;justify-content:space-between">
          
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="chip chip-neutral mono" style="font-size:11.5px">Exam Drill</span>
                <span class="chip chip-accent mono" style="font-size:11.5px">Question ${_activeIdx + 1} of ${_questions.length}</span>
              </div>
              <span class="caption-text mono" style="font-size:12.5px">Current Score: <strong style="color:var(--acc-400)">${_score}</strong></span>
            </div>

            <h2 style="font-size:22px;font-weight:600;color:var(--txt-1);line-height:1.45;margin-bottom:28px">
              ${questionTitle}
            </h2>

            <div class="quiz-options-list" id="drill-options-wrap" style="margin:0 0 18px 0">
              ${optionsList.map((opt, i) => `
                <div class="quiz-opt-row" data-idx="${i}" data-val="${encodeURIComponent(opt)}">
                  <span class="quiz-opt-key">${i + 1}</span>
                  <span style="line-height:1.45;flex:1">${opt}</span>
                </div>
              `).join('')}
            </div>

            <!-- Submit / Next Controls -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px">
              <span class="caption-text" style="font-size:13px">Keys <span class="kbd">1–4</span> select · <span class="kbd">Enter</span> confirms</span>
              <button class="btn btn-primary btn-sm" id="drill-submit-btn" disabled>
                <span>Confirm Answer</span>
              </button>
            </div>

            <!-- Explanation Feedback Box -->
            <div id="drill-feedback-box" class="card card-xs" style="display:none;margin-top:20px;background:var(--bg-2);padding:16px 18px">
              <div style="font-weight:600;font-size:13.5px;margin-bottom:6px" id="drill-feedback-status">Explanation</div>
              <div class="caption-text body-text" id="drill-feedback-text" style="line-height:1.55;color:var(--txt-1);font-size:13.5px"></div>
            </div>
          </div>

        </div>

        <!-- Right: Live Session Rail -->
        <div class="study-telemetry-rail">
          <div class="card card-sm">
            <span class="card-title" style="margin-bottom:14px;display:block">Drill Performance</span>
            <div class="stat-grid-2" style="margin-bottom:16px">
              <div style="background:var(--bg-2);padding:12px;border-radius:var(--r-sm)">
                <div class="caption-text">Score</div>
                <div class="mono" style="font-size:22px;font-weight:600;color:var(--acc-400)">${_score}</div>
              </div>
              <div style="background:var(--bg-2);padding:12px;border-radius:var(--r-sm)">
                <div class="caption-text">Accuracy</div>
                <div class="mono" style="font-size:22px;font-weight:600;color:${_activeIdx > 0 && Math.round((_score / _activeIdx) * 100) >= 70 ? 'var(--ok-400)' : 'var(--warn-400)'}">${_activeIdx > 0 ? Math.round((_score / _activeIdx) * 100) : 100}%</div>
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:9px;font-size:13px">
              <div style="display:flex;justify-content:space-between"><span style="color:var(--txt-3)">Scope Target</span><span class="mono" style="color:var(--txt-1)">${_cfg.scope}</span></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--txt-3)">Remaining</span><span class="mono" style="color:var(--txt-1)">${_questions.length - _activeIdx} Qs</span></div>
            </div>
          </div>

          <!-- Question Progress Dot Matrix -->
          <div class="card card-sm">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span class="card-title">Question Map</span>
              <span class="caption-text mono">${_activeIdx + 1} of ${_questions.length}</span>
            </div>
            <div class="queue-matrix-dots">
              ${dotMatrixHtml}
            </div>
          </div>

          <div class="card card-sm">
            <span class="card-title" style="margin-bottom:12px;display:block">Keyboard Controls</span>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px">
              <div style="display:flex;justify-content:space-between"><span>Choose Option</span><span class="kbd">1–4</span></div>
              <div style="display:flex;justify-content:space-between"><span>Confirm / Next</span><span class="kbd">Enter</span></div>
              <div style="display:flex;justify-content:space-between"><span>Exit Drill</span><span class="kbd">Esc</span></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Timer Tick
  if (_timerSeconds > 0) {
    if (_timerHandle) clearInterval(_timerHandle);
    _timerHandle = setInterval(() => {
      _timeLeft--;
      const chip = document.getElementById('drill-timer-chip');
      if (chip) chip.textContent = `${_timeLeft}s`;
      if (_timeLeft <= 0) {
        clearInterval(_timerHandle);
        submitAnswer(-1); // Timed out
      }
    }, 1000);
  }

  // Abort listener
  document.getElementById('session-abort-btn')?.addEventListener('click', () => {
    if (_timerHandle) clearInterval(_timerHandle);
    document.body.classList.remove('mode-focused');
    navigate('practice');
  });

  // Option selection
  const rows = container.querySelectorAll('.quiz-opt-row');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      rows.forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      _selectedOption = parseInt(row.dataset.idx, 10);
      const submitBtn = document.getElementById('drill-submit-btn');
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  // Keyboard shortcut listener for active drill (1-4, Enter)
  const keyHandler = (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (['1', '2', '3', '4'].includes(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      const targetRow = container.querySelector(`.quiz-opt-row[data-idx="${idx}"]`);
      if (targetRow && !targetRow.classList.contains('disabled')) {
        targetRow.click();
      }
    } else if (e.key === 'Enter') {
      const submitBtn = document.getElementById('drill-submit-btn');
      if (submitBtn && !submitBtn.disabled) submitBtn.click();
    }
  };
  window.addEventListener('keydown', keyHandler, { once: true });

  // Submit Answer
  document.getElementById('drill-submit-btn')?.addEventListener('click', () => {
    submitAnswer(_selectedOption);
  });
}

function submitAnswer(chosenIdx) {
  if (_timerHandle) clearInterval(_timerHandle);

  const q = _questions[_activeIdx];
  const correctVal = (q.answer || '').trim();
  const optionsList = Array.isArray(q.options) && q.options.length > 0 ? q.options : [];
  
  // Find correct index by comparing value or using correct_idx
  let correctIdx = q.correct_idx ?? 0;
  if (optionsList.length > 0 && correctVal) {
    const found = optionsList.findIndex(opt => opt.trim().toLowerCase() === correctVal.toLowerCase());
    if (found !== -1) correctIdx = found;
  }

  const isCorrect = chosenIdx === correctIdx;

  if (isCorrect) _score++;
  _results.push({ question: q, chosenIdx, correctIdx, isCorrect });

  DailyGoal.addProgress(1);
  Streak.recordActivity();

  // Record drill attempt to backend
  if (q.id) {
    API.post('/api/quiz/answer', {
      session_id: _sessionId || 0,
      question_id: q.id,
      is_correct: isCorrect,
      performance: isCorrect ? 'good' : 'hard',
    }).catch(() => {});
  }

  // Highlight rows
  const rows = document.querySelectorAll('.quiz-opt-row');
  rows.forEach((row, i) => {
    row.classList.add('disabled');
    if (i === correctIdx) row.classList.add('correct');
    else if (i === chosenIdx && !isCorrect) row.classList.add('wrong');
  });

  // Show Feedback Box
  const feedBox = document.getElementById('drill-feedback-box');
  const feedStatus = document.getElementById('drill-feedback-status');
  const feedText = document.getElementById('drill-feedback-text');
  if (feedBox && feedStatus && feedText) {
    feedStatus.textContent = isCorrect ? '✓ Correct Recall' : '✗ Incorrect Concept';
    feedStatus.style.color = isCorrect ? 'var(--ok-400)' : 'var(--danger-400)';
    feedText.textContent = q.explanation || q.answer || 'Answer aligned with core definition.';
    feedBox.style.display = 'block';
  }

  const submitBtn = document.getElementById('drill-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Next Question →</span>`;
    submitBtn.onclick = () => {
      _activeIdx++;
      renderActiveSession(document.getElementById('page-content'));
    };
  }
}

// ── Results Review View ──────────────────────────────────────────
function renderResultsView(container) {
  document.body.classList.remove('mode-focused');
  const pct = _questions.length > 0 ? Math.round((_score / _questions.length) * 100) : 0;

  container.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-head-title">Session Results</h1>
        <div class="page-head-desc">Practice drill performance breakdown and telemetry.</div>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-secondary btn-sm" onclick="window.navigate('practice')">New Practice</button>
        <button class="btn btn-primary btn-sm" onclick="window.navigate('today')">Done</button>
      </div>
    </div>

    <!-- Summary KPI Card -->
    <div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;padding:24px">
      <div>
        <div class="caption-text">Comprehension Score</div>
        <div class="mono" style="font-size:32px;font-weight:600;color:${pct >= 70 ? 'var(--ok-400)' : 'var(--warn-400)'}">${pct}%</div>
        <div class="caption-text mono" style="margin-top:2px">${_score} of ${_questions.length} correct</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary btn-sm" onclick="window.navigate('review?src=due')">Push to Due Queue</button>
      </div>
    </div>

    <!-- Question-by-Question Accordion -->
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <span class="card-title">Question Breakdown</span>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${_results.map((r, i) => `
          <div class="card card-xs" style="background:var(--bg-2);padding:12px 14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span class="mono caption-text">#${i + 1}</span>
              <span class="chip ${r.isCorrect ? 'chip-ok' : 'chip-danger'}" style="font-size:10.5px">${r.isCorrect ? 'Correct' : 'Missed'}</span>
            </div>
            <div style="font-weight:600;font-size:13.5px;color:var(--txt-1);margin-bottom:4px">${r.question.question || r.question.concept}</div>
            <div class="caption-text" style="line-height:1.4">${r.question.explanation || r.question.answer || 'Reviewed concept.'}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
