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

// Auto-rate question difficulty based on answer speed and correctness:
//   wrong OR hint/timeout → "hard"   (Hard)
//   correct, < 15s        → "easy"   (Easy)
//   correct, 15–20s       → "good"   (Medium)
//   correct, > 20s        → "hard"   (Hard)
export function autoRate(elapsedMs, isCorrect, hintOrTimeout = false) {
  if (hintOrTimeout || !isCorrect) return 'hard';
  const s = elapsedMs / 1000;
  if (s < 15) return 'easy';
  if (s <= 20) return 'good';
  return 'hard';
}

export const RATING_META = {
  easy: {
    key: 'easy',
    label: 'Easy',
    badge: 'Placed as Easy',
    rule: '< 15s',
    note: 'Fast recall (< 15s) — automatically placed as Easy (next review in 14–180 days).',
    cls: 'is-easy',
  },
  good: {
    key: 'good',
    label: 'Medium',
    badge: 'Placed as Medium',
    rule: '15–20s',
    note: 'Solid recall (15–20s) — automatically placed as Medium (next review in 3–7 days).',
    cls: 'is-medium',
  },
  hard: {
    key: 'hard',
    label: 'Hard',
    badge: 'Placed as Hard',
    rule: '> 20s / Missed',
    note: 'Automatically placed as Hard — scheduled for review again in 1 day.',
    cls: 'is-hard',
  },
};

export function paceBar({ id = 'session-pace-fill', note = 'Auto-difficulty by speed' } = {}) {
  return `<div class="session-pace-wrap is-ring"><div class="pace-ring is-easy" id="${id}" style="--pct:100" aria-hidden="true"><span class="pace-ring-num" id="${id}-sec">0.0</span></div><div class="pace-copy"><strong id="${id}-lbl">Easy</strong><span>${html(note)}</span><div class="pace-legend"><i class="is-easy">Easy &lt;15s</i><i class="is-medium">Medium 15–20s</i><i class="is-hard">Hard &gt;20s</i></div></div></div>`;
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
  return `<aside class="session-inspector" aria-label="Session overview"><section class="session-overview"><div class="session-panel-title">This session <span class="session-mode-tag">${kind === 'review' ? 'Review' : 'Quiz'}</span></div><div class="session-summary-metrics"><div><strong id="session-completed-count">${done}<small> / ${total}</small></strong><span>Completed</span></div><div><strong id="session-accuracy">${accuracy}</strong><span>Accuracy</span></div></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><p class="session-source-caption">${html(source)}</p>
    <div class="session-speed-rules"><div class="session-panel-title" style="margin-bottom:8px">Auto-difficulty rules <span class="mono">Speed</span></div><div class="session-speed-rule"><span class="speed-tag is-easy">Easy</span><span class="mono">&lt; 15s · +14–180d</span></div><div class="session-speed-rule"><span class="speed-tag is-medium">Medium</span><span class="mono">15–20s · +3–7d</span></div><div class="session-speed-rule"><span class="speed-tag is-hard">Hard</span><span class="mono">&gt; 20s / Wrong · 1d</span></div></div>
    <details class="session-map-details"><summary>Question map <span>${total} items</span></summary><div class="session-number-map" role="list" aria-label="Question progress">${items.map((_,i) => `<span role="listitem" class="session-map-number ${i < done ? results[i]?.isCorrect ? 'done-ok' : 'done-err' : i === index ? 'current' : ''}" ${i === index ? 'aria-current="step"' : ''} aria-label="Question ${i+1}: ${i < done ? results[i]?.isCorrect ? 'correct' : 'needs review' : i === index ? 'current' : 'upcoming'}">${String(i+1).padStart(2,'0')}</span>`).join('')}</div><div class="session-map-legend"><span>✓ Correct</span><span>× Needs review</span></div></details>
    ${previous ? '<button class="session-previous" id="review-previous-btn">View previous answer <span>↗</span></button>' : ''}
  </section><section class="session-upcoming"><div class="session-panel-title">Up next <span class="caption-text">${Math.max(0,total-index-1)} remaining</span></div>${upcoming.length ? upcoming.map((q,i) => `<div class="session-upcoming-row"><span class="mono">${String(index+i+2).padStart(2,'0')}</span><p>${html(q.question || q.concept || q.front || 'Question')}</p></div>`).join('') : '<p class="session-small-note">This is the last question in your session.</p>'}</section>
  <section class="session-daily-target"><div class="session-panel-title">Daily target <span class="mono">${goal.progress} / ${goal.target}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,goal.progress/goal.target*100)}%"></div></div><p class="session-small-note">${goal.progress >= goal.target ? 'Your daily target is complete.' : `${goal.target-goal.progress} more cards to reach your target.`}</p></section>
  <details class="session-keyboard"><summary>Keyboard shortcuts <span>⌨</span></summary><div><span>Answer option</span><kbd>1–4</kbd></div><div><span>Next question</span><kbd>Enter / Space</kbd></div><div><span>Exit session</span><kbd>Esc</kbd></div></details></aside>`;
}

