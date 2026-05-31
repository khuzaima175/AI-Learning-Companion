import { API, showToast, staggerElements } from '../app.js';

let _courses = [];
let _selectedCourse = null;
let _selectedVideo  = null;
let _videoData      = null;

export async function renderBrowse(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap">📖</div>
      <div class="page-title-text">
        <h1>Browse Content</h1>
        <p class="page-subtitle">Explore your saved videos, notes, and AI chats</p>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar enter" style="margin-bottom:22px;animation-delay:60ms">
      <span class="search-icon">🔍</span>
      <input class="search-input" id="browse-search" placeholder="Search courses and videos…" />
    </div>

    <div id="browse-body">
      <div class="loading-state"><div class="spinner"></div><span>Loading your library…</span></div>
    </div>
  `;

  try {
    _courses = await API.get('/api/courses');
    renderCourseList();
  } catch (e) {
    document.getElementById('browse-body').innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${e.message}</div></div>`;
  }

  // Live search
  document.getElementById('browse-search').addEventListener('input', e => {
    renderCourseList(e.target.value.toLowerCase().trim());
  });
}

function renderCourseList(filter = '') {
  const body = document.getElementById('browse-body');
  let filtered = _courses;

  if (filter) {
    filtered = _courses
      .map(c => ({
        ...c,
        videos: c.videos.filter(v => v.title.toLowerCase().includes(filter)),
      }))
      .filter(c => c.name.toLowerCase().includes(filter) || c.videos.length);
  }

  if (!filtered.length) {
    body.innerHTML = filter
      ? `<div class="empty-state"><div class="empty-icon">🔍</div><div>No results for "<strong>${filter}</strong>"</div></div>`
      : `<div class="empty-state"><div class="empty-icon">📭</div><div>No content yet</div><div class="empty-sub" style="margin-top:8px">Add your first video to get started</div></div>`;
    return;
  }

  body.innerHTML = `
    <div class="split-layout" id="browse-grid">
      <div id="course-panel">
        <div class="section-hdr"><div class="section-title">📚 Courses</div><span class="badge badge-teal">${filtered.length}</span></div>
        <div id="course-list" style="display:flex;flex-direction:column;gap:7px"></div>
      </div>
      <div id="video-panel">
        <div class="welcome-splash" style="padding:80px 20px;animation:enterPage 0.5s ease both">
          <div class="splash-graphic-wrap">
            <div class="splash-orb orb-primary"></div>
            <div class="splash-orb orb-secondary"></div>
            <div class="splash-icon">📖</div>
          </div>
          <h3 class="splash-title">Select a Course</h3>
          <p class="splash-subtitle">Choose a subject from the panel on the left to explore video lectures, read summaries, study cards, or ask questions.</p>
        </div>
      </div>
    </div>`;

  const list = document.getElementById('course-list');
  filtered.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'card card-sm';
    el.style.cursor = 'pointer';
    el.style.animationDelay = `${i * 50}ms`;
    el.style.transition = 'all 0.18s ease';
    el.innerHTML = `
      <div style="font-weight:700;font-size:.88rem">${c.name}</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
        <span class="badge badge-teal">${c.video_count} video${c.video_count!==1?'s':''}</span>
        <span class="badge badge-amber">${c.question_count} Qs</span>
      </div>`;
    el.addEventListener('click', () => {
      document.querySelectorAll('#course-list .card').forEach(x => {
        x.style.borderColor = '';
        x.style.background  = '';
      });
      el.style.borderColor = 'var(--teal)';
      el.style.background  = 'var(--teal-glass)';
      _selectedCourse = c;
      renderVideoList(c, filter);
    });
    list.appendChild(el);
  });

  staggerElements('#course-list .card', 50);
}

function renderVideoList(course, filter = '') {
  const panel = document.getElementById('video-panel');
  const videos = filter
    ? course.videos.filter(v => v.title.toLowerCase().includes(filter))
    : course.videos;

  if (!videos.length) {
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">📹</div><div>No videos in "${course.name}"</div></div>`;
    return;
  }

  panel.innerHTML = `
    <div class="section-hdr">
      <div>
        <div class="section-title">${course.name}</div>
        <div class="section-sub">${videos.length} video${videos.length!==1?'s':''}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px" id="video-list"></div>`;

  const vlist = document.getElementById('video-list');
  videos.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'card card-sm';
    el.style.cursor = 'pointer';
    el.style.animationDelay = `${i * 45}ms`;
    el.style.transition = 'all 0.18s ease';
    const qCount = v.question_count ?? 0;
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div style="font-weight:600;font-size:.875rem;flex:1">${v.title}</div>
        <span class="badge badge-amber" style="flex-shrink:0;font-size:.72rem">${qCount} Q${qCount !== 1 ? 's' : ''}</span>
        <span style="color:var(--text-3);font-size:.8rem;flex-shrink:0">→</span>
      </div>`;
    el.addEventListener('click', () => loadVideoDetail(v));
    vlist.appendChild(el);
  });
  staggerElements('#video-list .card', 45);
}

async function loadVideoDetail(v) {
  _selectedVideo = v;
  const panel = document.getElementById('video-panel');
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  // Expand video panel to full width
  const grid = document.getElementById('browse-grid');
  const coursePanel = document.getElementById('course-panel');
  if (grid) grid.style.gridTemplateColumns = '1fr';
  if (coursePanel) coursePanel.style.display = 'none';

  try {
    _videoData = await API.get(`/api/videos/${v.id}`);
    renderVideoDetail(panel);
  } catch (e) {
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${e.message}</div></div>`;
  }
}

