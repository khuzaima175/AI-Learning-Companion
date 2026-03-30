import { API, showToast, staggerElements } from '../app.js';

export async function renderFlashcards(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap amber">🃏</div>
      <div class="page-title-text">
        <h1 class="amber-title">Flashcards</h1>
        <p class="page-subtitle">Flip through key concepts — click any card to reveal its definition</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="card card-sm enter" style="animation-delay:80ms;margin-bottom:24px">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
        <div class="form-group" style="flex:1;min-width:180px;margin-bottom:0">
          <label class="form-label">Course</label>
          <select id="fc-course" class="form-select">
            <option value="">Loading…</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:160px;margin-bottom:0">
          <label class="form-label">Video</label>
          <select id="fc-video" class="form-select" disabled>
            <option value="">Select course first</option>
          </select>
        </div>
        <button class="btn btn-amber" id="fc-load-btn" disabled>Load Flashcards</button>
      </div>
    </div>

    <div id="fc-body"></div>
  `;

  await populateCourses();
}

async function populateCourses() {
  try {
    const courses = await API.get('/api/courses');
    const sel = document.getElementById('fc-course');

    if (!courses.length) {
      sel.innerHTML = '<option value="">No courses yet</option>';
      return;
    }

    sel.innerHTML = '<option value="">Select a course…</option>';
    for (const c of courses) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', () => {
      const cid = sel.value;
      const vid = document.getElementById('fc-video');
      const btn = document.getElementById('fc-load-btn');
      if (!cid) { vid.disabled = true; vid.innerHTML = '<option>Select course first</option>'; btn.disabled = true; return; }
      const course = courses.find(c => String(c.id) === cid);
      vid.disabled = false;
      vid.innerHTML = '<option value="">All videos</option>' +
        (course?.videos || []).map(v => `<option value="${v.id}">${v.title}</option>`).join('');
      btn.disabled = false;
    });

    document.getElementById('fc-load-btn').addEventListener('click', async () => {
      const cid = document.getElementById('fc-course').value;
      const vid = document.getElementById('fc-video').value;
      if (!cid) { showToast('Select a course first', 'error'); return; }
      await loadFlashcards(vid || null, cid);
    });
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadFlashcards(videoId, courseId) {
  const body = document.getElementById('fc-body');
  body.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading flashcards…</span></div>';

  try {
    let concepts = [];

    if (videoId) {
      const v = await API.get(`/api/videos/${videoId}`);
      concepts = (v.key_concepts || []).map(c => ({ ...c, source: v.title }));
    } else {
      const courses = await API.get('/api/courses');
      const course = courses.find(c => String(c.id) === String(courseId));
      for (const v of (course?.videos || [])) {
        try {
          const vd = await API.get(`/api/videos/${v.id}`);
          const kc = (vd.key_concepts || []).map(c => ({ ...c, source: vd.title }));
          concepts.push(...kc);
        } catch { /**/ }
      }
    }

    if (!concepts.length) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">🃏</div><div>No key concepts found.</div><div class="empty-sub" style="margin-top:6px">Process a video first to generate concepts.</div></div>`;
      return;
    }

    // Shuffle
    concepts.sort(() => Math.random() - 0.5);

    renderCardDeck(concepts);
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${e.message}</div></div>`;
  }
}

function renderCardDeck(concepts) {
  const body = document.getElementById('fc-body');
  let idx = 0;

  body.innerHTML = `
    <!-- Progress -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <span style="font-size:.82rem;color:var(--text-2)" id="fc-progress">Card 1 of ${concepts.length}</span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" id="fc-shuffle">🔀 Shuffle</button>
        <button class="btn btn-ghost btn-sm" id="fc-restart">↩ Restart</button>
      </div>
    </div>

    <div class="progress-track" style="margin-bottom:24px">
      <div class="progress-fill amber" id="fc-bar" style="width:${(1/concepts.length)*100}%"></div>
    </div>

    <!-- Flashcard -->
    <div class="flashcard-scene" id="fc-scene">
      <div class="flashcard" id="fc-card">
        <div class="flashcard-face flashcard-front">
          <div class="flashcard-hint">Tap to reveal definition</div>
          <div class="flashcard-term" id="fc-term"></div>
          <div style="margin-top:20px;font-size:.72rem;color:var(--text-3)" id="fc-source"></div>
        </div>
        <div class="flashcard-face flashcard-back">
          <div class="flashcard-hint">Definition</div>
          <div class="flashcard-def" id="fc-def"></div>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;flex-wrap:wrap">
      <button class="btn btn-ghost" id="fc-prev">← Previous</button>
      <span style="color:var(--text-3);font-size:.82rem;align-self:center" id="fc-subprogress">${idx+1}/${concepts.length}</span>
      <button class="btn btn-teal" id="fc-next">Next →</button>
    </div>

    <!-- Grid preview -->
    <div class="section-hdr" style="margin-top:36px">
      <div class="section-title">All Cards</div>
      <span class="badge badge-amber">${concepts.length} concepts</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:4px" id="fc-grid"></div>
  `;

  function showCard(i, flip = false) {
    idx = i;
    const c = concepts[i];
    document.getElementById('fc-term').textContent    = c.concept || '';
    document.getElementById('fc-def').textContent     = c.definition || '';
    document.getElementById('fc-source').textContent  = c.source ? `📹 ${c.source}` : '';
    document.getElementById('fc-progress').textContent= `Card ${i + 1} of ${concepts.length}`;
    document.getElementById('fc-subprogress').textContent = `${i+1}/${concepts.length}`;
    document.getElementById('fc-bar').style.width     = `${((i + 1) / concepts.length) * 100}%`;
    const card = document.getElementById('fc-card');
    card.classList.remove('flipped');
    if (flip) setTimeout(() => card.classList.add('flipped'), 50);
  }

  showCard(0);

  document.getElementById('fc-card').addEventListener('click', () => {
    document.getElementById('fc-card').classList.toggle('flipped');
  });

  document.getElementById('fc-next').addEventListener('click', () => {
    if (idx < concepts.length - 1) showCard(idx + 1);
    else showToast('You reached the end! 🎉', 'success');
  });
  document.getElementById('fc-prev').addEventListener('click', () => {
    if (idx > 0) showCard(idx - 1);
  });
  document.getElementById('fc-shuffle').addEventListener('click', () => {
    concepts.sort(() => Math.random() - 0.5);
    buildGrid(); showCard(0);
  });
  document.getElementById('fc-restart').addEventListener('click', () => showCard(0));

  // Grid of all concepts
  function buildGrid() {
    const grid = document.getElementById('fc-grid');
    grid.innerHTML = '';
    concepts.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card card-xs';
      el.style.cursor = 'pointer';
      el.style.transition = 'all 0.2s ease';
      el.style.animationDelay = `${i * 30}ms`;
      el.innerHTML = `
        <div style="font-size:.72rem;color:var(--teal);font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">${c.concept || ''}</div>
        <div style="font-size:.8rem;color:var(--text-2);line-height:1.5">${(c.definition || '').slice(0, 80)}${(c.definition?.length > 80) ? '…' : ''}</div>
      `;
      el.addEventListener('click', () => {
        showCard(i, true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      grid.appendChild(el);
    });
    staggerElements('#fc-grid .card', 30);
  }
  buildGrid();
}
