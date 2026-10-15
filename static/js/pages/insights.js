import { API, skel, showToast, Streak, escapeHtml } from '../app.js';

export async function renderInsights(container) {
  const kpi = (title,id,suffix='',color='var(--txt-1)') => `<div class="stat-card"><div class="stat-header"><span class="stat-label">${title}</span></div><div class="stat-value-row"><strong class="stat-value" id="${id}" data-count="0" data-count-suffix="${suffix}" style="color:${color}">0${suffix}</strong></div><span class="caption-text">Recorded study data</span></div>`;
  container.innerHTML = `
    <div class="page-head"><div><div class="chapter-tag"><span>04</span>Study record</div><h1 class="page-head-title">Insights.</h1><p class="page-head-desc">Recorded sessions, recall accuracy, and study activity.</p></div></div>
    <div class="kpi-grid-4 insights-metrics" style="margin-bottom:24px" data-stagger>${kpi('Practice questions','kpi-total-cards')}${kpi('Cards due for review','kpi-due','','var(--acc-300)')}${kpi('Overall recall accuracy','kpi-avg-score','%','var(--violet)')}${kpi('Current study streak','kpi-streak','','var(--warn-400)')}</div>
    <div class="insights-charts" style="margin-bottom:24px" data-stagger>
      <section class="insights-volume"><div class="section-heading"><span class="card-title">Session volume</span><span class="chip chip-neutral">Cards reviewed</span></div><div id="insights-volume-bars" class="chart-bars-wrap" style="height:160px">${skel('100%',120)}</div><p class="caption-text" style="margin-top:16px">Based on your latest recorded sessions.</p></section>
      <section class="insights-calendar"><div class="section-heading"><span class="card-title">Study calendar</span><span class="caption-text">Last 12 weeks</span></div><div class="calendar-total"><span id="insights-active-days">0</span> <small>study days in this period</small></div><div class="year-heatmap-wrap"><div id="insights-heatmap-grid" class="year-heatmap-grid" style="grid-template-columns:repeat(12,18px)"></div></div><p class="study-tip" style="margin-top:20px">Highlighted days reflect activity recorded on this device.</p></section>
    </div>
    <section class="card insights-course-table" style="padding:0;overflow:hidden"><div class="section-heading" style="padding:22px 22px 0"><span class="card-title">Course inventory</span><a href="#library" class="caption-text" style="color:var(--acc-400)">Open library →</a></div><div class="tbl-wrap" style="border:0;background:transparent"><table class="tbl"><thead><tr><th>Course</th><th class="num-col">Lectures</th><th class="num-col">Questions</th><th>Study</th></tr></thead><tbody id="insights-courses-tbody"><tr><td colspan="4">${skel('100%',30)}</td></tr></tbody></table></div></section>`;
  const history = new Set(Streak.get().history);
  let activeDays = 0;
  const start = new Date();
  start.setDate(start.getDate() - 83);
  document.getElementById('insights-heatmap-grid').innerHTML = Array.from({length:84},(_,i) => {
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const active = history.has(d.toLocaleDateString('en-CA'));
    if (active) activeDays++;
    return `<div class="year-cell ${active ? 'lvl-3' : ''}" title="${d.toLocaleDateString()}: ${active ? 'Studied' : 'No activity'}" style="width:100%;aspect-ratio:1;height:auto;max-width:18px"></div>`;
  }).join('');
  document.getElementById('insights-active-days').textContent = activeDays;
  const [stats,courses] = await Promise.allSettled([API.get('/api/stats'),API.get('/api/courses')]);
  const s = stats.status === 'fulfilled' ? stats.value : {};
  for (const [id,value] of [['kpi-total-cards',s.total_questions ?? s.questions ?? 0],['kpi-due',s.due_count ?? 0],['kpi-avg-score',Math.round(s.accuracy ?? 0)],['kpi-streak',Streak.get().count]]) {
    const el = document.getElementById(id);
    el.dataset.count = value;
    el.textContent = `${value}${el.dataset.countSuffix}`;
  }
  const sessions = (s.recent_sessions || []).filter(s => s.answered > 0).reverse();
  const max = Math.max(1,...sessions.map(s => s.answered));
  document.getElementById('insights-volume-bars').innerHTML = sessions.length ? sessions.map(s => `<div class="chart-col" style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center"><div class="chart-bar-fill" style="height:${Math.round(s.answered/max*82)}%;width:70%;max-width:38px;border-radius:6px 6px 2px 2px" title="${escapeHtml(s.date)}: ${s.answered} cards reviewed"></div><span class="chart-axis-lbl" style="margin-top:8px;font-size:10px">${escapeHtml(s.date.slice(5))}</span></div>`).join('') : '<div class="empty-state" style="width:100%;min-height:150px;background:transparent"><div class="card-title">No recorded sessions yet.</div><a href="#practice" class="btn btn-secondary btn-sm">Start practicing →</a></div>';
  const list = courses.status === 'fulfilled' ? courses.value : [];
  document.getElementById('insights-courses-tbody').innerHTML = list.length ? list.map(c => `<tr><td><a href="#library/${c.id}" style="font-weight:600">${escapeHtml(c.name)}</a></td><td class="num-col mono">${c.video_count || 0}</td><td class="num-col mono">${c.question_count || 0}</td><td><a href="#review?src=course:${c.id}" class="btn btn-ghost btn-sm" style="color:var(--acc-400)">Review course →</a></td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:32px"><p class="caption-text">Import your first lecture to start growing your library.</p></td></tr>';
  if (stats.status === 'rejected' || courses.status === 'rejected') showToast('Some insights could not load. Try refreshing this view.', 'warn');
}
