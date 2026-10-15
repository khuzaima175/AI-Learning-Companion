import { API, DailyGoal, invalidateDueCount, navigate, skel } from '../app.js';
import { html, correctIndex, timeLabel, sessionHeader, choices, sessionPanel, feedback, completeMarkup } from '../session-ui.js';

let session = null;
let clock = null;
let keyboard = null;

export function cleanupReview() {
  clearInterval(clock);
  if (keyboard) document.removeEventListener('keydown',keyboard);
  session = clock = keyboard = null;
}

export async function renderReview(container, { src = 'due' } = {}) {
  cleanupReview();
  document.body.classList.add('mode-focused');
  document.body.dataset.sessionKind = 'review';
  const current = session = { container, src, items: [], results: [], index: 0, selected: null, revealed: false, saving: false, saveError: '', sessionId: null, title: 'Daily review', started: Date.now(), lastRating: null, totalDue: 0 };
  container.innerHTML = sessionHeader({title:'Preparing your review',completed:0,total:0,exitId:'session-exit-btn',timer:'00:00'}) + `<main id="review-main-area" class="session-workspace"><div class="session-loading" role="status"><span class="session-kicker">Loading your review queue</span>${skel('60%',24)}${skel('100%',95)}${skel('100%',95)}</div></main>`;
  container.onclick = onClick;
  try {
    if (src === 'due') {
      const data = await API.get('/api/review/due?limit=50');
      if (session !== current) return;
      current.items = Array.isArray(data) ? data : data.questions || [];
      current.totalDue = data.due_count ?? current.items.length;
      current.recorded = true;
    } else if (src.startsWith('deck:')) {
      const video = await API.get(`/api/videos/${encodeURIComponent(src.slice(5))}`);
      if (session !== current) return;
      current.title = video.title || 'Lecture concepts';
      current.items = (video.flashcards || video.key_concepts || []).map(c => ({concept:typeof c === 'string' ? c : c.concept || c.front || c.title, definition:typeof c === 'string' ? '' : c.definition || c.back || c.description || '', lecture_title:video.title}));
    } else if (src.startsWith('course:')) {
      const id = src.slice(7);
      const [courses,cards] = await Promise.all([API.get('/api/courses'),API.get(`/api/courses/${encodeURIComponent(id)}/flashcards`)]);
      if (session !== current) return;
      current.title = courses.find(c => String(c.id) === id)?.name || 'Course concepts';
      current.items = cards.map(c => ({concept:c.concept || c.front || c.title, definition:c.definition || c.back || c.description || '', lecture_title:c.source}));
    } else throw new Error('This review source is not available. Choose a course or daily review.');
    current.items = current.items.filter(q => q && (q.question || q.concept || q.front));
    if (!current.items.length) { renderState(false); return; }
    if (current.recorded) {
      const saved = await API.post('/api/quiz/start-session');
      if (session !== current) return;
      if (!saved.session_id) throw new Error('Could not start a recorded review. Please try again.');
      current.sessionId = saved.session_id;
    }
    current.started = Date.now();
    renderCard();
    clock = setInterval(() => {
      const label = current.container.querySelector('#session-timer-lbl');
      if (label) label.textContent = timeLabel(Math.floor((Date.now()-current.started)/1000));
    },1000);
    keyboard = onKey;
    document.addEventListener('keydown',keyboard);
  } catch (err) {
    if (session === current) renderState(true,err.message);
  }
}

function renderState(error, message = '') {
  const s = session;
  clearInterval(clock);
  s.container.innerHTML = sessionHeader({title:s.title,completed:0,total:0,exitId:'session-exit-btn',timer:'00:00'}) + `<main class="session-workspace"><section class="session-state" ${error ? 'role="alert"' : ''}><span class="session-kicker">${error ? 'Connection issue' : 'Review queue'}</span><h1>${error ? 'Your review couldn’t load.' : s.src === 'due' ? 'You’re up to date.' : 'No concept cards here yet.'}</h1><p>${error ? html(message) : s.src === 'due' ? 'No cards are scheduled for review right now. You can still practice from your library or import another lecture.' : 'Import a lecture with extracted concepts to build this deck.'}</p><div class="session-state-actions">${error ? '<button class="btn btn-primary" id="review-retry-load">Try again →</button>' : '<a class="btn btn-primary" href="#practice">Open practice →</a>'}<a class="btn btn-secondary" href="#today">Back to workspace</a></div></section></main>`;
}

