import { escapeHtml, DailyGoal } from './app.js';

export const html = escapeHtml;
export function correctIndex(question) {
  const options = question.options || [];
  const answer = String(question.answer ?? '').trim().toLowerCase();
  const match = options.findIndex(option => String(option).trim().toLowerCase() === answer);
  if (match >= 0) return match;
  if (Number.isInteger(question.correct_idx) && question.correct_idx >= 0 && question.correct_idx < options.length) return question.correct_idx;
  if (/^[a-z]$/i.test(answer)) {
    const letter = answer.charCodeAt(0) - 97;
    if (letter >= 0 && letter < options.length) return letter;
  }
  return -1;
}

export function timeLabel(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
}

export function sessionHeader({ title, completed, total, exitId, timer = '', timerId = 'session-timer-lbl' }) {
  const percent = total ? Math.round(completed / total * 100) : 0;
  return `<header id="focused-session-bar" class="session-topbar"><div class="session-topbar-inner">
    <div class="session-topbar-source"><button class="btn btn-ghost btn-sm" id="${exitId}" aria-label="Exit session"><svg width="15" height="15"><use href="#i-arrow-left"/></svg><span>Exit</span></button><span class="session-divider"></span><span id="session-src-title">${html(title)}</span></div>
    <div class="session-topbar-progress"><div class="progress-track" role="progressbar" aria-label="Completed questions" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><div id="session-prog-fill" class="progress-fill" style="width:${percent}%"></div></div><span class="mono" id="session-prog-lbl">${completed} / ${total}</span></div>
    <div class="session-topbar-time"><svg width="14" height="14"><use href="#i-clock"/></svg><span class="mono" id="${timerId}" role="timer">${html(timer)}</span></div>
  </div></header>`;
}

export function choices(question, { selected = null, revealed = false, id = 'review-options-wrap' } = {}) {
  const correct = correctIndex(question);
  return `<div class="session-choices" id="${id}" role="group" aria-label="Answer choices">${(question.options || []).map((option,i) => {
    const state = revealed && i === correct ? 'correct' : revealed && i === selected ? 'wrong' : i === selected ? 'selected' : '';
    const status = revealed && i === correct ? 'Correct answer' : revealed && i === selected ? 'Your answer' : '';
    return `<button type="button" class="quiz-opt-row session-choice ${state}" data-idx="${i}" data-val="${encodeURIComponent(option)}" aria-pressed="${i === selected}" ${revealed ? 'disabled' : ''}><span class="session-choice-key">${String.fromCharCode(65+i)}</span><span class="session-choice-copy">${html(option)}${status ? `<span class="session-choice-status">${status}</span>` : ''}</span><span class="session-choice-mark" aria-hidden="true">${revealed && i === correct ? '✓' : revealed && i === selected ? '×' : i === selected ? '•' : ''}</span></button>`;
  }).join('')}</div>`;
}

