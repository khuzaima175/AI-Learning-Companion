/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Lecture Ingestion Console (`#/import`)
   High-Density 2-Column Ingestion Pipeline with Live Stepper & History
   ══════════════════════════════════════════════════════════════════ */

import { API, showToast, ytId, ytThumb, navigate, skel, invalidateCoursesCache, escapeHtml } from '../app.js';

export async function renderImport(container) {
  let source = 'youtube';
  const prefillUrl = sessionStorage.getItem('alc_prefill_url') || '';
  sessionStorage.removeItem('alc_prefill_url');

  container.innerHTML = `
    <div class="page-head"><div><div class="chapter-tag"><span>02</span>Library / import</div><h1 class="page-head-title">Import a lecture.</h1><p class="page-head-desc">Add a source and a subject. We’ll organize the study materials.</p></div><a href="#library" class="text-link">Back to library ↗</a></div>
    <div class="import-layout"><div class="card import-form" style="display:flex;flex-direction:column">
      <div class="form-section-title"><span class="mono">01</span>Choose your source</div>
      <div class="segmented source-tabs" id="import-source-seg"><button class="segmented-btn active" data-src="youtube">YouTube video</button><button class="segmented-btn" data-src="manual">Paste transcript</button></div>
      <div id="import-yt-section" class="form-group"><div style="display:flex;justify-content:space-between;align-items:center"><label class="form-label" for="av-url">Video URL</label><button class="btn btn-ghost btn-sm" id="av-paste-btn"><svg width="12" height="12"><use href="#i-copy"/></svg>Paste</button></div><input class="form-input" id="av-url" type="url" placeholder="https://www.youtube.com/watch?v=…" value="${escapeHtml(prefillUrl)}"><div id="av-thumb-preview" style="display:none;align-items:center;gap:12px;margin-top:9px"><img id="av-thumb-img" style="width:88px;height:50px;border-radius:4px;object-fit:cover" alt="Lecture video thumbnail"><div><div class="caption-text mono" id="av-vid-id-lbl"></div><div class="caption-text">Video source selected</div></div></div></div>
      <div id="import-manual-section" class="form-group" style="display:none"><div style="display:flex;justify-content:space-between"><label class="form-label" for="av-manual">Transcript text</label><span class="caption-text mono" id="av-word-count">0 words</span></div><textarea class="form-textarea" id="av-manual" placeholder="Paste the lecture transcript here…" style="min-height:180px"></textarea><details class="transcript-help"><summary>Where to find a transcript</summary><p>On YouTube, open the video description and select “Show transcript.” Copy the spoken text and paste it here. You can also use lecture notes or a transcript from another recording.</p></details></div>
      <div class="source-status" id="av-source-status" role="status"><span class="status-dot"></span><span>Choose a video or paste a transcript</span></div>
      <div class="import-divider"></div><div class="form-section-title"><span class="mono">02</span>Organize the lecture</div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label" for="av-title">Lecture title</label><input class="form-input" id="av-title" placeholder="e.g. Introduction to neural networks"></div><div class="form-group"><label class="form-label" for="av-course">Course / subject</label><input class="form-input" id="av-course" list="existing-courses-dl" placeholder="Choose or create a subject"><datalist id="existing-courses-dl"></datalist></div></div>
      <button class="btn btn-primary btn-full btn-lg" id="av-submit-btn">Create study materials <svg width="15" height="15"><use href="#i-arrow-right"/></svg></button><p class="import-hint">Processing can take a minute. Your source is used to create notes, concepts, and questions in the selected course.</p>
    </div><aside class="import-aside"><section class="import-deliverables"><div class="chapter-tag">Lecture / study edition</div><h2>One source.<br>Three ways to study.</h2><div class="deliverable-line stepper-v-item" id="step-1"><span class="mono stepper-v-num">01</span><div><strong>Lecture notes</strong><p>A structured summary and the main takeaways, ready to read.</p></div></div><div class="deliverable-line stepper-v-item" id="step-2"><span class="mono stepper-v-num">02</span><div><strong>Concept cards</strong><p>The definitions and ideas to revisit through active recall.</p></div></div><div class="deliverable-line stepper-v-item" id="step-3"><span class="mono stepper-v-num">03</span><div><strong>Practice questions</strong><p>Test your understanding with questions drawn from the lecture.</p></div></div></section><div class="import-hint"><strong style="color:var(--txt-2);display:block;margin-bottom:5px">Before you import</strong>Use a clear lecture title and a consistent subject name. A full transcript gives the AI more context than a few short excerpts.</div></aside></div>
    <section class="workspace-section import-recents"><div class="section-heading"><span class="card-title">Recent imports</span><a class="text-link" href="#library">All lectures ↗</a></div><div id="av-recents-list" class="import-recents-grid">${skel('100%',45)}${skel('100%',45)}</div></section>`;

  // Source Switcher (YouTube / Manual)
  const ytSec = document.getElementById('import-yt-section');
  const manSec = document.getElementById('import-manual-section');
  container.querySelectorAll('#import-source-seg .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#import-source-seg .segmented-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      source = btn.dataset.src;
      const isYt = source === 'youtube';
      if (ytSec) ytSec.style.display = isYt ? 'flex' : 'none';
      if (manSec) manSec.style.display = isYt ? 'none' : 'flex';
      updateSourceStatus();
    });
  });

  // Paste URL Button
  document.getElementById('av-paste-btn')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const urlInput = document.getElementById('av-url');
      if (text && urlInput) {
        urlInput.value = text;
        checkUrl();
        updateSourceStatus();
      }
    } catch { /**/ }
  });

  // Real-time Thumbnail Preview
  const urlInput = document.getElementById('av-url');
  const thumbWrap = document.getElementById('av-thumb-preview');
  const thumbImg = document.getElementById('av-thumb-img');
  const vidIdLbl = document.getElementById('av-vid-id-lbl');

  function checkUrl() {
    const val = (urlInput?.value || '').trim();
    const id = ytId(val);
    if (id && thumbWrap && thumbImg && vidIdLbl) {
      thumbImg.src = ytThumb(id);
      vidIdLbl.textContent = `YouTube ID: ${id}`;
      thumbWrap.style.display = 'flex';
    } else if (thumbWrap) {
      thumbWrap.style.display = 'none';
    }
  }

  function updateSourceStatus() {
    const el = document.getElementById('av-source-status');
    const raw = source === 'youtube' ? urlInput.value.trim() : document.getElementById('av-manual').value.trim();
    const words = raw ? raw.split(/\s+/).length : 0;
    document.getElementById('av-word-count').textContent = `${words} words`;
    const valid = source === 'youtube' ? !!ytId(raw) : words > 0;
    el.className = `source-status ${raw ? valid ? 'valid' : 'invalid' : ''}`;
    el.querySelector('span:last-child').textContent = !raw ? 'Choose a video or paste a transcript' : valid ? source === 'youtube' ? 'YouTube source ready' : `${words} words ready to process` : 'Use a complete YouTube video URL';
  }
  urlInput?.addEventListener('input', () => { checkUrl(); updateSourceStatus(); });
  document.getElementById('av-manual').addEventListener('input',updateSourceStatus);
  if (prefillUrl) checkUrl();
  updateSourceStatus();

  // Load Existing Courses and Recents
  try {
    const courses = await API.get('/api/courses');
    const dl = document.getElementById('existing-courses-dl');
    if (dl) dl.innerHTML = courses.map(c => `<option value="${escapeHtml(c.name)}">`).join('');

    const recentsList = document.getElementById('av-recents-list');
    if (recentsList) {
      const allVideos = [];
      courses.forEach(c => {
        (c.videos || []).forEach(v => allVideos.push({ ...v, courseName: c.name }));
      });
      if (!allVideos.length) {
        recentsList.innerHTML = `<div class="caption-text">No lectures imported yet.</div>`;
      } else {
        recentsList.innerHTML = allVideos.slice(0,4).map((v,i) => `<a class="import-recent-row" href="#lecture/${v.id}"><span class="lecture-number">${String(i+1).padStart(2,'0')}</span><div><strong>${escapeHtml(v.title)}</strong><div class="caption-text">${escapeHtml(v.courseName)}</div></div><svg width="14" height="14" style="color:var(--txt-3)"><use href="#i-arrow-right"/></svg></a>`).join('');
      }
    }
  } catch { /**/ }

  // Submit Handler
  document.getElementById('av-submit-btn')?.addEventListener('click', async () => {
    const url = source === 'youtube' ? (document.getElementById('av-url')?.value || '').trim() : '';
    const manual = source === 'manual' ? (document.getElementById('av-manual')?.value || '').trim() : '';
    const title = (document.getElementById('av-title')?.value || '').trim();
    const course = (document.getElementById('av-course')?.value || '').trim();

    if (!title) { showToast('Enter a lecture title', 'warn'); return; }
    if (!course) { showToast('Enter a course name', 'warn'); return; }
    if (source === 'youtube' && !ytId(url)) { showToast('Enter a valid YouTube lecture link.', 'warn'); return; }
    if (!url && !manual) { showToast('Provide a YouTube link or transcript', 'warn'); return; }

    const submitBtn = document.getElementById('av-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Synthesizing with Gemini AI…</span>`;
    }

    const steps = [1,2,3].map(n => document.getElementById(`step-${n}`));
    steps.forEach(el => el?.classList.remove('active','done'));
    steps[0]?.classList.add('active');
    const status = document.createElement('div');
    status.className = 'processing-status';
    status.setAttribute('role','status');
    status.innerHTML = '<span class="processing-spinner" aria-hidden="true"></span><span>Extracting notes and building your study materials. This can take a minute.</span>';
    submitBtn.parentElement.appendChild(status);

    try {
      const res = await API.post('/api/add-video', {
        url,
        title,
        course,
        manual_transcript: manual,
      });

      steps.forEach(el => { el?.classList.remove('active'); el?.classList.add('done'); });
      status.remove();
      showToast(`"${res.title}" is ready to study!`, 'success');
      invalidateCoursesCache();
      if (submitBtn.isConnected) navigate(`lecture/${res.video_id || res.id}`);
    } catch (err) {
      status.remove();
      steps.forEach(el => el?.classList.remove('active','done'));
      showToast(err.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Create study materials</span>`;
      }
    }
  });
}
