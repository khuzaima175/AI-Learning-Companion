import { API, showToast, ytThumb, icon, skel } from '../app.js';

let _courses = [];
let _selectedCourse = null;
let _selectedVideo = null;
let _videoData = null;
let _autosaveTimer = null;

export async function renderBrowse(container) {
  container.innerHTML = `
    <!-- Header Banner with AI Visual Artwork -->
    <div class="hero-art-banner rev" style="--i:0">
      <img src="/static/img/course_library_art.jpg" alt="Course Archive" class="hero-art-bg" />
      <div class="hero-art-content">
        <div class="pill pill-sky" style="margin-bottom:12px;font-size:0.72rem">
          ${icon('library', '', 'width:12px;height:12px')}
          <span>Digital Knowledge Archive</span>
        </div>
        <h1 class="page-title" style="font-size:2.4rem;margin-bottom:8px">Course <em>Library</em></h1>
        <p class="page-subtitle" style="margin-top:0;font-size:0.92rem;max-width:540px">
          Structured lecture summaries, key concepts, markdown notes, and AI question assistant.
        </p>
        <div style="display:flex;align-items:center;gap:12px;margin-top:18px">
          <button class="btn btn-primary btn-sm" onclick="window.navigate('add-video')">
            ${icon('plus', '', 'width:14px;height:14px')}
            <span>Add Lecture</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Search Input with Clear Button -->
    <div class="card card-xs rev" style="padding:10px 18px;display:flex;align-items:center;gap:12px;margin-bottom:24px;--i:1">
      <span style="color:var(--faint)">${icon('library', '', 'width:18px;height:18px')}</span>
      <input id="browse-search" class="form-input input" 
             placeholder="Search courses, lecture titles, or concepts..." 
             style="border:none;background:transparent;padding:6px 0;box-shadow:none" />
      <button id="browse-search-clear" class="btn btn-ghost btn-sm" style="display:none;padding:2px 6px">
        ${icon('x', '', 'width:13px;height:13px')}
      </button>
    </div>

    <!-- Body Container with Layout Skeletons -->
    <div id="browse-body">
      <div class="browse-split">
        <div style="display:flex;flex-direction:column;gap:10px">
          ${skel('100%', 58)}
          ${skel('100%', 58)}
          ${skel('100%', 58)}
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card card-sm" style="display:flex;gap:14px;align-items:center">
            ${skel(96, 54, 10)}
            <div style="flex:1;display:flex;flex-direction:column;gap:8px">
              ${skel('80%', 18)}
              ${skel('45%', 14)}
            </div>
          </div>
          <div class="card card-sm" style="display:flex;gap:14px;align-items:center">
            ${skel(96, 54, 10)}
            <div style="flex:1;display:flex;flex-direction:column;gap:8px">
              ${skel('70%', 18)}
              ${skel('35%', 14)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('browse-search');
  const searchClear = document.getElementById('browse-search-clear');

  searchInput?.addEventListener('input', e => {
    const val = e.target.value;
    searchClear.style.display = val ? 'block' : 'none';
    renderCourseList(val.toLowerCase().trim());
  });

  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    renderCourseList('');
  });

  try {
    _courses = await API.get('/api/courses');
    renderCourseList();
  } catch (e) {
    document.getElementById('browse-body').innerHTML = `
      <div class="card" style="text-align:center;padding:48px;color:var(--coral)">
        Error loading library: ${e.message}
      </div>`;
  }
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark style="background:rgba(45,212,168,0.25);color:var(--teal);border-radius:2px;padding:0 2px">$1</mark>');
}

function renderCourseList(filter = '') {
  const body = document.getElementById('browse-body');
  if (!body) return;

  let filtered = _courses;
  if (filter) {
    filtered = _courses.map(c => ({
      ...c,
      videos: (c.videos || []).filter(v => v.title.toLowerCase().includes(filter)),
    })).filter(c => c.name.toLowerCase().includes(filter) || c.videos.length > 0);
  }

  if (!filtered.length) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:56px 24px">
        <div class="icon-chip glass" style="width:48px;height:48px;margin:0 auto 14px">
          ${icon('help-circle', '', 'width:24px;height:24px;color:var(--muted)')}
        </div>
        <h3 style="font-size:1.4rem">No results found</h3>
        <p style="font-size:0.88rem;color:var(--muted);margin-top:6px">No courses or lectures matched "<strong>${filter}</strong>"</p>
        <button class="btn btn-ghost btn-sm" onclick="window.navigate('add-video')" style="margin-top:18px">
          <span>Add New Video</span>
          ${icon('plus', '', 'width:13px;height:13px')}
        </button>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="browse-split" id="browse-split-grid">
      <!-- Courses Column (Left) -->
      <div id="course-col">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span class="mono-meta">COURSES (${filtered.length})</span>
        </div>
        <div id="course-cards-list" style="display:flex;flex-direction:column;gap:8px"></div>
      </div>

      <!-- Videos & Detail Column (Right) -->
      <div id="video-col">
        <div class="card" style="padding:64px 24px;text-align:center">
          <div class="icon-chip teal" style="width:52px;height:52px;margin:0 auto 16px">
            ${icon('library', '', 'width:26px;height:26px')}
          </div>
          <h3 style="font-size:1.6rem">Select a Course</h3>
          <p style="font-size:0.9rem;color:var(--muted);max-width:360px;margin:8px auto 0">
            Choose a course on the left to review video lectures, notes, and AI summaries.
          </p>
        </div>
      </div>
    </div>`;

  const list = document.getElementById('course-cards-list');
  filtered.forEach(c => {
    const el = document.createElement('div');
    el.className = 'course-card-h';
    el.innerHTML = `
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:0.95rem;color:var(--text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
          ${highlightMatch(c.name, filter)}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <span style="font-size:0.78rem;color:var(--muted)">${c.video_count} lecture${c.video_count !== 1 ? 's' : ''}</span>
          <span class="pill pill-teal" style="font-size:0.65rem">${c.question_count} Qs</span>
        </div>
      </div>
      <span style="color:var(--faint)">${icon('chevron-right', '', 'width:16px;height:16px')}</span>
    `;

    el.addEventListener('click', () => {
      document.querySelectorAll('#course-cards-list .course-card-h').forEach(card => {
        card.style.borderColor = 'var(--line)';
        card.style.background = 'var(--sf2)';
      });
      el.style.borderColor = 'var(--teal)';
      el.style.background = 'var(--sf3)';
      _selectedCourse = c;
      renderVideoList(c, filter);
    });

    list.appendChild(el);
  });

  // Auto-select first course if none selected
  if (!_selectedCourse && filtered.length > 0) {
    const firstCard = list.querySelector('.course-card-h');
    if (firstCard) firstCard.click();
  } else if (_selectedCourse) {
    const matching = filtered.find(c => c.id === _selectedCourse.id);
    if (matching) renderVideoList(matching, filter);
  }
}

