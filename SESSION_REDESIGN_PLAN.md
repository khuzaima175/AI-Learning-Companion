# Review and quiz session redesign

October 15, 2026

## Priority and visual direction

Redesign the daily-review and active-quiz views first. Keep the existing black/charcoal/grey direction. Use the available desktop width without vertically centering the entire interface. Prioritize the question, answer choices, feedback, and next action; remove the repeated dashboard blocks surrounding them.

## Problems visible in the supplied screenshots

1. `.review-scene-wrap` combines a viewport-sized minimum height with `justify-content: center`, creating the large gap above the questions.
2. The session card has a forced minimum height, while four full-width answer rows produce a long, undifferentiated list.
3. The right column repeats progress and score across several panels, followed by a permanently expanded shortcut list.
4. Both modes show 100% accuracy before any answer is recorded.
5. Progress starts partway filled on the first unanswered question.
6. Questions, answer-reveal feedback, and grading share no clear visual sequence.
7. Short concept cards repeat their title and leave a large unstructured flip surface.

## Implementation plan

### 1. Shared session structure

- Full-width compact session header with exit, source, completed progress, and elapsed/countdown time.
- Top-aligned workspace with a visible mode title, short instruction, and question position.
- Large question area paired with one compact session panel, rather than four separate side panels.
- Responsive answer tiles: two columns on wider screens, one column on phones, with wrapping for long answers.
- Numbered question map inside a disclosure; concise upcoming-question previews; keyboard help inside its own disclosure.
- Real buttons, keyboard selection, live status feedback, visible selected/correct/incorrect states, and reduced-motion support.

### 2. Daily review flow

- Choose an answer, then reveal it; concept decks retain a focused flip/reveal interaction.
- Show the correct answer explicitly with the selection result.
- Reveal four recall-rating actions only when the answer is visible; avoid unsupported fixed interval promises.
- Create a real recorded session for due quiz questions. Keep extracted concept decks explicitly local to this device rather than posting concept IDs as quiz-question IDs.
- Save before advancing. Keep the current card visible on a save failure and allow a retry.
- Compute recall statistics from completed items; show an em dash before any are completed.
- Replace misleading undo with read-only inspection of the previous completed card.
- Distinguish an empty queue from a failed request.

### 3. Active quiz flow

- Select, confirm, read feedback, then continue.
- Disable answer changes after confirmation and prevent repeated submissions or skipped questions.
- Show the actual answer and a textual state, including timeouts.
- Use elapsed wall-clock time for countdowns so background tabs cannot stretch the timer indefinitely.
- Retain the chosen course/lecture; never substitute unrelated due questions when a selected scope is empty.
- Filter unusable questions and require a known correct answer instead of silently assuming option one.
- Display saving/retry states and create a valid session before recording answers.
- Restore setup safely on a direct/reloaded session URL without in-memory questions.
- Finish with an answer breakdown showing chosen and correct answers.

### 4. Verification and additional fixes

- Inspect 1920px and 1440px desktop views, tablet widths, and 390px/320px phones.
- Verify initial, selected, revealed, grading, correct, incorrect, timeout, saving failure, completion, empty, and loading-error states.
- Complete review and quiz sessions using both pointer and keyboard controls.
- Check duplicate submission, progress, local daily targets, timer cleanup, scoped question fetching, escaping of dynamic content, and reduced motion.
- Run the existing whole-frontend browser suite to catch regressions in library, imports, notes, tutoring, settings, and authentication layouts.
- Keep live-account and AI service verification separate from fixture-based UI verification.

## Delivery

Include the shared session component, scoped session CSS, updated review/quiz controllers, this plan, and a concise verification record. Preserve unrelated local README edits. Back up the current files before applying the reviewed change.

## Implemented and verified

The shared workspace, responsive answer tiles, compact inspector, reveal/feedback transitions, concept flip, completion breakdown, loading/error/empty views, and save/retry flows are implemented. The monochrome palette remains consistent with the rest of the application.

Additional functional fixes include valid recorded-session IDs, save-before-advance behavior, truthful initial accuracy and progress, read-only previous-answer inspection, wall-clock quiz timeouts, timer/listener cleanup, scoped question loading, and a course selector that retains the user's new selection. Browser modifier shortcuts, focused rating buttons, overlay dismissal, and native button activation work without duplicate submissions.

Verification used a local HTTP fixture server with the real frontend modules and Chromium. The whole-frontend regression pass completed 65 checks; the final focused pass covered 11 checks after typography and keyboard refinements. Both reported zero JavaScript runtime errors. JavaScript syntax checks passed. Screenshots were inspected at desktop and phone widths, including long questions, answer feedback, failed saves, and completion.

The fixtures simulate API responses and failures. Live Supabase authentication, actual backend persistence, AI generation, and deployed hosting were not exercised. No backend or database migration is included. Verification scripts, fixtures, and screenshots remain outside the application; only product files and documentation are delivered.