function hasChoices(q) { return Array.isArray(q.options) && q.options.length > 1 && correctIndex(q) >= 0; }

function renderCard() {
  const s = session;
  if (!s) return;
  if (s.index >= s.items.length) { renderComplete(); return; }
  const q = s.items[s.index];
  const multiple = hasChoices(q);
  const answer = multiple ? q.options[correctIndex(q)] : q.answer || q.definition || q.back || '';
  const chosenCorrect = s.selected === null ? null : s.selected === correctIndex(q);
  const elapsed = timeLabel(Math.floor((Date.now()-s.started)/1000));
  const ratingNames = [['again','Forgot','Not recalled'],['hard','Hard','Needed a hint'],['good','Good','Remembered'],['easy','Easy','Recalled clearly']];
  s.container.innerHTML = sessionHeader({title:s.title,completed:s.results.length,total:s.items.length,exitId:'session-exit-btn',timer:elapsed}) + `
    <main id="review-main-area" class="session-workspace"><div class="session-heading"><div><span class="session-kicker">${multiple ? 'Active recall / daily review' : 'Active recall / concept deck'}</span><h1>${multiple ? 'Daily review.' : 'Concept review.'}</h1><p>${multiple ? 'Choose an answer, check it, then rate how well you remembered.' : 'Explain the concept to yourself, reveal the definition, then rate your recall.'}</p></div><span class="session-position">${String(s.index+1).padStart(2,'0')} / ${String(s.items.length).padStart(2,'0')}</span></div>
    <div class="session-layout"><div class="session-stage"><section class="session-question"><div class="session-question-main"><div class="session-question-meta"><span class="session-question-kind"><svg width="14" height="14"><use href="#i-${multiple ? 'rotate-cw' : 'layers'}"/></svg>${multiple ? 'Multiple choice' : 'Concept card'} <span class="mono">· ${String(s.index+1).padStart(2,'0')}</span></span><span class="session-question-source">${html(q.lecture_title || s.title)}</span></div>
    ${multiple ? `<h2 class="session-question-title" id="review-question-title">${html(q.question)}</h2>${choices(q,{selected:s.selected,revealed:s.revealed})}${s.revealed ? feedback({title:chosenCorrect === null ? 'Answer revealed' : chosenCorrect ? 'That’s correct.' : 'Compare with the correct answer.',answer,explanation:q.explanation,correct:chosenCorrect}) : ''}` : `
      <div class="flip-scene session-flip-scene" id="card-flip-target" role="button" tabindex="0" aria-label="${s.revealed ? 'Show concept' : 'Reveal concept definition'}" aria-pressed="${s.revealed}"><div class="flip-card ${s.revealed ? 'flipped' : ''}" id="active-flip-card"><div class="card-face" aria-hidden="${s.revealed}"><span class="session-flip-label">Explain this concept</span><h2 class="session-flip-prompt">${html(q.concept || q.front || q.question)}</h2><span class="session-flip-footnote">Click the card or press Space to reveal the definition.</span></div><div class="card-face back" aria-hidden="${!s.revealed}"><span class="session-flip-label">Definition</span><div class="session-flip-definition">${html(answer || 'No definition was saved for this concept. Use your lecture notes to check your understanding.')}</div><span class="session-flip-footnote">Rate your recall below to continue.</span></div></div></div>`}
    <div class="session-rating-area" id="review-controls-area" ${!s.revealed ? 'hidden' : ''}><div class="session-rating-title">How well did you recall it? <span>Keys 1–4</span></div><div class="session-rating-row">${ratingNames.map(([rating,title,description],i) => `<button class="anki-btn ${rating}" data-rating="${rating}" ${s.saving ? 'disabled' : ''}><span>${title}<span class="mono">${i+1}</span></span><span>${description}</span></button>`).join('')}</div></div>
    </div>${!s.revealed ? `<div class="session-question-actions" id="review-reveal-hint"><span class="session-action-note">${multiple ? s.selected === null ? 'Select an answer, or reveal it to assess your own recall.' : `Answer ${String.fromCharCode(65+s.selected)} selected. Ready to check?` : 'Recall the definition before turning the card over.'}</span><button class="btn btn-primary session-primary-action" id="review-direct-reveal-btn">${multiple && s.selected !== null ? 'Check answer' : 'Reveal answer'} <span>↗</span></button></div>` : ''}
    <div class="session-save-state ${s.saveError ? 'is-error' : ''}" id="review-save-state" role="status">${s.saving ? 'Saving your review…' : s.saveError ? `${html(s.saveError)} Please rate this card again to retry.` : s.revealed ? s.recorded ? 'Choose a rating to save this review and continue.' : 'Concept practice is recorded in your daily target on this device.' : ''}</div></section><div class="session-under-note"><span>${s.recorded ? 'Your review will be saved before moving to the next card.' : 'Concept deck · local practice'}</span><span><kbd>Space</kbd> to reveal</span></div></div>
    ${sessionPanel({items:s.items,index:s.index,results:s.results,kind:'review',source:s.title,previous:s.results.length > 0})}</div></main>`;
}

