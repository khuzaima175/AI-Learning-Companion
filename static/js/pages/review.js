/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Unified Review & Spaced Repetition (`#/review?src=...`)
   High-Density Study Cockpit: Interactive Quiz Options, Live Telemetry & Anki SRS
   ══════════════════════════════════════════════════════════════════ */

import { API, showToast, DailyGoal, Streak, invalidateDueCount, navigate } from '../app.js';

let _items = [];
let _currentIndex = 0;
let _isFlipped = false;
let _selectedOption = null;
let _sourceLabel = 'Due Queue';
let _historyStack = [];
let _sessionResults = []; // stores boolean array for dot matrix
let _startTime = Date.now();
let _timerInterval = null;
let _keyListener = null;

export async function renderReview(container, options = {}) {
  const src = options.src || 'due';
  _items = [];
  _currentIndex = 0;
  _isFlipped = false;
  _selectedOption = null;
  _historyStack = [];
  _sessionResults = [];
  _startTime = Date.now();

  if (_timerInterval) clearInterval(_timerInterval);
  if (_keyListener) document.removeEventListener('keydown', _keyListener);

  container.innerHTML = `
    <!-- Distraction-Free Session Bar (52px) -->
    <div id="focused-session-bar">
      <div class="session-bar-left">
        <button class="btn btn-ghost btn-sm" id="session-exit-btn" title="Exit Review (ESC)">
          <svg style="width:14px;height:14px"><use href="#i-x"/></svg>
          <span class="session-exit-label">Exit (<span class="kbd" style="font-size:10px">Esc</span>)</span>
        </button>
        <span class="caption-text session-sep" style="color:var(--txt-3)">|</span>
        <div class="session-src-wrap">
          <div class="icon-tile accent" style="width:24px;height:24px">
            <svg style="width:13px;height:13px"><use href="#i-rotate-cw"/></svg>
          </div>
          <span style="font-size:13.5px;font-weight:600;color:var(--txt-1)" id="session-src-title">Loading Queue…</span>
        </div>
      </div>

      <div class="session-bar-center">
        <div class="progress-track" style="height:6px">
          <div class="progress-fill" id="session-prog-fill" style="width:0%"></div>
        </div>
        <span class="caption-text mono" id="session-prog-lbl" style="white-space:nowrap;font-weight:500">0 / 0</span>
      </div>

      <div class="session-bar-right">
        <div class="chip chip-warn mono" id="session-streak-chip">
          <svg style="width:12px;height:12px"><use href="#i-flame"/></svg>
          <span class="session-streak-text">${Streak.get().count}d streak</span>
        </div>
        <span class="caption-text mono" id="session-timer-lbl" style="font-size:13px">00:00</span>
        <button class="btn btn-ghost btn-icon btn-sm" id="session-help-btn" title="Shortcuts (?)">
          <svg style="width:14px;height:14px"><use href="#i-help-circle"/></svg>
        </button>
      </div>
    </div>

    <!-- Main Study Cockpit Area -->
    <div id="review-main-area" class="review-scene-wrap">
      <div class="card" style="padding:60px 24px;text-align:center;color:var(--txt-3)">
        Preparing review workspace…
      </div>
    </div>
  `;

  // Start Session Timer
  _timerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - _startTime) / 1000);
    const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const s = String(elapsedSec % 60).padStart(2, '0');
    const timerLbl = document.getElementById('session-timer-lbl');
    if (timerLbl) timerLbl.textContent = `${m}:${s}`;
  }, 1000);

  // Exit button handler
  document.getElementById('session-exit-btn')?.addEventListener('click', () => {
    navigate('today');
  });

  // Shortcuts button handler
  document.getElementById('session-help-btn')?.addEventListener('click', () => {
    document.getElementById('shortcuts-backdrop')?.classList.add('active');
  });

  // Load Data by Source
  await loadReviewSource(src);
  bindKeyboard();
}

