import { API, Streak, DailyGoal, skel, navigate, showToast, escapeHtml } from '../app.js';

export async function renderToday(container) {
  const streak = Streak.get();
  const goal = DailyGoal.get();
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const progress = Math.min(100, Math.round(goal.progress / goal.target * 100));
  const heatCells = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const studied = streak.history.includes(day.toLocaleDateString('en-CA'));
    return `<div class="heat-cell ${studied ? 'lvl-3' : ''} ${i === 6 ? 'today' : ''}" title="${day.toLocaleDateString()}: ${studied ? 'Studied' : 'No activity'}"></div>`;
  }).join('');
  const metric = (icon, label, id, value = 0) => `
    <div class="card overview-card"><div class="icon-tile"><svg><use href="#i-${icon}"/></svg></div>
      <div><span class="caption-text">${label}</span><strong class="overview-value" id="${id}" data-count="${value}">${value}</strong></div>
    </div>`;
  container.innerHTML = `
    <div class="page-head"><div><div class="chapter-tag"><span>01</span>Study desk</div><h1 class="page-head-title">Today’s session.</h1><p class="page-head-desc">${date}</p></div><div class="page-head-actions"><a class="btn btn-secondary" href="#import"><svg width="14" height="14"><use href="#i-plus"/></svg>Import lecture</a></div></div>
    <section class="desk-hero" aria-label="Today's study plan" data-stagger>
      <div class="review-brief"><div class="chapter-tag"><span>Recall</span>Spaced repetition queue</div><div class="due-line"><strong id="today-due-hero" data-count="0">0</strong><h2>cards ready<br>for review.</h2></div><p id="today-plan-text">Review the concepts scheduled for today, then move on to your next lecture.</p><div class="welcome-actions"><a class="btn btn-primary" href="#review?src=due">Start review <svg width="14" height="14"><use href="#i-arrow-right"/></svg></a><a class="text-link" href="#practice">Practice quiz ↗</a></div></div>
      <div class="next-card-preview"><span class="paper-corner" aria-hidden="true"></span><div class="preview-meta"><span>Next in your queue</span><svg width="16" height="16"><use href="#i-layers"/></svg></div><p id="today-next-question" class="preview-question">Loading your next review question…</p><div class="preview-bottom"><span class="caption-text" id="today-next-caption">Read the question. Try recalling the answer before you start.</span><a class="text-link" href="#review?src=due" id="today-preview-link">Open card ↗</a></div></div>
    </section>
    <div class="overview-grid" data-stagger>${metric('library','Courses','today-course-count')}${metric('video','Lectures','today-lecture-count')}${metric('layers','Practice questions','today-card-count')}${metric('flame','Day streak','today-streak-count',streak.count)}</div>
    <div class="today-columns"><div class="today-left">
      <section class="workspace-section"><div class="section-heading"><span class="card-title"><span class="section-index">02</span>Recently added lectures</span><a class="text-link" href="#library">Library ↗</a></div><div id="today-continue-list">${skel('100%',64)}<div style="margin-top:15px">${skel('100%',64)}</div></div></section>
      <section class="workspace-section"><div class="section-heading"><span class="card-title"><span class="section-index">03</span>Session history</span><a class="text-link" href="#insights">Insights ↗</a></div><div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>Date</th><th>Session</th><th class="num-col">Accuracy</th><th class="num-col">Cards</th></tr></thead><tbody id="today-sessions-tbody"><tr><td colspan="4">${skel('100%',25)}</td></tr></tbody></table></div></section>
    </div><div class="today-right">
      <section class="card daily-goal"><div class="section-heading" style="margin:0"><span class="card-title">Daily target</span><span class="chip chip-accent">${progress}%</span></div><div class="daily-goal-value"><span data-count="${goal.progress}">${goal.progress}</span> <small>/ ${goal.target} cards</small></div><div class="progress-track" role="progressbar" aria-label="Daily study goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="progress-fill" style="width:${progress}%"></div></div><div style="display:flex;justify-content:space-between;align-items:center"><div class="heat-strip">${heatCells}</div><span class="caption-text">Last 7 days</span></div><div class="goal-note">${goal.progress >= goal.target ? 'Daily target complete.' : `${goal.target-goal.progress} more cards to finish today’s target.`} <a href="#settings" class="text-link" style="margin-left:6px">Edit ↗</a></div></section>
      <section class="workspace-section"><div class="section-heading"><span class="card-title">Course index</span><span class="caption-text">Questions</span></div><div id="today-due-courses">${skel('100%',35)}</div></section>
      <section class="quick-import"><span class="card-title">Add to your library</span><p class="caption-text" style="margin:7px 0 13px">YouTube lecture or a pasted transcript.</p><div style="display:flex;gap:8px"><input class="form-input" id="quick-capture-url" type="url" aria-label="YouTube lecture URL" placeholder="Paste a YouTube URL"><button class="btn btn-secondary" id="quick-capture-btn">Import</button></div></section>
    </div></div>`;
  const quickImport = () => {
    const url = document.getElementById('quick-capture-url').value.trim();
    if (!url) { showToast('Paste a YouTube lecture link to get started.', 'warn'); return; }
    sessionStorage.setItem('alc_prefill_url',url);
    navigate('import');
  };
  document.getElementById('quick-capture-btn').addEventListener('click',quickImport);
  document.getElementById('quick-capture-url').addEventListener('keydown', e => { if (e.key === 'Enter') quickImport(); });
  const [due, courses, stats] = await Promise.allSettled([API.get('/api/review/due?limit=1'),API.get('/api/courses'),API.get('/api/stats')]);
  const list = courses.status === 'fulfilled' ? courses.value : [];
  const videos = list.flatMap(c => (c.videos || []).map(v => ({...v,courseName:c.name})));
  const count = due.status === 'fulfilled' ? due.value.due_count ?? due.value.questions?.length ?? 0 : 0;
  for (const [id,value] of [['today-due-hero',count],['today-course-count',list.length],['today-lecture-count',videos.length],['today-card-count',list.reduce((n,c) => n + (c.question_count || 0),0)]]) {
    const el = document.getElementById(id);
    el.dataset.count = value;
    el.textContent = value;
  }
  document.getElementById('today-plan-text').textContent = count ? `${count} cards are scheduled for today. Start with your next question, or choose a course below.` : 'No cards are due today. Choose a lecture from your library or take a practice quiz.';
  const next = due.status === 'fulfilled' ? (due.value.questions || (Array.isArray(due.value) ? due.value : []))[0] : null;
  document.getElementById('today-next-question').textContent = next?.question || (videos.length ? 'Your review queue is clear.' : 'Your first lecture starts the collection.');
  if (!next) {
    document.getElementById('today-next-caption').textContent = videos.length ? 'Use a practice quiz to revisit questions from your library.' : 'Import a video or transcript to generate notes and review cards.';
    const link = document.getElementById('today-preview-link');
    link.href = videos.length ? '#practice' : '#import';
    link.textContent = videos.length ? 'Practice ↗' : 'Import ↗';
  }
  document.getElementById('today-continue-list').innerHTML = videos.length ? videos.slice(0,3).map((v,i) => `
    <div class="lecture-line"><a class="lecture-number" href="#lecture/${v.id}" aria-label="Open ${escapeHtml(v.title)}">${String(i+1).padStart(2,'0')}</a><div class="lecture-info"><a href="#lecture/${v.id}">${escapeHtml(v.title)}</a><div class="caption-text">${escapeHtml(v.courseName)} · ${v.question_count || 0} questions</div></div><a class="btn btn-secondary btn-sm" href="#review?src=deck:${v.id}">Study ↗</a></div>`).join('') : `<div class="empty-workspace"><h3>No lectures yet</h3><p>Add a YouTube lecture or paste your own transcript. Notes, concepts, and practice questions will be collected here.</p><a class="btn btn-primary btn-sm" href="#import">Import your first lecture →</a></div>`;
  document.getElementById('today-due-courses').innerHTML = list.length ? list.slice(0,4).map(c => `<a href="#library/${c.id}" class="course-index-link"><span>${escapeHtml(c.name)}</span><span class="mono">${c.question_count || 0} ↗</span></a>`).join('') : '<p class="caption-text">Choose a subject during your first import to create a course.</p>';
  const sessions = stats.status === 'fulfilled' ? (stats.value.recent_sessions || []).filter(s => s.answered > 0) : [];
  document.getElementById('today-sessions-tbody').innerHTML = sessions.length ? sessions.slice(0,5).map(s => {
    const accuracy = Math.round(s.correct / s.answered * 100);
    return `<tr><td class="mono">${escapeHtml(s.date)}</td><td>Practice &amp; review</td><td class="num-col"><span class="chip ${accuracy >= 80 ? 'chip-ok' : 'chip-warn'}">${accuracy}%</span></td><td class="num-col mono">${s.answered}</td></tr>`;
  }).join('') : '<tr><td colspan="4" style="padding:32px;text-align:center"><p class="caption-text" style="margin-bottom:14px">No completed sessions yet. Try a short practice quiz.</p><a href="#practice" class="btn btn-secondary btn-sm">Start practice →</a></td></tr>';
  if ([due,courses,stats].some(r => r.status === 'rejected')) showToast('Some study data could not load. Try refreshing this view.', 'warn');
}
