import { API, DailyGoal, invalidateDueCount, navigate, showToast, skel } from '../app.js';
import { html, correctIndex, autoRate, RATING_META, paceBar, timeLabel, sessionHeader, choices, sessionPanel, feedback, completeMarkup } from '../session-ui.js';

let session = null;
let clock = null;
let paceClock = null;
let keyboard = null;

export function cleanupReview() {
  clearInterval(clock);
  clearInterval(paceClock);
  if (keyboard) document.removeEventListener('keydown', keyboard);
  session = clock = paceClock = keyboard = null;
}

function isFlashcardSource(src = '') {
  return src === 'flashcards' || src.startsWith('deck:') || src.startsWith('course:');
}

export async function renderReview(container, { src = 'due' } = {}) {
  cleanupReview();
  const flashcardMode = isFlashcardSource(src);
  if (flashcardMode) {
    document.body.classList.add('mode-focused');
  } else {
    document.body.classList.remove('mode-focused');
  }
  document.body.dataset.sessionKind = flashcardMode ? 'flashcards' : 'review';

  const current = session = {
    container,
    src,
    flashcardMode,
    startedQuiz: false,
    courses: [],
    selectedCourseId: '',
    selectedVideoId: '',
    items: [],
    seen: new Set([0]),
    results: [],
    index: 0,
    selected: null,
    revealed: false,
    answered: false,
    saving: false,
    saveError: '',
    pendingAnswer: null,
    sessionId: null,
    sessionPromise: null,
    title: flashcardMode ? 'Flashcards' : 'Daily review',
    started: Date.now(),
    questionStarted: 0,
    totalDue: 0,
    recorded: false,
  };

  if (flashcardMode) {
    container.innerHTML = sessionHeader({
      title: 'Preparing flashcards',
      completed: 0,
      total: 0,
      exitId: 'session-exit-btn',
      timer: '00:00',
    }) + `<main id="review-main-area" class="session-workspace"><div class="session-loading" role="status"><span class="session-kicker">Loading flashcard deck</span>${skel('60%', 24)}${skel('100%', 95)}${skel('100%', 95)}</div></main>`;
  } else {
    container.innerHTML = `
      <div class="page-head">
        <div>
          <div class="chapter-tag"><span>02</span>Spaced repetition queue</div>
          <h1 class="page-head-title">Daily review.</h1>
          <p class="page-head-desc">Active recall with automatic speed-based difficulty placement.</p>
        </div>
      </div>
      <div class="session-loading" role="status"><span class="session-kicker">Loading your review queue</span>${skel('55%', 24)}${skel('100%', 90)}</div>`;
  }
  container.onclick = onClick;
  container.onchange = onChange;

  try {
    if (flashcardMode) {
      await loadFlashcardSource(current, src);
      if (session !== current) return;
      if (!current.items.length) {
        renderState(false);
        return;
      }
      current.started = Date.now();
      renderFlashcardView();
      clock = setInterval(() => {
        const label = current.container.querySelector('#session-timer-lbl');
        if (label) label.textContent = timeLabel(Math.floor((Date.now() - current.started) / 1000));
      }, 1000);
    } else {
      const data = await API.get('/api/review/due?limit=50');
      if (session !== current) return;
      current.items = (Array.isArray(data) ? data : data.questions || []).filter(q => q && (q.question || q.concept || q.front));
      current.totalDue = data.due_count ?? current.items.length;
      current.recorded = true;
      if (!current.items.length) {
        renderState(false);
        return;
      }
      // Pre-warm session ID in background so clicking "Start Daily Review" is 0ms
      current.sessionPromise = API.post('/api/quiz/start-session').then(saved => {
        if (session === current && saved?.session_id) current.sessionId = saved.session_id;
        return saved?.session_id || null;
      }).catch(() => null);
      renderReviewLobby();
    }

    keyboard = onKey;
    document.addEventListener('keydown', keyboard);
  } catch (err) {
    if (session === current) renderState(true, err.message);
  }
}