async function loadReviewSource(src) {
  const srcTitle = document.getElementById('session-src-title');

  try {
    if (src === 'due') {
      _sourceLabel = 'Daily SRS Review';
      if (srcTitle) srcTitle.textContent = _sourceLabel;
      const data = await API.get('/api/review/due?limit=50');
      _items = Array.isArray(data) ? data : (data?.questions || []);
    } else if (src.startsWith('deck:')) {
      const vid = src.split(':')[1];
      const video = await API.get(`/api/videos/${vid}`);
      _sourceLabel = video.title || 'Lecture Deck';
      if (srcTitle) srcTitle.textContent = _sourceLabel;
      _items = (video.flashcards || video.key_concepts || []).map(c => ({
        id: c.id,
        concept: c.concept || c.front || c.title || (typeof c === 'string' ? c : 'Concept'),
        definition: c.definition || c.back || c.description || (typeof c === 'string' ? 'Core principle.' : ''),
        lecture_title: video.title,
      }));
    } else if (src.startsWith('course:')) {
      const cid = src.split(':')[1];
      const course = await API.get(`/api/courses/${cid}`);
      _sourceLabel = course.name || 'Course Deck';
      if (srcTitle) srcTitle.textContent = _sourceLabel;
      const cards = [];
      (course.videos || []).forEach(v => {
        (v.flashcards || v.key_concepts || []).forEach(c => cards.push({
          id: c.id,
          concept: c.concept || c.front || c.title || (typeof c === 'string' ? c : 'Concept'),
          definition: c.definition || c.back || c.description || '',
          lecture_title: v.title,
        }));
      });
      _items = cards;
    }

    if (!_items.length) {
      renderEmptyState();
    } else {
      renderCurrentCard();
    }
  } catch (err) {
    showToast(err.message, 'error');
    renderEmptyState();
  }
}

function renderEmptyState() {
  const area = document.getElementById('review-main-area');
  if (!area) return;

  area.innerHTML = `
    <div class="card empty-state" style="margin:60px auto;max-width:560px;text-align:center;padding:48px 32px">
      <div class="icon-tile ok" style="width:52px;height:52px;margin:0 auto 18px">
        <svg style="width:26px;height:26px"><use href="#i-check"/></svg>
      </div>
      <div class="empty-state-title" style="font-size:20px">Queue is completely clear!</div>
      <div class="empty-state-desc" style="max-width:420px;margin:10px auto 24px;font-size:14px">No review questions currently due in this queue. You're completely on top of your spaced repetition schedule.</div>
      <div style="display:flex;justify-content:center;gap:12px">
        <button class="btn btn-secondary btn-sm" onclick="window.navigate('practice')">
          <span>Launch Practice Hub</span>
        </button>
        <button class="btn btn-primary btn-sm" onclick="window.navigate('today')">
          <span>Return to Today</span>
        </button>
      </div>
    </div>
  `;
}