export function sessionPanel({ items, index, results, kind, source, previous = false }) {
  const total = items.length;
  const done = results.length;
  const success = results.filter(r => r.isCorrect).length;
  const accuracy = done ? `${Math.round(success/done*100)}%` : '—';
  const percent = total ? Math.round(done/total*100) : 0;
  const goal = DailyGoal.get();
  const upcoming = items.slice(index+1,index+3);
  return `<aside class="session-inspector" aria-label="Session overview"><section class="session-overview"><div class="session-panel-title">This session <span class="session-mode-tag">${kind === 'review' ? 'Review' : 'Quiz'}</span></div><div class="session-summary-metrics"><div><strong id="session-completed-count">${done}<small> / ${total}</small></strong><span>Completed</span></div><div><strong id="session-accuracy">${accuracy}</strong><span>${kind === 'review' ? 'Recall rate' : 'Accuracy'}</span></div></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><p class="session-source-caption">${html(source)}</p>
    <details class="session-map-details"><summary>Question map <span>${total} items</span></summary><div class="session-number-map" role="list" aria-label="Question progress">${items.map((_,i) => `<span role="listitem" class="session-map-number ${i < done ? results[i]?.isCorrect ? 'done-ok' : 'done-err' : i === index ? 'current' : ''}" ${i === index ? 'aria-current="step"' : ''} aria-label="Question ${i+1}: ${i < done ? results[i]?.isCorrect ? 'correct' : 'needs review' : i === index ? 'current' : 'upcoming'}">${String(i+1).padStart(2,'0')}</span>`).join('')}</div><div class="session-map-legend"><span>✓ Correct</span><span>× Needs review</span></div></details>
    ${previous ? '<button class="session-previous" id="review-previous-btn">View previous answer <span>↗</span></button>' : ''}
  </section><section class="session-upcoming"><div class="session-panel-title">Up next <span class="caption-text">${Math.max(0,total-index-1)} remaining</span></div>${upcoming.length ? upcoming.map((q,i) => `<div class="session-upcoming-row"><span class="mono">${String(index+i+2).padStart(2,'0')}</span><p>${html(q.question || q.concept || q.front || 'Concept card')}</p></div>`).join('') : '<p class="session-small-note">This is the last question in your session.</p>'}</section>
  <section class="session-daily-target"><div class="session-panel-title">Daily target <span class="mono">${goal.progress} / ${goal.target}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,goal.progress/goal.target*100)}%"></div></div><p class="session-small-note">${goal.progress >= goal.target ? 'Your daily target is complete.' : `${goal.target-goal.progress} more cards to reach your target.`}</p></section>
  <details class="session-keyboard"><summary>Keyboard shortcuts <span>⌨</span></summary><div><span>Select an answer</span><kbd>1–9</kbd></div><div><span>${kind === 'review' ? 'Reveal / flip' : 'Confirm / next'}</span><kbd>${kind === 'review' ? 'Space' : 'Enter'}</kbd></div>${kind === 'review' ? '<div><span>Rate recalled answer</span><kbd>1–4</kbd></div>' : ''}<div><span>Exit session</span><kbd>Esc</kbd></div></details></aside>`;
}

export function feedback({ title, answer, explanation, correct = null, id = 'review-feedback' }) {
  return `<div class="session-feedback ${correct === true ? 'is-correct' : correct === false ? 'is-incorrect' : ''}" id="${id}" role="status"><div class="session-feedback-heading"><span class="session-feedback-icon">${correct === true ? '✓' : correct === false ? '×' : '↗'}</span><strong>${html(title)}</strong></div><div class="session-feedback-answer">${html(answer)}</div>${explanation && explanation !== answer ? `<p>${html(explanation)}</p>` : ''}</div>`;
}

export function completeMarkup({ title, total, correct, seconds, rows, mode = 'review' }) {
  const percent = total ? Math.round(correct/total*100) : 0;
  return `<div class="session-completion"><div class="session-completion-symbol" aria-hidden="true">✓</div><span class="session-kicker">${mode === 'review' ? 'Daily review' : 'Practice quiz'}</span><h1 class="page-head-title">${html(title)}</h1><p>You’ve completed this session. Review your answers below or return to your workspace.</p><div class="session-result-metrics"><div><strong>${correct}<small> / ${total}</small></strong><span>${mode === 'review' ? 'Recalled' : 'Correct answers'}</span></div><div><strong>${percent}%</strong><span>${mode === 'review' ? 'Recall rate' : 'Accuracy'}</span></div><div><strong>${timeLabel(seconds)}</strong><span>Session time</span></div></div><div class="session-completion-actions"><a class="btn btn-primary" href="#today">Back to workspace →</a><a class="btn btn-secondary" href="#practice">New practice</a></div><div class="session-result-list">${rows.map((r,i) => `<details ${!r.isCorrect ? 'open' : ''}><summary><span class="mono">${String(i+1).padStart(2,'0')}</span><span>${html(r.question.question || r.question.concept || r.question.front)}</span><span class="session-result-state ${r.isCorrect ? 'is-correct' : 'is-incorrect'}">${r.isCorrect ? mode === 'practice' ? 'Correct' : 'Recalled' : 'Review'}</span></summary><div>${r.chosen ? `<p><span>Your answer</span>${html(r.chosen)}</p>` : ''}<p><span>Answer</span>${html(r.answer || r.question.answer || r.question.definition || '')}</p>${r.question.explanation ? `<p>${html(r.question.explanation)}</p>` : ''}</div></details>`).join('')}</div></div>`;
}
