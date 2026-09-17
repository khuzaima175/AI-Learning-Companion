import { API, showToast, icon, skel } from '../app.js';

let _keyListener = null;

export async function renderFlashcards(container) {
  if (_keyListener) {
    document.removeEventListener('keydown', _keyListener);
    _keyListener = null;
  }

  container.innerHTML = `
    <!-- Header Banner with AI Visual Artwork -->
    <div class="hero-art-banner rev" style="--i:0">
      <img src="/static/img/flashcards_deck_art.jpg" alt="3D Flashcard Matrix" class="hero-art-bg" />
      <div class="hero-art-content">
        <div class="pill pill-sky" style="margin-bottom:12px;font-size:0.72rem">
          ${icon('layers', '', 'width:12px;height:12px')}
          <span>Concept Retention Arena</span>
        </div>
        <h1 class="page-title" style="font-size:2.4rem;margin-bottom:8px">3D <em>Flashcards</em></h1>
        <p class="page-subtitle" style="margin-top:0;font-size:0.92rem;max-width:540px">
          Interactive concept flip deck with spacebar shortcuts, interval ratings, and tactile 3D perspective.
        </p>
      </div>
    </div>

    <!-- Filters Deck Picker -->
    <div class="card card-sm rev" style="margin-bottom:24px;--i:1">
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end">
        <div class="form-group" style="flex:1;min-width:200px;margin-bottom:0">
          <label class="form-label">Course</label>
          <select id="fc-course" class="form-select">
            <option value="">Select course…</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:200px;margin-bottom:0">
          <label class="form-label">Lecture Video</label>
          <select id="fc-video" class="form-select" disabled>
            <option value="">Select course first</option>
          </select>
        </div>
        <button class="btn btn-primary" id="fc-load-btn" disabled>
          <span class="spin" id="fc-btn-spin" style="display:none"></span>
          <span id="fc-btn-lbl">Load Deck</span>
        </button>
      </div>
    </div>

    <div id="fc-body">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${skel(160, 16)}
          ${skel(140, 28, 6)}
        </div>
        ${skel('100%', 8, 99)}
        <div class="flip-scene" style="max-width:760px;height:360px">
          ${skel('100%', 360, 20)}
        </div>
      </div>
    </div>
  `;

  await populateCourses();
}