function selectAnswer(index) {
  const s = session;
  if (!s || s.revealed || s.saving) return;
  if (!s.items[s.index].options?.[index]) return;
  s.selected = index;
  s.container.querySelectorAll('.session-choice').forEach((row,i) => {
    row.classList.toggle('selected',i === index);
    row.setAttribute('aria-pressed',String(i === index));
    row.querySelector('.session-choice-mark').textContent = i === index ? '•' : '';
  });
  s.container.querySelector('#review-direct-reveal-btn').innerHTML = 'Check answer <span>↗</span>';
  s.container.querySelector('.session-action-note').textContent = `Answer ${String.fromCharCode(65+index)} selected. Ready to check?`;
}

function reveal() {
  const s = session;
  if (!s || s.saving || s.index >= s.items.length) return;
  if (hasChoices(s.items[s.index]) && s.revealed) return;
  s.revealed = !s.revealed;
  const flip = s.container.querySelector('#active-flip-card');
  if (flip) {
    flip.classList.toggle('flipped',s.revealed);
    flip.children[0].setAttribute('aria-hidden',String(s.revealed));
    flip.children[1].setAttribute('aria-hidden',String(!s.revealed));
    s.container.querySelector('#card-flip-target').setAttribute('aria-pressed',String(s.revealed));
    s.container.querySelector('#review-controls-area').hidden = !s.revealed;
    s.container.querySelector('#review-reveal-hint').hidden = s.revealed;
  } else renderCard();
}

async function grade(rating) {
  const s = session;
  if (!s || s.saving || !s.revealed || s.index >= s.items.length) return;
  const q = s.items[s.index];
  const multiple = hasChoices(q);
  const isCorrect = multiple && s.selected !== null ? s.selected === correctIndex(q) : rating === 'good' || rating === 'easy';
  s.saving = true;
  s.saveError = '';
  s.container.querySelectorAll('.anki-btn').forEach(b => b.disabled = true);
  const saveState = s.container.querySelector('#review-save-state');
  saveState.classList.remove('is-error');
  saveState.textContent = s.recorded ? 'Saving your review…' : 'Recording your practice…';
  try {
    if (s.recorded && q.id) {
      const performance = !isCorrect || rating === 'again' || rating === 'hard' ? 'hard' : rating;
      await API.post('/api/review/answer',{question_id:q.id,session_id:s.sessionId,is_correct:isCorrect,performance});
      invalidateDueCount();
    }
    if (session !== s) return;
    try { DailyGoal.addProgress(1); } catch { /* A successful cloud save must not be retried if local storage is full. */ }
    s.results.push({question:q,isCorrect,rating,chosen:multiple && s.selected !== null ? q.options[s.selected] : '',answer:multiple ? q.options[correctIndex(q)] : q.answer || q.definition || q.back || ''});
    s.index++;
    s.selected = null;
    s.revealed = s.saving = false;
    renderCard();
  } catch (err) {
    if (session !== s) return;
    s.saving = false;
    s.saveError = 'This review could not be saved.';
    saveState.classList.add('is-error');
    saveState.textContent = `${s.saveError} Check your connection and choose a rating to retry.`;
    s.container.querySelectorAll('.anki-btn').forEach(b => b.disabled = false);
  }
}