function renderReviewLobby() {
  const s = session;
  if (!s) return;
  document.body.classList.remove('mode-focused');
  const count = s.totalDue || s.items.length;
  const batchNote = s.totalDue > s.items.length ? ` (${s.items.length} in this session)` : '';
  const previewItems = s.items.slice(0, 4);

  s.container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="chapter-tag"><span>02</span>Spaced repetition queue</div>
        <h1 class="page-head-title">Daily review.</h1>
        <p class="page-head-desc">Review due questions when you’re ready. Speed automatically determines each card’s next interval.</p>
      </div>
      <div class="page-head-actions">
        <a class="btn btn-secondary" href="#review?src=flashcards"><svg width="14" height="14"><use href="#i-layers"/></svg><span>Flashcards</span></a>
      </div>
    </div>

    <div class="review-lobby-grid" data-stagger>
      <section class="card spot review-lobby-main">
        <div class="review-lobby-top">
          <span class="chapter-tag"><span>Ready</span>Active recall session</span>
          <div class="review-lobby-count">
            <strong>${count}</strong>
            <div>
              <h2>${count === 1 ? 'question ready' : 'questions ready'} for review${html(batchNote)}.</h2>
              <p>Your timer will not start until you begin. Answer each question as accurately and quickly as you can.</p>
            </div>
          </div>
        </div>

        <div class="review-lobby-tiers" aria-label="Automatic speed placement rules">
          <div class="review-tier is-easy">
            <span class="speed-tag is-easy">&lt; 15s</span>
            <strong>Easy placement</strong>
            <small>Fast correct recall · 4–7d interval</small>
          </div>
          <div class="review-tier is-medium">
            <span class="speed-tag is-medium">15–20s</span>
            <strong>Medium placement</strong>
            <small>Steady recall · 2d interval</small>
          </div>
          <div class="review-tier is-hard">
            <span class="speed-tag is-hard">&gt; 20s / Wrong</span>
            <strong>Hard placement</strong>
            <small>Needs reinforcement · 1d interval</small>
          </div>
        </div>

        <div class="review-lobby-actions">
          <button type="button" class="btn btn-primary btn-lg" id="review-start-btn">
            <span>Start Daily Review</span>
            <svg width="15" height="15"><use href="#i-arrow-right"/></svg>
          </button>
          <span class="caption-text">Press <kbd>Enter</kbd> to start · Keys <kbd>1–4</kbd> select options</span>
        </div>
      </section>

      <aside class="card spot review-lobby-side">
        <div class="section-heading" style="margin-bottom:10px">
          <span class="card-title">Up next in queue</span>
          <span class="chip chip-accent mono">${s.items.length} Qs</span>
        </div>
        <div class="review-lobby-preview">
          ${previewItems.map((item, idx) => `
            <div class="review-preview-row">
              <span class="mono review-preview-num">${String(idx + 1).padStart(2, '0')}</span>
              <div class="review-preview-copy">
                <p>${html(item.question || item.concept || item.front)}</p>
                <span>${html(item.lecture_title || 'Scheduled review')}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="review-lobby-foot">
          <span class="caption-text">Prefer untimed concept flipping?</span>
          <a class="text-link" href="#review?src=flashcards">Open Flashcards ↗</a>
        </div>
      </aside>
    </div>`;
}

function startQuizReviewSession() {
  const s = session;
  if (!s || s.flashcardMode || s.startedQuiz) return;
  s.startedQuiz = true;
  s.started = Date.now();
  document.body.classList.add('mode-focused');
  if (!s.sessionId && !s.sessionPromise) {
    s.sessionPromise = API.post('/api/quiz/start-session').then(saved => {
      if (session === s && saved?.session_id) s.sessionId = saved.session_id;
      return saved?.session_id || null;
    }).catch(() => null);
  }
  renderQuizReviewCard(true);
  clearInterval(paceClock);
  paceClock = setInterval(() => {
    if (session !== s || s.answered || s.index >= s.items.length) return;
    const elapsedSec = (performance.now() - s.questionStarted) / 1000;
    const paceFill = s.container.querySelector('#review-pace-fill');
    const paceLbl = s.container.querySelector('#review-pace-fill-lbl');
    if (paceFill) {
      const pct = Math.max(0, 100 - (elapsedSec / 25) * 100);
      paceFill.style.setProperty('--pct', pct.toFixed(1));
      paceFill.className = `pace-ring ${elapsedSec < 15 ? 'is-easy' : elapsedSec <= 20 ? 'is-medium' : 'is-hard'}`;
    }
    if (paceLbl) {
      const tier = elapsedSec < 15 ? 'Easy' : elapsedSec <= 20 ? 'Medium' : 'Hard';
      paceLbl.textContent = tier;
      const sec = paceFill && document.getElementById(paceFill.id + '-sec');
      if (sec) sec.textContent = elapsedSec.toFixed(1);
    }
  }, 100);
  clearInterval(clock);
  clock = setInterval(() => {
    const label = s.container.querySelector('#session-timer-lbl');
    if (label) label.textContent = timeLabel(Math.floor((Date.now() - s.started) / 1000));
  }, 1000);
}

async function loadFlashcardSource(current, src) {
  const courses = await API.get('/api/courses').catch(() => []);
  if (session !== current) return;
  current.courses = Array.isArray(courses) ? courses : [];

  if (src.startsWith('deck:')) {
    const vid = src.slice(5);
    current.selectedVideoId = String(vid);
    const parentCourse = current.courses.find(c => (c.videos || []).some(v => String(v.id) === String(vid)));
    if (parentCourse) current.selectedCourseId = String(parentCourse.id);
    const video = await API.get(`/api/videos/${encodeURIComponent(vid)}`);
    if (session !== current) return;
    current.title = video.title || 'Lecture flashcards';
    current.items = (video.flashcards || video.key_concepts || []).map(c => ({
      concept: typeof c === 'string' ? c : c.concept || c.front || c.title || '',
      definition: typeof c === 'string' ? '' : c.definition || c.back || c.description || '',
      lecture_title: video.title,
    }));
  } else if (src.startsWith('course:')) {
    const cid = src.slice(7);
    current.selectedCourseId = String(cid);
    current.selectedVideoId = '';
    const cards = await API.get(`/api/courses/${encodeURIComponent(cid)}/flashcards`);
    if (session !== current) return;
    current.title = current.courses.find(c => String(c.id) === String(cid))?.name || 'Course flashcards';
    current.items = (cards || []).map(c => ({
      concept: c.concept || c.front || c.title || '',
      definition: c.definition || c.back || c.description || '',
      lecture_title: c.source || current.title,
    }));
  } else {
    // src === 'flashcards': default to first course with lectures
    const firstCourse = current.courses[0];
    if (firstCourse) {
      current.selectedCourseId = String(firstCourse.id);
      current.selectedVideoId = '';
      current.title = firstCourse.name || 'Flashcards';
      const cards = await API.get(`/api/courses/${encodeURIComponent(firstCourse.id)}/flashcards`);
      if (session !== current) return;
      current.items = (cards || []).map(c => ({
        concept: c.concept || c.front || c.title || '',
        definition: c.definition || c.back || c.description || '',
        lecture_title: c.source || current.title,
      }));
    }
  }

  current.items = current.items.filter(c => c && (c.concept || c.front));
  current.index = 0;
  current.revealed = false;
  current.seen = new Set([0]);
}

function renderState(error, message = '') {
  const s = session;
  clearInterval(clock);
  clearInterval(paceClock);
  if (!s.flashcardMode && !s.startedQuiz) {
    document.body.classList.remove('mode-focused');
    s.container.innerHTML = `
      <div class="page-head">
        <div>
          <div class="chapter-tag"><span>02</span>Spaced repetition queue</div>
          <h1 class="page-head-title">Daily review.</h1>
          <p class="page-head-desc">Active recall with automatic speed-based difficulty placement.</p>
        </div>
      </div>
      <section class="session-state" ${error ? 'role="alert"' : ''}>
        <span class="session-kicker">${error ? 'Connection issue' : 'Review queue'}</span>
        <h1>${error ? 'Your session couldn’t load.' : 'You’re all caught up.'}</h1>
        <p>${error ? html(message) : 'No cards are scheduled for review right now. You can take a custom practice quiz from your library or study concept flashcards.'}</p>
        <div class="session-state-actions">
          ${error ? '<button class="btn btn-primary" id="review-retry-load">Try again →</button>' : '<a class="btn btn-primary" href="#practice">Open practice →</a>'}
          <a class="btn btn-secondary" href="#review?src=flashcards">Study flashcards</a>
        </div>
      </section>`;
    return;
  }
  s.container.innerHTML = sessionHeader({
    title: s.title,
    completed: 0,
    total: 0,
    exitId: 'session-exit-btn',
    timer: '00:00',
  }) + `<main class="session-workspace"><section class="session-state" ${error ? 'role="alert"' : ''}><span class="session-kicker">${error ? 'Connection issue' : s.flashcardMode ? 'Flashcard deck' : 'Review queue'}</span><h1>${error ? 'Your session couldn’t load.' : s.src === 'due' ? 'You’re up to date.' : 'No flashcards in this deck yet.'}</h1><p>${error ? html(message) : s.src === 'due' ? 'No cards are scheduled for review right now. You can still practice from your library or import another lecture.' : 'Import a lecture with extracted key concepts to study its flashcards.'}</p><div class="session-state-actions">${error ? '<button class="btn btn-primary" id="review-retry-load">Try again →</button>' : '<a class="btn btn-primary" href="#practice">Open practice →</a>'}<a class="btn btn-secondary" href="#today">Back to workspace</a></div></section></main>`;
}

// ══════════════════════════════════════════════════════════════════
// 1. BASIC FLASHCARDS VIEW (No Quiz Difficulty / No Self-Grading)
// ══════════════════════════════════════════════════════════════════
function renderFlashcardView() {
  const s = session;
  if (!s) return;
  const total = s.items.length;
  if (!total) {
    renderState(false);
    return;
  }
  if (s.index < 0) s.index = 0;
  if (s.index >= total) s.index = total - 1;
  s.seen.add(s.index);

  const card = s.items[s.index];
  const concept = card.concept || card.front || card.title || 'Concept';
  const definition = card.definition || card.back || card.description || card.answer || 'No definition was saved for this concept.';
  const elapsed = timeLabel(Math.floor((Date.now() - s.started) / 1000));
  const pad = n => String(n).padStart(2, '0');
  const viewedPct = Math.round(s.seen.size / total * 100);

  const selectedCourse = s.courses.find(c => String(c.id) === String(s.selectedCourseId));
  const videos = selectedCourse?.videos || [];

  const pickerHtml = s.courses.length ? `
    <div class="fc-rail-block">
      <label class="fc-field"><span>Course</span>
        <select id="fc-course-select" class="form-select">
          ${s.courses.map(c => `<option value="${c.id}" ${String(c.id) === String(s.selectedCourseId) ? 'selected' : ''}>${html(c.name)}</option>`).join('')}
        </select>
      </label>
      <label class="fc-field"><span>Lecture</span>
        <select id="fc-video-select" class="form-select">
          <option value="">All lectures in course</option>
          ${videos.map(v => `<option value="${v.id}" ${String(v.id) === String(s.selectedVideoId) ? 'selected' : ''}>${html(v.title)}</option>`).join('')}
        </select>
      </label>
      <div class="fc-rail-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="fc-shuffle-btn"><svg width="13" height="13"><use href="#i-rotate-cw"/></svg><span>Shuffle</span></button>
        <button type="button" class="btn btn-ghost btn-sm" id="fc-restart-btn"><span>Restart</span></button>
      </div>
    </div>` : '';

  s.container.innerHTML = sessionHeader({
    title: s.title,
    completed: s.seen.size,
    total,
    exitId: 'session-exit-btn',
    timer: elapsed,
  }) + `
    <main id="review-main-area" class="session-workspace fc-workspace">
      <section class="fc-hero">
        <div class="fc-hero-copy">
          <span class="session-kicker">Flashcards / Concept deck</span>
          <h1>${html(s.title)}</h1>
          <p>Flip each card to test yourself. No grading — just study at your own pace.</p>
        </div>
        <div class="fc-hero-stats">
          <div><strong>${total}</strong><span>Cards</span></div>
          <div><strong>${s.seen.size}</strong><span>Viewed</span></div>
          <div><strong>${viewedPct}%</strong><span>Covered</span></div>
        </div>
      </section>

      <div class="fc-layout">
        <aside class="fc-rail" aria-label="Deck controls">
          ${pickerHtml}
          <div class="fc-rail-block fc-deck-block">
            <div class="fc-rail-title">Deck <span class="mono">${s.seen.size} / ${total} viewed</span></div>
            <div class="fc-deck-list" id="fc-overview-grid">
              ${s.items.map((item, i) => `
                <button type="button" class="fc-deck-item ${i === s.index ? 'is-active' : ''} ${s.seen.has(i) ? 'is-seen' : ''}" data-fc-idx="${i}">
                  <span class="mono fc-deck-num">${s.seen.has(i) && i !== s.index ? '✓' : pad(i + 1)}</span>
                  <span class="fc-deck-text">${html(item.concept || item.front || item.title)}</span>
                </button>`).join('')}
            </div>
          </div>
        </aside>

        <section class="fc-stage">
          <div class="fc-stage-meta">
            <span class="fc-chip"><svg width="13" height="13"><use href="#i-layers"/></svg>Card ${pad(s.index + 1)} / ${pad(total)}</span>
            <span class="fc-source">${html(card.lecture_title || s.title)}</span>
          </div>
          <div class="fc-progress" aria-hidden="true"><div style="width:${Math.round((s.index + 1) / total * 100)}%"></div></div>

          <div class="flip-scene session-flip-scene fc-scene" id="card-flip-target" role="button" tabindex="0" aria-label="${s.revealed ? 'Flip to concept' : 'Flip to definition'}" aria-pressed="${s.revealed}">
            <div class="flip-card ${s.revealed ? 'flipped' : ''}" id="active-flip-card">
              <div class="card-face fc-face" aria-hidden="${s.revealed}">
                <span class="session-flip-label">Key concept</span>
                <h2 class="fc-concept">${html(concept)}</h2>
                <span class="session-flip-footnote">Click or press Space to reveal the definition</span>
              </div>
              <div class="card-face back fc-face" aria-hidden="${!s.revealed}">
                <span class="session-flip-label">Definition</span>
                <div class="fc-definition">${html(definition)}</div>
                <span class="session-flip-footnote">Click or press Space to flip back</span>
              </div>
            </div>
          </div>

          <div class="fc-controls">
            <button type="button" class="btn btn-secondary" id="fc-prev-btn" ${s.index === 0 ? 'disabled' : ''}><svg width="14" height="14"><use href="#i-arrow-left"/></svg><span>Previous</span></button>
            <button type="button" class="btn btn-ghost" id="fc-flip-btn"><span>${s.revealed ? 'Show Concept' : 'Flip Card'}</span><span class="mono" style="font-size:11px;opacity:.75">Space</span></button>
            <button type="button" class="btn btn-primary" id="fc-next-btn"><span>${s.index + 1 < total ? 'Next Card' : 'Restart Deck'}</span><svg width="14" height="14"><use href="#i-arrow-right"/></svg></button>
          </div>
          <div class="fc-hints"><span><kbd>Space</kbd> flip</span><span><kbd>←</kbd> <kbd>→</kbd> navigate</span><span><kbd>Esc</kbd> exit</span></div>
        </section>
      </div>
    </main>`;
  s.container.querySelector('.fc-deck-item.is-active')?.scrollIntoView({ block: 'nearest' });
  s.container.querySelector('#card-flip-target')?.focus({ preventScroll: true });
}

function flipFlashcard() {
  const s = session;
  if (!s || !s.flashcardMode || !s.items.length) return;
  s.revealed = !s.revealed;
  const flip = s.container.querySelector('#active-flip-card');
  if (flip) {
    flip.classList.toggle('flipped', s.revealed);
    flip.children[0].setAttribute('aria-hidden', String(s.revealed));
    flip.children[1].setAttribute('aria-hidden', String(!s.revealed));
    s.container.querySelector('#card-flip-target')?.setAttribute('aria-pressed', String(s.revealed));
    const flipBtn = s.container.querySelector('#fc-flip-btn span:first-child');
    if (flipBtn) flipBtn.textContent = s.revealed ? 'Show Concept' : 'Flip Card';
  } else {
    renderFlashcardView();
  }
}

function goFlashcard(nextIndex) {
  const s = session;
  if (!s || !s.flashcardMode || !s.items.length) return;
  if (nextIndex >= s.items.length) {
    s.index = 0;
    s.revealed = false;
    showToast('Reached the end of the deck — starting from card 1.', 'info');
  } else if (nextIndex < 0) {
    s.index = 0;
    return;
  } else {
    s.index = nextIndex;
    s.revealed = false;
  }
  renderFlashcardView();
}

// ══════════════════════════════════════════════════════════════════
// 2. DAILY QUIZ REVIEW VIEW (Time-Based Auto-Difficulty Placement)
// ══════════════════════════════════════════════════════════════════
function renderQuizReviewCard(resetTimer = false) {
  const s = session;
  if (!s) return;
  if (s.index >= s.items.length) {
    renderComplete();
    return;
  }
  if (resetTimer || !s.questionStarted) {
    s.questionStarted = performance.now();
  }

  const q = s.items[s.index];
  const answer = q.options?.[correctIndex(q)] || q.answer || '';
  const elapsed = timeLabel(Math.floor((Date.now() - s.started) / 1000));
  const pending = s.pendingAnswer;

  s.container.innerHTML = sessionHeader({
    title: s.title,
    completed: s.results.length,
    total: s.items.length,
    exitId: 'session-exit-btn',
    timer: elapsed,
  }) + `
    <main id="review-main-area" class="session-workspace">
      <div class="session-heading">
        <div>
          <span class="session-kicker">Active recall / daily review</span>
          <h1>Daily review.</h1>
          <p>Answer fast (&lt;15s) to place as Easy, 15–20s for Medium, or &gt;20s for Hard. No manual grading required.</p>
        </div>
        <span class="session-position">${String(s.index + 1).padStart(2, '0')} / ${String(s.items.length).padStart(2, '0')}</span>
      </div>
      <div class="session-layout">
        <div class="session-stage">
          <section class="session-question">
            <div class="session-question-main">
              <div class="session-question-meta">
                <span class="session-question-kind"><svg width="14" height="14"><use href="#i-rotate-cw"/></svg>Multiple choice <span class="mono">· ${String(s.index + 1).padStart(2, '0')}</span></span>
                <span class="session-question-source">${html(q.lecture_title || s.title)}</span>
              </div>
              ${paceBar({ id: 'review-pace-fill' })}
              <h2 class="session-question-title" id="review-question-title">${html(q.question)}</h2>
              ${choices(q, { selected: s.selected, revealed: s.answered, id: 'review-options-wrap' })}
              <div id="review-feedback-slot">${s.answered && pending ? feedback({
                title: pending.isHint ? 'Answer revealed.' : pending.isCorrect ? 'That’s correct.' : 'Here’s the correct answer.',
                answer,
                explanation: q.explanation,
                correct: pending.isCorrect,
                performance: pending.performance,
                elapsedMs: pending.elapsedMs,
                isHint: pending.isHint,
              }) : ''}</div>
            </div>
            <div class="session-question-actions">
              <span class="session-action-note" id="review-action-note">${s.answered ? 'Press Enter or Space to continue to the next question.' : `Click an option or press <kbd>1–${(q.options || []).length || 4}</kbd> to answer immediately.`}</span>
              ${s.answered
                ? `<button class="btn btn-primary session-primary-action" id="review-next-btn">${s.index + 1 >= s.items.length ? 'See results →' : 'Next question →'}</button>`
                : `<button class="btn btn-secondary session-primary-action" id="review-direct-reveal-btn">Show answer (Hard)</button>`}
            </div>
            <div class="session-save-state ${s.saveError ? 'is-error' : ''}" id="review-save-state" role="status">${s.saveError ? `<span>${html(s.saveError)}</span><button id="review-retry-save">Retry save</button>` : s.answered ? 'Answer & difficulty placement recorded.' : ''}</div>
          </section>
          <div class="session-under-note">
            <span>Auto-placed as Easy (&lt;15s), Medium (15–20s), or Hard (&gt;20s / wrong)</span>
            <span>Keys <kbd>1–4</kbd> answer</span>
          </div>
        </div>
        ${sessionPanel({ items: s.items, index: s.index, results: s.results, kind: 'review', source: s.title, previous: s.results.length > 0 })}
      </div>
    </main>`;

  if (s.answered && pending) {
    const secs = pending.elapsedMs / 1000;
    const ring = s.container.querySelector('#review-pace-fill');
    if (ring) {
      ring.style.setProperty('--pct', String(Math.max(0, 100 - (secs / 25) * 100)));
      ring.className = `pace-ring ${secs < 15 ? 'is-easy' : secs <= 20 ? 'is-medium' : 'is-hard'}`;
    }
    const sec = s.container.querySelector('#review-pace-fill-sec');
    if (sec) sec.textContent = secs.toFixed(1);
    const lbl = s.container.querySelector('#review-pace-fill-lbl');
    if (lbl) lbl.textContent = secs < 15 ? 'Easy' : secs <= 20 ? 'Medium' : 'Hard';
  }
}

function submitReviewChoice(chosenIdx) {
  const s = session;
  if (!s || s.flashcardMode || s.answered || s.index >= s.items.length) return;
  const q = s.items[s.index];
  if (chosenIdx >= 0 && !q.options?.[chosenIdx]) return;

  try {
    const elapsedMs = Math.max(0, performance.now() - s.questionStarted);
    const isHint = chosenIdx === -2;
    const correctIdx = correctIndex(q);
    const isCorrect = !isHint && chosenIdx === correctIdx;
    const rating = autoRate(elapsedMs, isCorrect, isHint);
    const answer = q.options?.[correctIdx] || q.answer || '';

    const result = {
      question: q,
      chosenIdx,
      correctIdx,
      isCorrect,
      performance: rating,
      rating,
      elapsedMs,
      isHint,
      chosen: chosenIdx >= 0 ? q.options[chosenIdx] : (isHint ? 'Answer revealed' : ''),
      answer,
    };

    s.answered = true;
    s.saving = false;
    s.saveError = '';
    s.selected = chosenIdx >= 0 ? chosenIdx : null;
    s.pendingAnswer = result;
    s.results.push(result);
    try { DailyGoal.addProgress(1); } catch { /**/ }

    renderQuizReviewCard(false);
    saveReviewAnswer(s, result);
  } catch (err) {
    console.error('Answer submit failed', err);
    s.answered = false;
    s.pendingAnswer = null;
    showToast('Could not record that answer. Please try again.', 'error');
  }
}

async function saveReviewAnswer(s, resultToSave = null) {
  const pending = resultToSave || s?.pendingAnswer;
  if (!s || !pending) return;
  try {
    if (s.recorded && pending.question.id) {
      if (!s.sessionId && s.sessionPromise) {
        await s.sessionPromise;
      }
      await API.post('/api/review/answer', {
        question_id: pending.question.id,
        session_id: s.sessionId || 0,
        is_correct: pending.isCorrect,
        performance: pending.performance,
      });
      invalidateDueCount();
    }
  } catch {
    // Non-blocking background save
  }
}

function advanceReviewQuestion() {
  const s = session;
  if (!s || s.flashcardMode || !s.answered) return;
  s.index++;
  s.selected = null;
  s.answered = false;
  s.pendingAnswer = null;
  renderQuizReviewCard(true);
}

function previousAnswer() {
  const s = session;
  const last = s?.results.at(-1);
  if (!last || s.container.querySelector('dialog[open]')) return;
  const meta = RATING_META[last.performance || last.rating] || RATING_META.hard;
  const secs = typeof last.elapsedMs === 'number' ? ` in ${(last.elapsedMs / 1000).toFixed(1)}s` : '';
  const dialog = document.createElement('dialog');
  dialog.className = 'session-history-dialog';
  dialog.setAttribute('aria-label', 'Previous completed review');
  dialog.innerHTML = `<span class="session-kicker">Previous answer / read only</span><h2>${html(last.question.question || last.question.concept || last.question.front)}</h2><p>${html(last.answer)}</p><p class="caption-text">Automatically placed as <strong>${html(meta.label)}</strong>${secs}. Inspecting this answer does not change the saved review.</p><form method="dialog"><button class="btn btn-secondary">Close</button></form>`;
  s.container.appendChild(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

async function onChange(e) {
  const s = session;
  if (!s || !s.flashcardMode) return;
  if (e.target.id === 'fc-course-select') {
    const cid = e.target.value;
    if (!cid) return;
    navigate(`review?src=course:${encodeURIComponent(cid)}`);
  } else if (e.target.id === 'fc-video-select') {
    const vid = e.target.value;
    if (vid) navigate(`review?src=deck:${encodeURIComponent(vid)}`);
    else if (s.selectedCourseId) navigate(`review?src=course:${encodeURIComponent(s.selectedCourseId)}`);
  }
}

function onClick(e) {
  const target = e.target.closest('button,[id="card-flip-target"]');
  if (!target || !session) return;
  const s = session;

  if (target.id === 'session-exit-btn') {
    navigate('today');
    return;
  }
  if (target.id === 'review-retry-load') {
    navigate(`review?src=${encodeURIComponent(s.src)}`);
    return;
  }
  if (target.id === 'review-start-btn') {
    startQuizReviewSession();
    return;
  }

  // Flashcard controls
  if (s.flashcardMode) {
    if (target.id === 'card-flip-target' || target.id === 'fc-flip-btn') {
      flipFlashcard();
    } else if (target.id === 'fc-prev-btn') {
      if (s.index > 0) goFlashcard(s.index - 1);
    } else if (target.id === 'fc-next-btn') {
      goFlashcard(s.index + 1);
    } else if (target.id === 'fc-shuffle-btn') {
      for (let i = s.items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s.items[i], s.items[j]] = [s.items[j], s.items[i]]; }
      s.index = 0;
      s.revealed = false;
      s.seen = new Set([0]);
      showToast('Flashcard deck shuffled.', 'info');
      renderFlashcardView();
    } else if (target.id === 'fc-restart-btn') {
      s.index = 0;
      s.revealed = false;
      s.seen = new Set([0]);
      renderFlashcardView();
    } else if (target.dataset.fcIdx !== undefined) {
      s.index = Number(target.dataset.fcIdx);
      s.revealed = false;
      renderFlashcardView();
    }
    return;
  }

  // Quiz review controls
  if (target.matches('.session-choice')) {
    submitReviewChoice(Number(target.dataset.idx));
  } else if (target.id === 'review-direct-reveal-btn') {
    submitReviewChoice(-2);
  } else if (target.id === 'review-next-btn') {
    advanceReviewQuestion();
  } else if (target.id === 'review-retry-save') {
    saveReviewAnswer(s);
  } else if (target.id === 'review-previous-btn') {
    previousAnswer();
  }
}

function onKey(e) {
  const s = session;
  if (!s || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,textarea,select,[contenteditable="true"],dialog') || document.querySelector('.palette-backdrop.active')) return;

  if (e.key === 'Escape') { e.preventDefault(); navigate('today'); return; }

  if (s.flashcardMode) {
    if (!s.items.length) return;
    if (e.code === 'Space') {
      e.preventDefault();
      flipFlashcard();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (e.target.closest('button') && !e.target.closest('#fc-next-btn,#card-flip-target')) return;
      e.preventDefault();
      goFlashcard(s.index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (s.index > 0) goFlashcard(s.index - 1);
    }
    return;
  }

  if (!s.startedQuiz) {
    if (e.key === 'Enter' && s.items.length) {
      e.preventDefault();
      startQuizReviewSession();
    }
    return;
  }

  if (s.index >= s.items.length) return;
  if (/^[1-9]$/.test(e.key) && !s.answered) {
    e.preventDefault();
    submitReviewChoice(Number(e.key) - 1);
  } else if ((e.key === 'Enter' || e.code === 'Space') && s.answered) {
    e.preventDefault();
    advanceReviewQuestion();
  } else if (e.key.toLowerCase() === 'u') {
    e.preventDefault();
    previousAnswer();
  }
}

function renderComplete() {
  const s = session;
  clearInterval(clock);
  clearInterval(paceClock);
  if (keyboard) document.removeEventListener('keydown', keyboard);
  s.container.innerHTML = sessionHeader({
    title: s.title,
    completed: s.results.length,
    total: s.items.length,
    exitId: 'session-exit-btn',
    timer: timeLabel(Math.floor((Date.now() - s.started) / 1000)),
  }) + completeMarkup({
    title: 'Review complete.',
    total: s.results.length,
    correct: s.results.filter(r => r.isCorrect).length,
    seconds: Math.floor((Date.now() - s.started) / 1000),
    rows: s.results,
  });
  if (s.totalDue > s.items.length) {
    const p = document.createElement('p');
    p.className = 'session-small-note';
    p.textContent = 'This batch is complete. More cards may remain in your daily queue.';
    s.container.querySelector('.session-completion-actions')?.after(p);
  }
}

