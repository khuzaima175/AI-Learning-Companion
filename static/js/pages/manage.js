import { API, showToast, icon, skel } from '../app.js';

export async function renderManage(container) {
  container.innerHTML = `
    <!-- Header -->
    <div style="margin-bottom:28px">
      <div class="page-title">Manage <em>Library</em></div>
      <p class="page-subtitle">Organize courses, remove obsolete video lectures, and prune associated practice cards.</p>
    </div>
    <div id="manage-body">
      <div class="manage-stats-grid" style="margin-bottom:24px">
        ${skel('100%', 80, 12)}
        ${skel('100%', 80, 12)}
        ${skel('100%', 80, 12)}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${skel('100%', 64, 12)}
        ${skel('100%', 64, 12)}
      </div>
    </div>
  `;
  await loadCourses();
}

async function loadCourses() {
  const body = document.getElementById('manage-body');
  if (!body) return;

  try {
    const courses = await API.get('/api/courses');
    renderList(courses);
  } catch (e) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:48px;color:var(--coral)">
        Error: ${e.message}
      </div>`;
  }
}

function renderList(courses) {
  const body = document.getElementById('manage-body');
  if (!body) return;

  if (!courses.length) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:56px 24px">
        <div class="icon-chip glass" style="width:48px;height:48px;margin:0 auto 14px">
          ${icon('library', '', 'width:24px;height:24px')}
        </div>
        <h3 style="font-size:1.4rem">No library content yet</h3>
        <p style="font-size:0.88rem;color:var(--muted);margin-top:6px">Add your first video lecture to start managing.</p>
      </div>`;
    return;
  }

  const totalV = courses.reduce((a, c) => a + (c.video_count || 0), 0);
  const totalQ = courses.reduce((a, c) => a + (c.question_count || 0), 0);

  body.innerHTML = `
    <!-- Summary Header Cards -->
    <div class="manage-stats-grid" style="margin-bottom:24px">
      <div class="card card-sm" style="text-align:center">
        <div class="serif-num" style="font-size:2.5rem;color:var(--teal)">${courses.length}</div>
        <div class="card-title" style="font-size:0.8rem">Total Courses</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div class="serif-num" style="font-size:2.5rem;color:var(--text)">${totalV}</div>
        <div class="card-title" style="font-size:0.8rem">Total Lectures</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div class="serif-num" style="font-size:2.5rem;color:var(--amber)">${totalQ}</div>
        <div class="card-title" style="font-size:0.8rem">Total Questions</div>
      </div>
    </div>

    <!-- Course Management List -->
    <div id="manage-courses-list" style="display:flex;flex-direction:column;gap:12px"></div>
  `;

  const list = document.getElementById('manage-courses-list');

  courses.forEach(c => {
    const el = document.createElement('div');
    el.className = 'card card-sm';
    el.style.padding = '0';
    el.style.overflow = 'hidden';

    el.innerHTML = `
      <div id="mhdr-${c.id}" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;cursor:pointer;background:var(--sf1)">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="icon-chip teal" style="width:34px;height:34px">${icon('book-open', '', 'width:16px;height:16px')}</div>
          <div>
            <div style="font-weight:600;font-size:0.95rem;color:var(--text)">${c.name}</div>
            <div style="font-size:0.78rem;color:var(--muted);margin-top:2px">
              ${c.video_count} lecture${c.video_count !== 1 ? 's' : ''} · ${c.question_count} cards
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-danger btn-sm del-course-btn" data-id="${c.id}" data-name="${c.name}">
            ${icon('trash-2', '', 'width:13px;height:13px')}
            <span>Delete Course</span>
          </button>
          <span class="m-chevron" style="color:var(--faint);transition:transform 0.2s">${icon('chevron-down', '', 'width:16px;height:16px')}</span>
        </div>
      </div>

      <div id="mbody-${c.id}" style="display:none;padding:14px 20px;border-top:1px solid var(--line);background:var(--sf2)">
        ${(c.videos || []).length === 0 ? `
          <div style="color:var(--faint);font-size:0.82rem;text-align:center;padding:8px">No videos in this course</div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${(c.videos || []).map(v => `
              <div id="vrow-${v.id}" class="card card-xs" style="display:flex;justify-content:space-between;align-items:center;background:var(--sf1);padding:10px 14px">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                  <span style="color:var(--teal)">${icon('video', '', 'width:16px;height:16px')}</span>
                  <span style="font-weight:500;font-size:0.88rem;color:var(--text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${v.title}</span>
                </div>
                <button class="btn btn-danger btn-sm del-video-btn" data-id="${v.id}" data-name="${v.title}" style="padding:4px 8px">
                  ${icon('trash-2', '', 'width:13px;height:13px')}
                </button>
              </div>`).join('')}
          </div>`}
      </div>
    `;

    list.appendChild(el);

    const hdr = el.querySelector(`#mhdr-${c.id}`);
    const mbody = el.querySelector(`#mbody-${c.id}`);
    const chevron = el.querySelector('.m-chevron');

    hdr?.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const isHidden = mbody.style.display === 'none';
      mbody.style.display = isHidden ? 'block' : 'none';
      if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
    });

    el.querySelector('.del-course-btn')?.addEventListener('click', async () => {
      if (!confirm(`Are you sure you want to delete course "${c.name}" and all its videos & quiz cards?`)) return;
      try {
        await API.del(`/api/courses/${c.id}`);
        el.remove();
        showToast(`Course "${c.name}" deleted`, 'success');
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    el.querySelectorAll('.del-video-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const vid = btn.dataset.id;
        const name = btn.dataset.name;
        if (!confirm(`Delete video "${name}" and all its questions?`)) return;
        try {
          await API.del(`/api/videos/${vid}`);
          document.getElementById(`vrow-${vid}`)?.remove();
          showToast(`"${name}" deleted`, 'success');
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
  });
}