async function populateCourses() {
  try {
    const courses = await API.get('/api/courses');
    const sel = document.getElementById('fc-course');
    if (!sel) return;

    if (!courses.length) {
      sel.innerHTML = '<option value="">No courses yet</option>';
      return;
    }

    sel.innerHTML = '<option value="">Select a course…</option>';
    for (const c of courses) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.video_count} videos)`;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', () => {
      const cid = sel.value;
      const vid = document.getElementById('fc-video');
      const btn = document.getElementById('fc-load-btn');
      if (!cid) {
        if (vid) { vid.disabled = true; vid.innerHTML = '<option>Select course first</option>'; }
        if (btn) btn.disabled = true;
        return;
      }
      const course = courses.find(c => String(c.id) === cid);
      if (vid) {
        vid.disabled = false;
        vid.innerHTML = '<option value="">All Lectures in Course</option>' +
          (course?.videos || []).map(v => `<option value="${v.id}">${v.title}</option>`).join('');
      }
      if (btn) btn.disabled = false;
    });

    document.getElementById('fc-load-btn')?.addEventListener('click', async () => {
      const cid = document.getElementById('fc-course').value;
      const vid = document.getElementById('fc-video').value;
      if (!cid) { showToast('Select a course first', 'error'); return; }
      await loadFlashcards(vid || null, cid);
    });

    if (courses.length > 0) {
      sel.value = courses[0].id;
      sel.dispatchEvent(new Event('change'));
      await loadFlashcards(null, courses[0].id);
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadFlashcards(videoId, courseId) {
  const body = document.getElementById('fc-body');
  const btn = document.getElementById('fc-load-btn');
  const btnSpin = document.getElementById('fc-btn-spin');
  const btnLbl = document.getElementById('fc-btn-lbl');

  if (btn) {
    btn.classList.add('loading');
    if (btnSpin) btnSpin.style.display = 'inline-block';
    if (btnLbl) btnLbl.textContent = 'Loading Deck…';
  }

  if (body) {
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${skel(160, 16)}
          ${skel(140, 28, 6)}
        </div>
        ${skel('100%', 8, 99)}
        <div class="flip-scene" style="max-width:760px;height:360px">
          ${skel('100%', 360, 20)}
        </div>
      </div>`;
  }

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
      if (body) {
        body.innerHTML = `
          <div class="card" style="text-align:center;padding:48px 24px">
            <div class="icon-chip glass" style="width:48px;height:48px;margin:0 auto 14px">
              ${icon('layers', '', 'width:24px;height:24px')}
            </div>
            <h3 style="font-size:1.4rem">No concepts found</h3>
            <p style="font-size:0.88rem;color:var(--muted);margin-top:6px">This lecture doesn't have extracted key concepts yet.</p>
            <button class="btn btn-primary btn-sm" onclick="window.navigate('add-video')" style="margin-top:18px">Add Lecture</button>
          </div>`;
      }
      return;
    }

    concepts.sort(() => Math.random() - 0.5);
    renderCardDeck(concepts);
  } catch (e) {
    if (body) {
      body.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:var(--coral)">
          Error: ${e.message}
        </div>`;
    }
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      if (btnSpin) btnSpin.style.display = 'none';
      if (btnLbl) btnLbl.textContent = 'Load Deck';
    }
  }
}

function renderCardDeck(concepts) {
  const body = document.getElementById('fc-body');
  let idx = 0;
  const seenSet = new Set([0]);

  body.innerHTML = `
    <!-- Top Progress Row -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span class="mono-meta" id="fc-progress">CARD 1 OF ${concepts.length}</span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" id="fc-shuffle" style="padding:5px 10px;font-size:0.8rem">
          ${icon('rotate-cw', '', 'width:13px;height:13px')}
          <span>Shuffle</span>
        </button>
        <button class="btn btn-ghost btn-sm" id="fc-restart" style="padding:5px 10px;font-size:0.8rem">
          <span>Restart</span>
        </button>
      </div>
    </div>

    <!-- Progress Track -->
    <div class="progress-track" style="margin-bottom:20px">
      <div class="progress-fill" id="fc-progress-fill" style="width:${(1 / concepts.length) * 100}%"></div>
    </div>

    <!-- 3D Flashcard Scene -->
    <div class="flip-scene" id="fc-scene" style="margin-bottom:20px">
      <div class="flip-card" id="fc-card">
        
        <!-- Front Face -->
        <div class="face front">
          <span class="pill pill-teal" style="font-size:0.7rem">KEY CONCEPT</span>
          <div class="serif-title" style="font-size:2.8rem;color:var(--text);margin:10px 0" id="fc-term"></div>
          <div class="mono-meta" style="color:var(--faint);font-size:0.75rem" id="fc-source"></div>
          <div style="margin-top:auto;display:flex;align-items:center;gap:8px">
            <kbd class="kbd">SPACE</kbd>
            <span class="mono-meta" style="font-size:0.7rem">OR CLICK TO FLIP</span>
          </div>
        </div>

        <!-- Back Face -->
        <div class="face back">
          <span class="pill pill-amber" style="font-size:0.7rem">DEFINITION &amp; MECHANISM</span>
          <div style="font-size:1.15rem;color:var(--text);line-height:1.7;max-width:560px;margin:10px 0" id="fc-def"></div>
          <div style="margin-top:auto;display:flex;align-items:center;gap:8px">
            <kbd class="kbd">SPACE</kbd>
            <span class="mono-meta" style="font-size:0.7rem">OR CLICK TO FLIP BACK</span>
          </div>
        </div>

      </div>
    </div>

    <!-- Navigation Action Row -->
    <div style="display:flex;gap:14px;justify-content:center;align-items:center;margin-top:16px">
      <button class="btn btn-ghost btn-sm" id="fc-prev">
        ${icon('arrow-left', '', 'width:14px;height:14px')}
        <span>Previous</span>
      </button>
      <span class="mono-meta" id="fc-subprogress" style="padding:0 8px;font-size:0.85rem">${idx + 1} / ${concepts.length}</span>
      <button class="btn btn-primary btn-sm" id="fc-next">
        <span>Next</span>
        ${icon('arrow-right', '', 'width:14px;height:14px')}
      </button>
    </div>

    <!-- Deck Overview Grid -->
    <div style="margin-top:40px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <h3 style="font-size:1.3rem">Deck Overview</h3>
      <span class="pill pill-teal">${concepts.length} concepts</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:12px" id="fc-grid"></div>
  `;

  function showCard(i, flip = false) {
    idx = i;
    seenSet.add(i);
    const c = concepts[i];
    document.getElementById('fc-term').textContent = c.concept || '';
    document.getElementById('fc-def').textContent = c.definition || '';
    document.getElementById('fc-source').textContent = c.source ? `Lecture: ${c.source}` : '';
    document.getElementById('fc-progress').textContent = `CARD ${i + 1} OF ${concepts.length}`;
    document.getElementById('fc-subprogress').textContent = `${i + 1} / ${concepts.length}`;
    document.getElementById('fc-progress-fill').style.width = `${((i + 1) / concepts.length) * 100}%`;

    const card = document.getElementById('fc-card');
    card.classList.remove('flipped');
    if (flip) setTimeout(() => card.classList.add('flipped'), 60);

    updateOverviewGrid();
  }

  showCard(0);

  document.getElementById('fc-card')?.addEventListener('click', () => {
    document.getElementById('fc-card').classList.toggle('flipped');
  });

  document.getElementById('fc-next')?.addEventListener('click', () => {
    if (idx < concepts.length - 1) showCard(idx + 1);
    else showToast('You reached the end of the deck', 'success');
  });

  document.getElementById('fc-prev')?.addEventListener('click', () => {
    if (idx > 0) showCard(idx - 1);
  });

  document.getElementById('fc-shuffle')?.addEventListener('click', () => {
    concepts.sort(() => Math.random() - 0.5);
    seenSet.clear();
    showCard(0);
    showToast('Deck shuffled', 'info');
  });

  document.getElementById('fc-restart')?.addEventListener('click', () => showCard(0));

  function updateOverviewGrid() {
    const grid = document.getElementById('fc-grid');
    if (!grid) return;
    grid.innerHTML = '';
    concepts.forEach((c, i) => {
      const isCurrent = i === idx;
      const isSeen = seenSet.has(i);
      const el = document.createElement('div');
      el.className = 'card card-xs';
      el.style.cursor = 'pointer';
      if (isCurrent) {
        el.style.borderColor = 'var(--teal)';
        el.style.background = 'var(--sf3)';
      }

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="mono-meta" style="color:var(--teal)">#${String(i + 1).padStart(2, '0')}</span>
          ${isSeen ? `<span style="color:var(--emerald);font-size:0.8rem">${icon('check', '', 'width:13px;height:13px')}</span>` : ''}
        </div>
        <div style="font-weight:600;font-size:0.88rem;color:var(--text);margin-bottom:4px">${c.concept || ''}</div>
        <div style="font-size:0.78rem;color:var(--muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${c.definition || ''}</div>
      `;
      el.addEventListener('click', () => {
        showCard(i, true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      grid.appendChild(el);
    });
  }

  _keyListener = e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const card = document.getElementById('fc-card');
    if (!card) return;

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      card.classList.toggle('flipped');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (idx < concepts.length - 1) showCard(idx + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (idx > 0) showCard(idx - 1);
    }
  };

  document.addEventListener('keydown', _keyListener);
}