function previousAnswer() {
  const s = session;
  const last = s?.results.at(-1);
  if (!last || s.container.querySelector('dialog[open]')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'session-history-dialog';
  dialog.setAttribute('aria-label','Previous completed review');
  dialog.innerHTML = `<span class="session-kicker">Previous answer / read only</span><h2>${html(last.question.question || last.question.concept || last.question.front)}</h2><p>${html(last.answer)}</p><p class="caption-text">Rated ${html(last.rating)}. Inspecting this answer does not change the saved review.</p><form method="dialog"><button class="btn btn-secondary">Close</button></form>`;
  s.container.appendChild(dialog);
  dialog.addEventListener('close',() => dialog.remove(),{once:true});
  dialog.showModal();
}

function onClick(e) {
  const target = e.target.closest('button,[id="card-flip-target"]');
  if (!target || !session) return;
  if (target.id === 'session-exit-btn') navigate('today');
  else if (target.id === 'review-retry-load') navigate(`review?src=${encodeURIComponent(session.src)}`);
  else if (target.matches('.session-choice')) selectAnswer(Number(target.dataset.idx));
  else if (target.id === 'review-direct-reveal-btn' || target.id === 'card-flip-target') reveal();
  else if (target.dataset.rating) grade(target.dataset.rating);
  else if (target.id === 'review-previous-btn') previousAnswer();
}

function onKey(e) {
  const s = session;
  if (!s || s.saving || s.index >= s.items.length || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,textarea,select,[contenteditable="true"],dialog') || document.querySelector('.palette-backdrop.active')) return;
  if (e.code === 'Space') {
    if (e.target.closest('.anki-btn')) return;
    e.preventDefault();
    reveal();
  }
  else if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    if (!s.revealed) selectAnswer(Number(e.key)-1);
    else if (Number(e.key) <= 4) grade(['again','hard','good','easy'][Number(e.key)-1]);
  } else if (e.key === 'Enter') {
    if (e.target.closest('button') && !e.target.closest('.session-choice,.anki-btn')) return;
    e.preventDefault();
    if (!s.revealed) reveal();
    else grade(e.target.closest('.anki-btn')?.dataset.rating || 'good');
  } else if (e.key.toLowerCase() === 'u') { e.preventDefault(); previousAnswer(); }
}

function renderComplete() {
  const s = session;
  clearInterval(clock);
  if (keyboard) document.removeEventListener('keydown',keyboard);
  s.container.innerHTML = sessionHeader({title:s.title,completed:s.results.length,total:s.items.length,exitId:'session-exit-btn',timer:timeLabel(Math.floor((Date.now()-s.started)/1000))}) + completeMarkup({title:'Review complete.',total:s.results.length,correct:s.results.filter(r => r.isCorrect).length,seconds:Math.floor((Date.now()-s.started)/1000),rows:s.results});
  if (s.totalDue > s.items.length) {
    const p = document.createElement('p');
    p.className = 'session-small-note';
    p.textContent = 'This batch is complete. More cards may remain in your daily queue.';
    s.container.querySelector('.session-completion-actions').after(p);
  }
}