function renderCurrentCard() {
  const area = document.getElementById('review-main-area');
  const progLbl = document.getElementById('session-prog-lbl');
  const progFill = document.getElementById('session-prog-fill');
  if (!area) return;

  if (_currentIndex >= _items.length) {
    renderEndScreen();
    return;
  }

  const card = _items[_currentIndex];
  _isFlipped = false;
  _selectedOption = null;

  if (progLbl) progLbl.textContent = `${_currentIndex + 1} / ${_items.length}`;
  if (progFill) progFill.style.width = `${Math.round(((_currentIndex + 1) / _items.length) * 100)}%`;

  const hasOptions = Array.isArray(card.options) && card.options.length > 0;
  const questionText = card.question || card.concept || card.front || 'Active Recall Question';
  const correctAnswer = card.answer || card.definition || card.back || '';
  const goal = DailyGoal.get();
  
  const correctCount = _sessionResults.filter(Boolean).length;
  const attemptedCount = _sessionResults.length;
  const sessionAcc = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 100;

  // Build Queue Dot Matrix HTML
  const dotMatrixHtml = _items.map((_, i) => {
    let stateCls = '';
    if (i < _currentIndex) {
      stateCls = _sessionResults[i] ? 'done-ok' : 'done-err';
    } else if (i === _currentIndex) {
      stateCls = 'active';
    }
    return `<div class="queue-dot ${stateCls}" title="Card #${i + 1}"></div>`;
  }).join('');

  // Render 2-Column Study Cockpit Grid
  area.innerHTML = `
    <div class="study-cockpit-grid">
      
      <!-- Left Column: Active Study Question Stage -->
      <div style="display:flex;flex-direction:column;gap:18px">
        
        <div class="card" style="padding:34px 32px;min-height:420px;display:flex;flex-direction:column;justify-content:space-between">
          
          <div>
            <!-- Card Header Meta -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="chip chip-neutral mono" style="font-size:11.5px">${_sourceLabel}</span>
                <span class="chip chip-accent mono" style="font-size:11.5px">Question ${_currentIndex + 1}</span>
              </div>
              <span class="caption-text mono" style="font-size:12.5px">${_items.length - _currentIndex} cards remaining</span>
            </div>

            <!-- Question Content -->
            <h2 style="font-size:22px;font-weight:600;color:var(--txt-1);line-height:1.45;margin-bottom:28px">
              ${questionText}
            </h2>

            ${hasOptions ? `
              <!-- Multiple Choice Interactive Options -->
              <div class="quiz-options-list" id="review-options-wrap" style="margin:0 0 18px 0">
                ${card.options.map((opt, i) => `
                  <div class="quiz-opt-row" data-idx="${i}" data-val="${encodeURIComponent(opt)}">
                    <span class="quiz-opt-key">${i + 1}</span>
                    <span style="line-height:1.45;flex:1">${opt}</span>
                  </div>
                `).join('')}
              </div>

              <div id="review-reveal-hint" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
                <span class="caption-text" style="font-size:13px">Press keys <span class="kbd">1–4</span> to choose, or click directly</span>
                <button class="btn btn-ghost btn-sm" id="review-direct-reveal-btn" style="font-size:12px">
                  <span>Reveal Answer (<span class="kbd">Space</span>)</span>
                </button>
              </div>
            ` : `
              <!-- 3D Flip Card for Concept Decks -->
              <div class="flip-scene" id="card-flip-target">
                <div class="flip-card" id="active-flip-card">
                  <div class="card-face">
                    <div style="text-align:center;padding:36px 16px;margin:auto 0">
                      <div style="font-size:22px;font-weight:600;color:var(--txt-1)">${questionText}</div>
                    </div>
                    <div style="text-align:center">
                      <span class="caption-text" style="font-size:13px">Click or press <span class="kbd">Space</span> to flip card</span>
                    </div>
                  </div>
                  <div class="card-face back">
                    <div style="padding:16px 8px">
                      <div class="caption-text mono" style="color:var(--acc-400);margin-bottom:8px">Definition &amp; Formulation</div>
                      <div class="card-definition-box body-text" style="color:var(--txt-1);font-size:15px;line-height:1.6">${correctAnswer}</div>
                    </div>
                  </div>
                </div>
              </div>
            `}
          </div>

          <!-- Rating Controls (Appears once answered / flipped) -->
          <div id="review-controls-area" style="display:none;flex-direction:column;gap:14px;margin-top:24px;border-top:1px solid var(--line-1);padding-top:20px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="caption-text" style="font-weight:600;color:var(--txt-1);font-size:13px">Rate Recall Difficulty for Interval Scheduling:</span>
              <span class="caption-text mono" style="font-size:12px">Keys: 1, 2, 3, 4</span>
            </div>

            <div class="anki-rating-row">
              <button class="anki-btn again" data-rating="again">
                <span class="anki-btn-title">Again <span class="kbd" style="font-size:9px">1</span></span>
                <span class="anki-btn-interval">&lt; 10m</span>
              </button>
              <button class="anki-btn hard" data-rating="hard">
                <span class="anki-btn-title">Hard <span class="kbd" style="font-size:9px">2</span></span>
                <span class="anki-btn-interval">1d</span>
              </button>
              <button class="anki-btn good" data-rating="good">
                <span class="anki-btn-title">Good <span class="kbd" style="font-size:9px">3</span></span>
                <span class="anki-btn-interval">3d</span>
              </button>
              <button class="anki-btn easy" data-rating="easy">
                <span class="anki-btn-title">Easy <span class="kbd" style="font-size:9px">4</span></span>
                <span class="anki-btn-interval">7d</span>
              </button>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
              <button class="btn btn-ghost btn-sm" id="review-undo-btn" ${_historyStack.length === 0 ? 'disabled' : ''}>
                <span>Undo (<span class="kbd" style="font-size:10px">U</span>)</span>
              </button>
              <button class="btn btn-primary btn-sm" id="review-next-btn">
                <span>Next (<span class="kbd" style="font-size:10px">Enter</span>) →</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      <!-- Right Column: Study Telemetry Rail (340px) -->
      <div class="study-telemetry-rail">
        
        <!-- Live Session Stats -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:14px;display:block">Session Live Telemetry</span>
          
          <div class="stat-grid-2" style="margin-bottom:16px">
            <div style="background:var(--bg-2);padding:12px;border-radius:var(--r-sm)">
              <div class="caption-text">Reviewed</div>
              <div class="mono" style="font-size:22px;font-weight:600;color:var(--txt-1)">${_currentIndex}</div>
            </div>
            <div style="background:var(--bg-2);padding:12px;border-radius:var(--r-sm)">
              <div class="caption-text">Accuracy</div>
              <div class="mono" style="font-size:22px;font-weight:600;color:${sessionAcc >= 75 ? 'var(--ok-400)' : 'var(--warn-400)'}">${sessionAcc}%</div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:9px;font-size:13px">
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--txt-3)">Queue Total</span>
              <span class="mono" style="color:var(--txt-1)">${_items.length} items</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--txt-3)">Correct Recall</span>
              <span class="mono" style="color:var(--ok-400)">${correctCount}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--txt-3)">Review Again</span>
              <span class="mono" style="color:var(--danger-400)">${attemptedCount - correctCount}</span>
            </div>
          </div>
        </div>

        <!-- Session Queue Progress Map (Dot Matrix) -->
        <div class="card card-sm">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="card-title">Queue Map</span>
            <span class="caption-text mono">${_currentIndex + 1} of ${_items.length}</span>
          </div>
          <div class="queue-matrix-dots">
            ${dotMatrixHtml}
          </div>
        </div>

        <!-- Daily Target Goal Card -->
        <div class="card card-sm">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span class="card-title">Daily Goal Target</span>
            <span class="caption-text mono">${goal.progress} / ${goal.target} cards</span>
          </div>
          <div class="progress-track" style="height:6px;margin-bottom:8px">
            <div class="progress-fill" style="width:${Math.min(100, Math.round((goal.progress / goal.target) * 100))}%"></div>
          </div>
          <div class="caption-text" style="font-size:12px">
            ${goal.progress >= goal.target ? '✓ Daily study target completed!' : `${goal.target - goal.progress} more cards to hit daily target.`}
          </div>
        </div>

        <!-- Keyboard Guide HUD -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:12px;display:block">Key Controls</span>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px">
            <div style="display:flex;justify-content:space-between"><span>Select Option</span><span class="kbd">1–4</span></div>
            <div style="display:flex;justify-content:space-between"><span>Reveal Answer</span><span class="kbd">Space</span></div>
            <div style="display:flex;justify-content:space-between"><span>Rate Recall</span><span class="kbd">1–4</span></div>
            <div style="display:flex;justify-content:space-between"><span>Undo Review</span><span class="kbd">U</span></div>
            <div style="display:flex;justify-content:space-between"><span>Exit Session</span><span class="kbd">Esc</span></div>
          </div>
        </div>

      </div>

    </div>
  `;

  // Bind Option Selection (for Multiple Choice)
  const optRows = area.querySelectorAll('.quiz-opt-row');
  optRows.forEach(row => {
    row.addEventListener('click', () => {
      if (_isFlipped) return;
      const chosenVal = decodeURIComponent(row.dataset.val);
      revealQuizAnswer(chosenVal, row);
    });
  });

  document.getElementById('review-direct-reveal-btn')?.addEventListener('click', () => {
    revealQuizAnswer(null, null);
  });

  // Bind 3D Flip (for Concept Decks)
  const flipTarget = document.getElementById('card-flip-target');
  flipTarget?.addEventListener('click', toggleFlip);

  // Bind Anki Rating Buttons
  area.querySelectorAll('.anki-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gradeCard(btn.dataset.rating);
    });
  });

  // Bind Undo Button
  document.getElementById('review-undo-btn')?.addEventListener('click', undoLastGrade);

  // Bind Next Button
  document.getElementById('review-next-btn')?.addEventListener('click', () => {
    gradeCard('good');
  });
}