export function feedback({ title, answer, explanation, correct = null, performance = null, elapsedMs = null, isHint = false, id = 'review-feedback' }) {
  const meta = performance ? (RATING_META[performance] || RATING_META.hard) : null;
  const secs = typeof elapsedMs === 'number' ? `${(elapsedMs / 1000).toFixed(1)}s` : '';
  return `<div class="session-feedback ${correct === true ? 'is-correct' : correct === false ? 'is-incorrect' : ''}" id="${id}" role="status"><div class="session-feedback-heading"><div style="display:flex;align-items:center;gap:9px"><span class="session-feedback-icon">${correct === true ? '✓' : correct === false ? '×' : '↗'}</span><strong>${html(title)}</strong></div>${meta ? `<span class="session-auto-badge ${meta.cls}">${html(meta.badge)}${secs ? ` · ⏱ ${secs}` : ''}${isHint ? ' · Revealed' : ''}</span>` : ''}</div><div class="session-feedback-answer">${html(answer)}</div>${meta ? `<p class="session-auto-note">${html(meta.note)}</p>` : ''}${explanation && explanation !== answer ? `<p>${html(explanation)}</p>` : ''}</div>`;
}

export function completeMarkup({ title, total, correct, seconds, rows, mode = 'review' }) {
  const percent = total ? Math.round(correct/total*100) : 0;
  return `<div class="session-completion"><div class="session-completion-symbol" aria-hidden="true">✓</div><span class="session-kicker">${mode === 'review' ? 'Daily review' : 'Practice quiz'}</span><h1 class="page-head-title">${html(title)}</h1><p>You’ve completed this session. Review your answers and automatic difficulty placements below or return to your workspace.</p><div class="session-result-metrics"><div><strong>${correct}<small> / ${total}</small></strong><span>${mode === 'review' ? 'Recalled' : 'Correct answers'}</span></div><div><strong>${percent}%</strong><span>${mode === 'review' ? 'Recall rate' : 'Accuracy'}</span></div><div><strong>${timeLabel(seconds)}</strong><span>Session time</span></div></div><div class="session-completion-actions"><a class="btn btn-primary" href="#today">Back to workspace →</a><a class="btn btn-secondary" href="#practice">New practice</a></div><div class="session-result-list">${rows.map((r,i) => {
    const perf = r.performance || r.rating;
    const meta = perf ? (RATING_META[perf] || RATING_META.hard) : null;
    const secs = typeof r.elapsedMs === 'number' ? ` · ${(r.elapsedMs / 1000).toFixed(1)}s` : '';
    return `<details ${!r.isCorrect ? 'open' : ''}><summary><span class="mono">${String(i+1).padStart(2,'0')}</span><span>${html(r.question.question || r.question.concept || r.question.front)}</span><span style="display:inline-flex;align-items:center;gap:6px">${meta ? `<span class="session-auto-badge ${meta.cls}">${html(meta.label)}${secs}</span>` : ''}<span class="session-result-state ${r.isCorrect ? 'is-correct' : 'is-incorrect'}">${r.isCorrect ? 'Correct' : 'Needs Review'}</span></span></summary><div>${r.chosen ? `<p><span>Your answer</span>${html(r.chosen)}</p>` : ''}<p><span>Answer</span>${html(r.answer || r.question.answer || r.question.definition || '')}</p>${meta ? `<p><span>Auto-difficulty placement</span>${html(meta.badge)}${secs} — ${html(meta.note)}</p>` : ''}${r.question.explanation ? `<p>${html(r.question.explanation)}</p>` : ''}</div></details>`;
  }).join('')}</div></div>`;
}

