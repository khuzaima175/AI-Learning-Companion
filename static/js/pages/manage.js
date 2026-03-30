import { API, showToast, staggerElements } from '../app.js';

export async function renderManage(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap">🗂️</div>
      <div class="page-title-text">
        <h1>Manage Content</h1>
        <p class="page-subtitle">Delete courses or individual videos and their associated data</p>
      </div>
    </div>
    <div id="manage-body">
      <div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>
    </div>
  `;
  await load();
}

async function load() {
  try {
    const courses = await API.get('/api/courses');
    render(courses);
  } catch (e) {
    document.getElementById('manage-body').innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${e.message}</div></div>`;
  }
}

function render(courses) {
  const body = document.getElementById('manage-body');

  if (!courses.length) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>No content yet</div></div>`;
    return;
  }

  // Summary strip
  const totalV = courses.reduce((a, c) => a + c.video_count, 0);
  const totalQ = courses.reduce((a, c) => a + c.question_count, 0);

  body.innerHTML = `
    <!-- Summary -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px" class="enter">
      <div class="card card-xs" style="flex:1;min-width:120px;text-align:center">
        <div style="font-size:1.4rem;font-weight:800;color:var(--teal)">${courses.length}</div>
        <div style="font-size:.75rem;color:var(--text-3);margin-top:3px">Courses</div>
      </div>
      <div class="card card-xs" style="flex:1;min-width:120px;text-align:center">
        <div style="font-size:1.4rem;font-weight:800;color:var(--teal)">${totalV}</div>
        <div style="font-size:.75rem;color:var(--text-3);margin-top:3px">Videos</div>
      </div>
      <div class="card card-xs" style="flex:1;min-width:120px;text-align:center">
        <div style="font-size:1.4rem;font-weight:800;color:var(--amber)">${totalQ}</div>
        <div style="font-size:.75rem;color:var(--text-3);margin-top:3px">Questions</div>
      </div>
    </div>

    <!-- Course list -->
    <div style="display:flex;flex-direction:column;gap:12px;max-width:700px" id="manage-list"></div>`;

  const list = document.getElementById('manage-list');

  courses.forEach((c, ci) => {
    const el = document.createElement('div');
    el.className = 'accordion';
    el.id = `cacc-${c.id}`;
    el.style.animationDelay = `${ci * 60}ms`;
    el.innerHTML = `
      <div class="accordion-hdr" id="ahdr-${c.id}">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:1.05rem">📚</span>
          <div>
            <div style="font-weight:700">${c.name}</div>
            <div style="font-size:.75rem;color:var(--text-3);margin-top:2px">${c.video_count} video${c.video_count!==1?'s':''} · ${c.question_count} questions</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-danger btn-sm del-course" data-id="${c.id}" data-name="${c.name}">🗑️ Delete Course</button>
          <span class="accordion-arrow">▾</span>
        </div>
      </div>
      <div class="accordion-body">
        ${c.videos.length === 0
          ? `<div style="color:var(--text-3);font-size:.875rem;text-align:center;padding:8px">No videos in this course</div>`
          : `<div style="display:flex;flex-direction:column;gap:7px" id="vlist-${c.id}">
              ${c.videos.map(v => `
                <div class="card card-xs" id="vrow-${v.id}" style="display:flex;justify-content:space-between;align-items:center;gap:14px">
                  <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                    <span style="font-size:.9rem;flex-shrink:0">📹</span>
                    <span style="font-size:.85rem;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${v.title}</span>
                  </div>
                  <button class="btn btn-danger btn-sm del-video" data-id="${v.id}" data-name="${v.title}" style="flex-shrink:0">🗑️</button>
                </div>`).join('')}
            </div>`}
      </div>`;
    list.appendChild(el);

    // Accordion toggle
    document.getElementById(`ahdr-${c.id}`).addEventListener('click', e => {
      if (e.target.closest('button')) return;
      el.classList.toggle('open');
    });

    // Delete course
    el.querySelector('.del-course').addEventListener('click', async () => {
      if (!confirm(`Delete course "${c.name}" and ALL its videos & questions?\n\nThis cannot be undone.`)) return;
      try {
        await API.del(`/api/courses/${c.id}`);
        el.remove();
        showToast(`"${c.name}" deleted`, 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });

    // Delete video buttons
    el.querySelectorAll('.del-video').forEach(btn => {
      btn.addEventListener('click', async () => {
        const vid  = btn.dataset.id;
        const name = btn.dataset.name;
        if (!confirm(`Delete "${name}" and all its quiz questions?\n\nThis cannot be undone.`)) return;
        try {
          await API.del(`/api/videos/${vid}`);
          document.getElementById(`vrow-${vid}`)?.remove();
          showToast(`"${name}" deleted`, 'success');
        } catch (e) { showToast(e.message, 'error'); }
      });
    });
  });

  staggerElements('#manage-list .accordion', 60);
}