function revealQuizAnswer(chosenVal, selectedEl) {
  _isFlipped = true;
  const card = _items[_currentIndex];
  const correctVal = (card.answer || card.definition || '').trim();
  const rows = document.querySelectorAll('.quiz-opt-row');

  let isMatch = false;

  rows.forEach(row => {
    row.classList.add('disabled');
    const rowVal = decodeURIComponent(row.dataset.val).trim();
    if (rowVal.toLowerCase() === correctVal.toLowerCase()) {
      row.classList.add('correct');
      if (chosenVal && chosenVal.trim().toLowerCase() === rowVal.toLowerCase()) {
        isMatch = true;
      }
    } else if (chosenVal && rowVal.toLowerCase() === chosenVal.trim().toLowerCase()) {
      row.classList.add('wrong');
    }
  });

  _sessionResults.push(isMatch);

  const hint = document.getElementById('review-reveal-hint');
  if (hint) hint.style.display = 'none';

  const controls = document.getElementById('review-controls-area');
  if (controls) controls.style.display = 'flex';
}

function toggleFlip() {
  const flipCard = document.getElementById('active-flip-card');
  const controls = document.getElementById('review-controls-area');
  if (!flipCard) return;

  _isFlipped = !_isFlipped;
  flipCard.classList.toggle('flipped', _isFlipped);
  if (controls) {
    controls.style.display = _isFlipped ? 'flex' : 'none';
  }
}