function renderVideoDetail(panel) {
  const d = _videoData;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" id="back-btn">← Back</button>
      <h2 style="flex:1;font-size:.95rem;font-weight:700;line-height:1.3">${d.title}</h2>
      <span class="badge badge-teal">${d.question_count} Qs</span>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="summary">Summary</button>
      <button class="tab-btn" data-tab="concepts">Concepts</button>
      <button class="tab-btn" data-tab="bullets">Takeaways</button>
      <button class="tab-btn" data-tab="notes">My Notes</button>
      <button class="tab-btn" data-tab="chat">AI Chat</button>
    </div>

    <!-- Summary -->
    <div id="tab-summary" class="tab-panel active">
      <div class="summary-prose">
        ${d.summary
          ? d.summary.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${p}</p>`).join('')
          : '<em style="color:var(--text-3)">No summary available</em>'
        }
      </div>
    </div>

    <!-- Concepts -->
    <div id="tab-concepts" class="tab-panel">
      <div class="concept-list">
        ${(d.key_concepts || []).length ? (d.key_concepts).map(c => `
          <div class="concept-item">
            <div class="concept-name">${c.concept || ''}</div>
            <div class="concept-def">${c.definition || ''}</div>
          </div>`).join('') : '<div class="empty-state" style="padding:20px"><div>No concepts yet</div></div>'}
      </div>
    </div>

    <!-- Bullets -->
    <div id="tab-bullets" class="tab-panel">
      <div class="card card-sm">
        <ul class="bullet-list">
          ${(d.bullet_points || []).map(b => `<li>${typeof b === 'string' ? b : JSON.stringify(b)}</li>`).join('')
            || '<li style="color:var(--text-3)">No takeaways available</li>'}
        </ul>
      </div>
    </div>

    <!-- Notes -->
    <div id="tab-notes" class="tab-panel">
      <textarea id="notes-area" class="form-textarea" style="min-height:220px" placeholder="Write your personal notes here…">${d.user_notes || ''}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <button class="btn btn-teal btn-sm" id="save-notes-btn">💾 Save Notes</button>
      </div>
    </div>

    <!-- Chat -->
    <div id="tab-chat" class="tab-panel">
      <div class="chat-window">
        <div class="chat-msgs" id="chat-msgs">
          <div class="chat-bubble ai" style="opacity:.7">
            Ask me anything about <strong>"${d.title}"</strong> 🎓
          </div>
        </div>
        <div class="chat-input-row">
          <input class="chat-input" id="chat-q" placeholder="Ask a question about this video…" />
          <button class="btn btn-teal btn-sm" id="chat-send">Send</button>
        </div>
      </div>
    </div>
  `;

  // Tabs
  panel.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      panel.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Back — restore two-column layout
  document.getElementById('back-btn').addEventListener('click', () => {
    const grid = document.getElementById('browse-grid');
    const coursePanel = document.getElementById('course-panel');
    if (grid) grid.style.gridTemplateColumns = '';
    if (coursePanel) coursePanel.style.display = '';
    renderVideoList(_selectedCourse);
  });

  // Notes
  document.getElementById('save-notes-btn').addEventListener('click', async () => {
    const notes = document.getElementById('notes-area').value;
    try {
      await API.post('/api/notes', { video_id: d.id, notes });
      showToast('Notes saved!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Chat
  const chatInput = document.getElementById('chat-q');
  const chatSend  = document.getElementById('chat-send');

  async function sendChat() {
    const q = chatInput.value.trim();
    if (!q) return;
    chatInput.value = '';
    appendBubble(q, 'user');
    const thinking = appendBubble('Thinking…', 'ai');
    chatSend.disabled = true;
    try {
      const res = await API.post('/api/ask', { video_id: d.id, question: q });
      thinking.textContent = res.answer;
    } catch (e) {
      thinking.textContent = `❌ ${e.message}`;
      thinking.style.color = 'var(--coral)';
    } finally { chatSend.disabled = false; chatInput.focus(); }
  }
  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
}

function appendBubble(text, role) {
  const msgs = document.getElementById('chat-msgs');
  const b = document.createElement('div');
  b.className = `chat-bubble ${role}`;
  b.textContent = text;
  msgs.appendChild(b);
  msgs.scrollTop = msgs.scrollHeight;
  return b;
}