function renderVideoList(course, filter = '') {
  const panel = document.getElementById('video-col');
  if (!panel) return;

  const videos = filter
    ? (course.videos || []).filter(v => v.title.toLowerCase().includes(filter))
    : (course.videos || []);

  if (!videos.length) {
    panel.innerHTML = `
      <div class="card" style="padding:48px 24px;text-align:center">
        <div class="icon-chip glass" style="width:40px;height:40px;margin:0 auto 12px">
          ${icon('video', '', 'width:20px;height:20px')}
        </div>
        <h3 style="font-size:1.3rem">No lectures in this course</h3>
        <p style="font-size:0.85rem;color:var(--muted);margin-top:4px">Add your first video lecture to start studying.</p>
        <button class="btn btn-primary btn-sm" onclick="window.navigate('add-video')" style="margin-top:16px">
          <span>Add Lecture</span>
        </button>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <h3 style="font-size:1.45rem">${course.name}</h3>
        <span class="mono-meta">${videos.length} processed lecture${videos.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div id="video-rows-list" style="display:flex;flex-direction:column;gap:10px"></div>
  `;

  const vlist = document.getElementById('video-rows-list');
  videos.forEach(v => {
    const el = document.createElement('div');
    el.className = 'video-item-card';

    const thumbSrc = v.video_id && !v.video_id.startsWith('manual_')
      ? ytThumb(v.video_id)
      : '';

    el.innerHTML = `
      <div style="position:relative;width:96px;height:54px;flex-shrink:0;border-radius:var(--r-thumb);overflow:hidden;background:#000">
        ${thumbSrc ? `
          <img class="video-thumb-mini thumb" src="${thumbSrc}" alt="Thumbnail" />
        ` : `
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--sf3);color:var(--muted)">
            ${icon('video', '', 'width:20px;height:20px')}
          </div>
        `}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:0.92rem;color:var(--text);line-height:1.4;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">
          ${highlightMatch(v.title, filter)}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <span class="pill pill-amber" style="font-size:0.65rem">${v.question_count ?? 20} Qs</span>
          <span class="mono-meta" style="font-size:0.68rem">READY</span>
        </div>
      </div>
      <span style="color:var(--faint)">${icon('chevron-right', '', 'width:16px;height:16px')}</span>
    `;

    el.addEventListener('click', () => loadVideoDetail(v, course));
    vlist.appendChild(el);
  });
}