async function gradeCard(rating) {
  const card = _items[_currentIndex];
  _historyStack.push({ index: _currentIndex, card, rating, sessionResults: [..._sessionResults] });

  // Record daily study progress & streak
  DailyGoal.addProgress(1);
  Streak.recordActivity();

  // Send backend update to update_srs_level
  if (card.id) {
    try {
      const performanceMap = {
        'again': 'hard',
        'hard': 'hard',
        'good': 'good',
        'easy': 'easy',
      };
      await API.post('/api/review/answer', {
        question_id: card.id,
        performance: performanceMap[rating] || 'good',
        is_correct: rating === 'good' || rating === 'easy',
        session_id: 0,
      });
      invalidateDueCount();
    } catch { /**/ }
  }

  _currentIndex++;
  renderCurrentCard();
}

function undoLastGrade() {
  if (!_historyStack.length) return;
  const last = _historyStack.pop();
  _currentIndex = last.index;
  _sessionResults = last.sessionResults || [];
  renderCurrentCard();
  showToast('Reverted previous card', 'info');
}

function renderEndScreen() {
  const area = document.getElementById('review-main-area');
  if (!area) return;

  const elapsedSec = Math.floor((Date.now() - _startTime) / 1000);
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  const correctCount = _sessionResults.filter(Boolean).length;
  const totalCount = _sessionResults.length;
  const acc = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 100;

  area.innerHTML = `
    <div class="card" style="padding:48px 36px;text-align:center;max-width:580px;margin:40px auto">
      <div class="icon-tile ok" style="width:56px;height:56px;margin:0 auto 20px">
        <svg style="width:28px;height:28px"><use href="#i-check"/></svg>
      </div>

      <h2 style="font-size:24px;font-weight:600;color:var(--txt-1);margin-bottom:8px">Session Complete!</h2>
      <p class="body-text" style="margin-bottom:32px;font-size:14.5px">All items in this review queue have been calibrated with spaced repetition intervals.</p>

      <div class="stat-grid-3" style="margin-bottom:32px">
        <div class="card card-xs" style="background:var(--bg-2);padding:16px">
          <div class="caption-text">Reviewed</div>
          <div class="mono" style="font-size:24px;font-weight:600;color:var(--txt-1)">${_items.length}</div>
        </div>
        <div class="card card-xs" style="background:var(--bg-2);padding:16px">
          <div class="caption-text">Accuracy</div>
          <div class="mono" style="font-size:24px;font-weight:600;color:${acc >= 75 ? 'var(--ok-400)' : 'var(--warn-400)'}">${acc}%</div>
        </div>
        <div class="card card-xs" style="background:var(--bg-2);padding:16px">
          <div class="caption-text">Duration</div>
          <div class="mono" style="font-size:24px;font-weight:600;color:var(--acc-400)">${m}m ${s}s</div>
        </div>
      </div>

      <div style="display:flex;justify-content:center;gap:14px">
        <button class="btn btn-secondary btn-sm" onclick="window.navigate('practice')">
          <span>Practice Hub</span>
        </button>
        <button class="btn btn-primary btn-sm" onclick="window.navigate('today')">
          <span>Return to Today</span>
        </button>
      </div>
    </div>
  `;
}

function bindKeyboard() {
  _keyListener = (e) => {
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (isTyping) return;

    const card = _items[_currentIndex];
    const hasOptions = card && Array.isArray(card.options) && card.options.length > 0;

    if (e.code === 'Space') {
      e.preventDefault();
      if (hasOptions) {
        if (!_isFlipped) revealQuizAnswer(null, null);
      } else {
        toggleFlip();
      }
      return;
    }

    if (!_isFlipped && hasOptions) {
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const row = document.querySelector(`.quiz-opt-row[data-idx="${idx}"]`);
        if (row) {
          const val = decodeURIComponent(row.dataset.val);
          revealQuizAnswer(val, row);
        }
      }
      return;
    }

    if (_isFlipped) {
      if (e.key === '1') gradeCard('again');
      if (e.key === '2') gradeCard('hard');
      if (e.key === '3') gradeCard('good');
      if (e.key === '4') gradeCard('easy');
      if (e.key === 'Enter') gradeCard('good');
    }

    if (e.key.toLowerCase() === 'u') {
      undoLastGrade();
    }
  };

  document.addEventListener('keydown', _keyListener);
}
