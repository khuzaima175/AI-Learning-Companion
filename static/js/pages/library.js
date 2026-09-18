/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Library & Master-Detail Archive (`#/library`)
   High-Density Course Browser with Inline Kebabs & Bulk Management
   ══════════════════════════════════════════════════════════════════ */

import { API, showToast, skel, timeAgo, navigate, invalidateCoursesCache } from '../app.js';

let _courses = [];
let _selectedCourseId = null;
let _selectedLectureIds = new Set();
let _filterTerm = '';

export async function renderLibrary(container, options = {}) {
  _selectedCourseId = options.courseId ? parseInt(options.courseId, 10) : null;
  _selectedLectureIds.clear();

  container.innerHTML = `
    <!-- Page Header -->
    <div class="page-head">
      <div>
        <h1 class="page-head-title">Knowledge Library</h1>
        <div class="page-head-desc">Master course archive, structured lecture materials, and practice decks.</div>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-secondary btn-sm" id="lib-new-course-btn">
          <svg style="width:13px;height:13px"><use href="#i-plus"/></svg>
          <span>New Course</span>
        </button>
        <button class="btn btn-primary btn-sm" onclick="window.navigate('import')">
          <svg style="width:13px;height:13px"><use href="#i-download-cloud"/></svg>
          <span>Import Lecture</span>
        </button>
      </div>
    </div>

    <!-- Master-Detail Split Grid -->
    <div class="library-split">
      
      <!-- Left Pane: Courses List (280px) -->
      <div class="library-courses-pane">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px">
          <span class="side-label" style="padding:0">All Courses</span>
          <span class="mono caption-text" id="lib-course-count-lbl">0</span>
        </div>
        <div id="lib-courses-list" style="display:flex;flex-direction:column;gap:3px">
          ${skel('100%', 42)}
          ${skel('100%', 42)}
          ${skel('100%', 42)}
        </div>
      </div>

      <!-- Right Pane: Selected Course Workspace & Lectures Table -->
      <div id="lib-main-pane" style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:24px">
          ${skel('60%', 24)}
          <div style="margin-top:12px">${skel('100%', 200)}</div>
        </div>
      </div>

    </div>
  `;

  // Bind New Course Button
  document.getElementById('lib-new-course-btn')?.addEventListener('click', promptNewCourse);

  // Global search shortcut listener ('/')
  const searchListener = (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      document.getElementById('lib-search-input')?.focus();
    }
  };
  document.addEventListener('keydown', searchListener);

  await loadCoursesData();
}