async function loadVideoDetail(v, course) {
  _selectedVideo = v;
  const panel = document.getElementById('video-col');
  const courseCol = document.getElementById('course-col');
  const splitGrid = document.getElementById('browse-split-grid');

  if (splitGrid) splitGrid.style.gridTemplateColumns = '1fr';
  if (courseCol) courseCol.style.display = 'none';

  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;padding:16px 0">
      ${skel('40%', 32)}
      ${skel('20%', 16)}
      ${skel('100%', 44)}
      <div class="card" style="padding:28px;display:flex;flex-direction:column;gap:12px">
        ${skel('100%', 20)}
        ${skel('95%', 20)}
        ${skel('90%', 20)}
        ${skel('85%', 20)}
      </div>
    </div>`;

  try {
    _videoData = await API.get(`/api/videos/${v.id}`);
    renderVideoDetail(panel, course);
  } catch (e) {
    panel.innerHTML = `
      <div class="card" style="text-align:center;padding:48px;color:var(--coral)">
        Error: ${e.message}
      </div>`;
  }
}

function renderVideoDetail(panel, course) {
  const d = _videoData;
  const ytLink = d.video_id && !d.video_id.startsWith('manual_')
    ? `https://www.youtube.com/watch?v=${d.video_id}`
    : null;

  const wordCount = (d.summary || '').split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 180));

  panel.innerHTML = `
    <!-- Top Bar Navigation -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" id="detail-back-btn">
        ${icon('arrow-left', '', 'width:14px;height:14px')}
        <span>Back to Lectures</span>
      </button>

      <div style="display:flex;align-items:center;gap:10px">
        <span class="pill pill-teal">${d.question_count || 20} Qs</span>
        ${ytLink ? `
          <a href="${ytLink}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="color:var(--teal)">
            <span>Watch on YouTube</span>
            ${icon('external-link', '', 'width:13px;height:13px')}
          </a>` : ''}
      </div>
    </div>

    <!-- Title & Metadata -->
    <div style="margin-bottom:24px">
      <h2 style="font-size:1.85rem;line-height:1.25">${d.title}</h2>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">
        <span class="mono-meta">COURSE: ${course?.name || 'Library'}</span>
        <span class="mono-meta">·</span>
        <span class="mono-meta">~${readTime} MIN READ</span>
        <span class="mono-meta">·</span>
        <span class="mono-meta">${(d.key_concepts || []).length} CONCEPTS</span>
      </div>
    </div>

    <!-- Segmented Tab Bar -->
    <div class="tabs-segmented" id="detail-tabs-seg">
      <button class="tab-btn-v2 active" data-tab="summary">
        ${icon('book-open', '', 'width:14px;height:14px')}
        <span>Summary</span>
      </button>
      <button class="tab-btn-v2" data-tab="concepts">
        ${icon('layers', '', 'width:14px;height:14px')}
        <span>Concepts (${(d.key_concepts || []).length})</span>
      </button>
      <button class="tab-btn-v2" data-tab="takeaways">
        ${icon('check', '', 'width:14px;height:14px')}
        <span>Takeaways</span>
      </button>
      <button class="tab-btn-v2" data-tab="notes">
        ${icon('edit-3', '', 'width:14px;height:14px')}
        <span>My Notes</span>
      </button>
      <button class="tab-btn-v2" data-tab="chat">
        ${icon('message-square', '', 'width:14px;height:14px')}
        <span>AI Assistant</span>
      </button>
    </div>

    <!-- Tab 1: Summary -->
    <div id="tab-pane-summary" class="tab-pane" style="display:block">
      <div class="card" style="line-height:1.8;padding:28px;font-size:0.95rem;color:var(--text)">
        ${formatSummaryProse(d.summary)}
      </div>
    </div>

    <!-- Tab 2: Concepts -->
    <div id="tab-pane-concepts" class="tab-pane" style="display:none">
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:16px">
        ${(d.key_concepts || []).map((c, i) => `
          <div class="card card-sm" style="display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span class="mono-meta" style="color:var(--teal)">#${String(i + 1).padStart(2, '0')}</span>
                <span class="pill pill-teal" style="font-size:0.62rem">Concept</span>
              </div>
              <div style="font-weight:600;font-size:0.95rem;color:var(--text);margin-bottom:6px">${c.concept || ''}</div>
              <div style="font-size:0.85rem;color:var(--muted);line-height:1.5">${c.definition || ''}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="window.navigate('flashcards')" style="margin-top:14px;justify-content:space-between">
              <span>Drill in Flashcards</span>
              ${icon('arrow-right', '', 'width:13px;height:13px')}
            </button>
          </div>`).join('')}
      </div>
    </div>

    <!-- Tab 3: Takeaways -->
    <div id="tab-pane-takeaways" class="tab-pane" style="display:none">
      <div class="card" style="padding:24px 28px">
        <div style="display:flex;flex-direction:column;gap:14px">
          ${(d.bullet_points || []).map((b, i) => `
            <div style="display:flex;align-items:flex-start;gap:14px;padding-bottom:12px;border-bottom:1px solid var(--line)">
              <div class="mono-meta" style="color:var(--amber);margin-top:2px;font-weight:700">
                ${String(i + 1).padStart(2, '0')}
              </div>
              <div style="font-size:0.92rem;color:var(--text);line-height:1.6;flex:1">
                ${typeof b === 'string' ? b : JSON.stringify(b)}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Tab 4: My Notes Editor -->
    <div id="tab-pane-notes" class="tab-pane" style="display:none">
      <div class="notes-toolbar">
        <button class="tb-btn" data-action="bold" title="Bold"><strong>B</strong></button>
        <button class="tb-btn" data-action="italic" title="Italic"><em>I</em></button>
        <button class="tb-btn" data-action="h2" title="Heading">H2</button>
        <button class="tb-btn" data-action="bullet" title="Bullet List">• List</button>
        <div style="flex:1"></div>
        <span id="notes-save-status" class="mono-meta" style="color:var(--faint)">All changes saved</span>
        <button class="btn btn-primary btn-sm" id="notes-save-btn" style="padding:4px 10px;font-size:0.75rem;margin-left:8px">
          <span class="spin" id="notes-spin" style="display:none"></span>
          <span id="notes-save-lbl">Save</span>
        </button>
      </div>
      <textarea id="notes-editor-input" class="form-textarea notes-editor-textarea input" 
                placeholder="Write notes, timestamps, or equations from this lecture..." 
                style="min-height:280px;font-size:0.9rem">${d.user_notes || ''}</textarea>
    </div>

    <!-- Tab 5: AI Chat Assistant -->
    <div id="tab-pane-chat" class="tab-pane" style="display:none">
      <div class="chat-window-v2">
        <div style="padding:12px 18px;border-bottom:1px solid var(--line);background:var(--sf2);display:flex;align-items:center;gap:10px">
          <div class="icon-chip teal" style="width:28px;height:28px">${icon('sparkles', '', 'width:14px;height:14px')}</div>
          <div>
            <div style="font-weight:600;font-size:0.85rem">Lecture AI Tutor</div>
            <div class="mono-meta" style="font-size:0.65rem">CONTEXT: TRANSCRIPT LOADED</div>
          </div>
        </div>

        <div id="browse-chat-msgs" style="min-height:240px;max-height:380px;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px">
          <div class="chat-bubble-v2 ai">
            Ask me anything about <strong>"${d.title}"</strong>. I can summarize tricky parts, provide real-world analogies, or explain mechanisms step-by-step.
          </div>
        </div>

        <div style="display:flex;gap:8px;padding:10px 16px;border-top:1px solid var(--line);background:var(--sf1);overflow-x:auto">
          <button class="pill pill-teal chat-starter-btn" data-prompt="Explain the core concept in simple terms">Explain simply</button>
          <button class="pill pill-amber chat-starter-btn" data-prompt="Give me 3 practice questions from this lecture">Quiz me</button>
          <button class="pill pill-sky chat-starter-btn" data-prompt="What are the real-world applications of this?">Real-world applications</button>
        </div>

        <div style="display:flex;gap:10px;padding:14px 18px;border-top:1px solid var(--line);background:var(--sf2)">
          <input id="browse-chat-input" class="form-input input" placeholder="Ask a question about this lecture..." />
          <button id="browse-chat-send" class="btn btn-primary btn-sm" style="padding:0 18px">
            <span class="spin" id="chat-spin" style="display:none"></span>
            <span id="chat-send-lbl">${icon('send', '', 'width:16px;height:16px')}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Back Button
  document.getElementById('detail-back-btn')?.addEventListener('click', () => {
    const splitGrid = document.getElementById('browse-split-grid');
    const courseCol = document.getElementById('course-col');
    if (splitGrid) splitGrid.style.gridTemplateColumns = '320px 1fr';
    if (courseCol) courseCol.style.display = 'block';
    renderVideoList(_selectedCourse);
  });

  // Tab Controls
  panel.querySelectorAll('.tab-btn-v2').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.tab-btn-v2').forEach(b => b.classList.remove('active'));
      panel.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
      btn.classList.add('active');
      const target = document.getElementById(`tab-pane-${btn.dataset.tab}`);
      if (target) target.style.display = 'block';
    });
  });

  // Notes Autosave
  const notesArea = document.getElementById('notes-editor-input');
  const saveStatus = document.getElementById('notes-save-status');
  const notesSaveBtn = document.getElementById('notes-save-btn');
  const notesSpin = document.getElementById('notes-spin');
  const notesSaveLbl = document.getElementById('notes-save-lbl');

  notesArea?.addEventListener('input', () => {
    if (saveStatus) {
      saveStatus.textContent = 'Saving changes…';
      saveStatus.style.color = 'var(--amber)';
    }
    clearTimeout(_autosaveTimer);
    _autosaveTimer = setTimeout(async () => {
      try {
        await API.post('/api/notes', { video_id: d.id, notes: notesArea.value });
        if (saveStatus) {
          saveStatus.textContent = 'All changes saved';
          saveStatus.style.color = 'var(--teal)';
        }
      } catch {
        if (saveStatus) saveStatus.textContent = 'Auto-save failed';
      }
    }, 900);
  });

  notesSaveBtn?.addEventListener('click', async () => {
    notesSaveBtn.classList.add('loading');
    notesSaveBtn.disabled = true;
    if (notesSpin) notesSpin.style.display = 'inline-block';
    if (notesSaveLbl) notesSaveLbl.textContent = 'Saving…';

    try {
      await API.post('/api/notes', { video_id: d.id, notes: notesArea.value });
      if (saveStatus) {
        saveStatus.textContent = 'All changes saved';
        saveStatus.style.color = 'var(--teal)';
      }
      showToast('Notes saved successfully', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      notesSaveBtn.classList.remove('loading');
      notesSaveBtn.disabled = false;
      if (notesSpin) notesSpin.style.display = 'none';
      if (notesSaveLbl) notesSaveLbl.textContent = 'Save';
    }
  });

  // Notes Quick Format Buttons
  panel.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!notesArea) return;
      const start = notesArea.selectionStart;
      const end = notesArea.selectionEnd;
      const text = notesArea.value;
      const sel = text.substring(start, end);
      let rep = '';
      switch (btn.dataset.action) {
        case 'bold': rep = `**${sel || 'bold text'}**`; break;
        case 'italic': rep = `*${sel || 'italic text'}*`; break;
        case 'h2': rep = `\n## ${sel || 'Section Title'}\n`; break;
        case 'bullet': rep = `\n- ${sel || 'List item'}`; break;
      }
      notesArea.value = text.substring(0, start) + rep + text.substring(end);
      notesArea.focus();
      notesArea.dispatchEvent(new Event('input'));
    });
  });

  // AI Chat Handler
  const chatInput = document.getElementById('browse-chat-input');
  const chatSend = document.getElementById('browse-chat-send');
  const chatMsgs = document.getElementById('browse-chat-msgs');
  const chatSpin = document.getElementById('chat-spin');
  const chatSendLbl = document.getElementById('chat-send-lbl');

  function appendChatBubble(text, isUser = false) {
    const b = document.createElement('div');
    b.className = `chat-bubble-v2 ${isUser ? 'user' : 'ai'}`;
    b.innerHTML = text;
    chatMsgs.appendChild(b);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    return b;
  }

  async function sendChatQuery(qText) {
    const q = (qText || chatInput?.value || '').trim();
    if (!q) return;
    if (chatInput) chatInput.value = '';

    appendChatBubble(q, true);
    const typing = appendChatBubble(`
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `, false);

    if (chatSend) chatSend.disabled = true;
    if (chatSpin) chatSpin.style.display = 'inline-block';
    if (chatSendLbl) chatSendLbl.style.display = 'none';

    try {
      const res = await API.post('/api/ask', { video_id: d.id, question: q });
      typing.innerHTML = res.answer || 'No answer found in transcript.';
    } catch (e) {
      typing.innerHTML = `<span style="color:var(--coral)">Error: ${e.message}</span>`;
    } finally {
      if (chatSend) chatSend.disabled = false;
      if (chatSpin) chatSpin.style.display = 'none';
      if (chatSendLbl) chatSendLbl.style.display = 'inline';
      if (chatInput) chatInput.focus();
    }
  }

  chatSend?.addEventListener('click', () => sendChatQuery());
  chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatQuery(); });

  panel.querySelectorAll('.chat-starter-btn').forEach(btn => {
    btn.addEventListener('click', () => sendChatQuery(btn.dataset.prompt));
  });
}

function formatSummaryProse(summaryText) {
  if (!summaryText) return '<p style="color:var(--faint)">No summary available for this lecture.</p>';
  const paragraphs = summaryText.split(/\n+/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => `<p style="margin-bottom:1.2em">${p}</p>`).join('');
}