async function loadCoursesData() {
  try {
    _courses = await API.get('/api/courses');
    renderCoursesLeftPane();

    if (_courses.length) {
      if (!_selectedCourseId || !_courses.find(c => c.id === _selectedCourseId)) {
        _selectedCourseId = _courses[0].id;
      }
      renderSelectedCourseWorkspace();
    } else {
      document.getElementById('lib-main-pane').innerHTML = `
        <div class="card empty-state">
          <div class="icon-tile accent" style="width:44px;height:44px">
            <svg style="width:22px;height:22px"><use href="#i-library"/></svg>
          </div>
          <div class="empty-state-title">Your library is empty</div>
          <div class="empty-state-desc">Import your first video lecture to automatically synthesize notes, concepts, and practice cards.</div>
          <button class="btn btn-primary btn-sm" onclick="window.navigate('import')" style="margin-top:8px">
            <span>Import Video Lecture</span>
          </button>
        </div>`;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCoursesLeftPane() {
  const list = document.getElementById('lib-courses-list');
  const countLbl = document.getElementById('lib-course-count-lbl');
  if (!list) return;

  if (countLbl) countLbl.textContent = _courses.length;

  if (!_courses.length) {
    list.innerHTML = `<div class="caption-text" style="padding:8px">No courses yet.</div>`;
    return;
  }

  list.innerHTML = _courses.map(c => `
    <div class="course-row-item ${c.id === _selectedCourseId ? 'active' : ''}" data-cid="${c.id}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--txt-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</div>
        <div class="caption-text mono" style="margin-top:2px">${c.video_count || 0} lectures · ${c.question_count || 0} cards</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.course-row-item').forEach(el => {
    el.addEventListener('click', () => {
      _selectedCourseId = parseInt(el.dataset.cid, 10);
      _selectedLectureIds.clear();
      renderCoursesLeftPane();
      renderSelectedCourseWorkspace();
    });
  });
}

function renderSelectedCourseWorkspace() {
  const pane = document.getElementById('lib-main-pane');
  if (!pane) return;

  const course = _courses.find(c => c.id === _selectedCourseId);
  if (!course) return;

  const allVideos = course.videos || [];
  const filteredVideos = allVideos.filter(v => v.title.toLowerCase().includes(_filterTerm.toLowerCase()));

  pane.innerHTML = `
    <!-- Course Header Card -->
    <div class="card" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">
      <div>
        <div style="display:flex;align-items:center;gap:10px">
          <h2 style="font-size:18px;font-weight:600;color:var(--txt-1)">${course.name}</h2>
          <span class="chip chip-neutral mono">${allVideos.length} lectures</span>
        </div>
        <div class="caption-text" style="margin-top:4px">
          Total Cards: <strong class="mono" style="color:var(--txt-1)">${course.question_count || 0}</strong> · Spaced repetition active
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="window.navigate('review?src=course:${course.id}')">
          <svg style="width:13px;height:13px"><use href="#i-rotate-cw"/></svg>
          <span>Review Course</span>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="window.navigate('practice')">
          <svg style="width:13px;height:13px"><use href="#i-brain-circuit"/></svg>
          <span>Quiz Course</span>
        </button>
        <button class="btn btn-danger btn-sm" id="del-course-btn" title="Delete Course">
          <svg style="width:13px;height:13px"><use href="#i-trash-2"/></svg>
        </button>
      </div>
    </div>

    <!-- Toolbar: Search & Bulk Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="position:relative;width:280px">
        <input class="form-input" id="lib-search-input" placeholder="Search lectures in course ( / )" value="${_filterTerm}" style="height:32px;padding-left:30px;font-size:12.5px" />
        <svg style="position:absolute;left:10px;top:9px;width:14px;height:14px;color:var(--txt-3);pointer-events:none"><use href="#i-search"/></svg>
      </div>

      <div id="lib-bulk-bar" style="display:${_selectedLectureIds.size > 0 ? 'flex' : 'none'};align-items:center;gap:8px">
        <span class="caption-text mono" id="lib-bulk-count">${_selectedLectureIds.size} selected</span>
        <button class="btn btn-danger btn-sm" id="lib-bulk-del-btn">Delete Selected</button>
      </div>
    </div>

    <!-- Lectures Table -->
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:36px">
              <input type="checkbox" class="chk-input" id="lib-select-all-chk" />
            </th>
            <th class="tbl-header-label">Lecture Title</th>
            <th class="tbl-header-label num-col">Cards</th>
            <th class="tbl-header-label num-col">Questions</th>
            <th class="tbl-header-label">Status</th>
            <th class="tbl-header-label num-col" style="width:60px">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${!filteredVideos.length ? `
            <tr><td colspan="6" style="text-align:center;color:var(--txt-3);padding:32px">No lectures found in this course.</td></tr>
          ` : filteredVideos.map(v => `
            <tr>
              <td>
                <input type="checkbox" class="chk-input row-chk" data-vid="${v.id}" ${_selectedLectureIds.has(v.id) ? 'checked' : ''} />
              </td>
              <td>
                <a href="#lecture/${v.id}" onclick="window.navigate('lecture/${v.id}');return false;" style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--txt-1)">
                  <svg style="width:14px;height:14px;color:var(--acc-400);flex-shrink:0"><use href="#i-video"/></svg>
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px">${v.title}</span>
                </a>
              </td>
              <td class="num-col mono">${v.concept_count || 16}</td>
              <td class="num-col mono">${v.question_count || 20}</td>
              <td>
                <span class="chip chip-ok" style="font-size:11px">
                  <span class="status-dot ok"></span>
                  <span>Ready</span>
                </span>
              </td>
              <td class="num-col">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="window.navigate('lecture/${v.id}')" title="Open Lecture">
                    <svg style="width:13px;height:13px"><use href="#i-external-link"/></svg>
                  </button>
                  <button class="btn btn-ghost btn-icon btn-sm row-del-btn" data-vid="${v.id}" data-vtitle="${v.title}" title="Delete Video" style="color:var(--danger-400)">
                    <svg style="width:13px;height:13px"><use href="#i-trash-2"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Search input handler
  const searchInput = document.getElementById('lib-search-input');
  searchInput?.addEventListener('input', e => {
    _filterTerm = e.target.value;
    renderSelectedCourseWorkspace();
  });

  // Delete Course
  document.getElementById('del-course-btn')?.addEventListener('click', async () => {
    if (!confirm(`Are you sure you want to delete course "${course.name}" and all its lectures/cards?`)) return;
    try {
      await API.del(`/api/courses/${course.id}`);
      showToast(`Deleted course "${course.name}"`, 'info');
      invalidateCoursesCache();
      _selectedCourseId = null;
      await loadCoursesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Row Delete Buttons
  pane.querySelectorAll('.row-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const vid = btn.dataset.vid;
      const title = btn.dataset.vtitle;
      if (!confirm(`Delete lecture "${title}" and associated practice cards?`)) return;
      try {
        await API.del(`/api/videos/${vid}`);
        showToast(`Deleted lecture "${title}"`, 'info');
        invalidateCoursesCache();
        await loadCoursesData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Multi-select Checkboxes
  const selectAllChk = document.getElementById('lib-select-all-chk');
  selectAllChk?.addEventListener('change', e => {
    filteredVideos.forEach(v => {
      if (e.target.checked) _selectedLectureIds.add(v.id);
      else _selectedLectureIds.delete(v.id);
    });
    renderSelectedCourseWorkspace();
  });

  pane.querySelectorAll('.row-chk').forEach(chk => {
    chk.addEventListener('change', e => {
      const vid = parseInt(chk.dataset.vid, 10);
      if (e.target.checked) _selectedLectureIds.add(vid);
      else _selectedLectureIds.delete(vid);
      renderSelectedCourseWorkspace();
    });
  });

  // Bulk Delete
  document.getElementById('lib-bulk-del-btn')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${_selectedLectureIds.size} selected lectures?`)) return;
    try {
      for (const vid of _selectedLectureIds) {
        await API.del(`/api/videos/${vid}`);
      }
      showToast(`Deleted ${_selectedLectureIds.size} lectures`, 'info');
      _selectedLectureIds.clear();
      invalidateCoursesCache();
      await loadCoursesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function promptNewCourse() {
  const name = prompt('Enter new course name (e.g., "Deep Learning Architecture"):');
  if (!name || !name.trim()) return;
  try {
    await API.post('/api/courses', { name: name.trim() });
    showToast(`Created course "${name}"`, 'success');
    invalidateCoursesCache();
    await loadCoursesData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
