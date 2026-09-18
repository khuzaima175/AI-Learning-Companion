/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Lecture Ingestion Console (`#/import`)
   High-Density 2-Column Ingestion Pipeline with Live Stepper & History
   ══════════════════════════════════════════════════════════════════ */

import { API, showToast, ytId, ytThumb, navigate, skel, invalidateCoursesCache } from '../app.js';

export async function renderImport(container) {
  const prefillUrl = sessionStorage.getItem('alc_prefill_url') || '';
  sessionStorage.removeItem('alc_prefill_url');

  container.innerHTML = `
    <!-- Header -->
    <div class="page-head">
      <div>
        <h1 class="page-head-title">Import Video Lecture</h1>
        <div class="page-head-desc">Ingest YouTube lectures or manual transcripts for AI synthesis, concept extraction, and active recall drills.</div>
      </div>
    </div>

    <!-- 2-Column Ingestion Console Grid -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px" class="grid-2fr-1fr">
      
      <!-- Left Column: Ingestion Form -->
      <div class="card" style="display:flex;flex-direction:column;gap:16px">
        
        <!-- Source Selector -->
        <div class="segmented" style="width:fit-content" id="import-source-seg">
          <button class="segmented-btn active" data-src="youtube">YouTube URL</button>
          <button class="segmented-btn" data-src="manual">Manual Transcript</button>
        </div>

        <!-- YouTube URL Section -->
        <div id="import-yt-section" class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <label class="form-label" for="av-url">Lecture Video URL</label>
            <button class="btn btn-ghost btn-sm" id="av-paste-btn" style="padding:2px 6px;height:22px">
              <svg style="width:12px;height:12px"><use href="#i-copy"/></svg>
              <span>Paste</span>
            </button>
          </div>
          <input class="form-input" id="av-url" type="url" placeholder="https://www.youtube.com/watch?v=..." value="${prefillUrl}" />
          
          <!-- Thumbnail Detection Preview -->
          <div id="av-thumb-preview" class="card card-xs" style="display:none;align-items:center;gap:12px;background:var(--bg-2);margin-top:8px">
            <img id="av-thumb-img" style="width:80px;height:45px;border-radius:var(--r-sm);object-fit:cover" alt="Thumb" />
            <div style="flex:1;min-width:0">
              <div class="caption-text mono" id="av-vid-id-lbl" style="color:var(--txt-1)">YouTube ID Detected</div>
              <div class="caption-text">Valid video stream identified for caption extraction.</div>
            </div>
          </div>
        </div>

        <!-- Manual Transcript Section (Hidden by default) -->
        <div id="import-manual-section" class="form-group" style="display:none">
          <label class="form-label" for="av-manual">Paste Raw Transcript Text</label>
          <textarea class="form-textarea" id="av-manual" placeholder="Paste custom transcript or lecture speech-to-text here…" style="min-height:140px"></textarea>
        </div>

        <!-- Title and Course Inputs -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group">
            <label class="form-label" for="av-title">Lecture Title</label>
            <input class="form-input" id="av-title" placeholder="e.g., Attention &amp; Transformer Architecture" />
          </div>
          <div class="form-group">
            <label class="form-label" for="av-course">Course / Subject</label>
            <input class="form-input" id="av-course" list="existing-courses-dl" placeholder="e.g., Deep Learning Systems" />
            <datalist id="existing-courses-dl"></datalist>
          </div>
        </div>

        <!-- Submit Button -->
        <button class="btn btn-primary btn-full btn-lg" id="av-submit-btn" style="margin-top:6px">
          <span>Process Lecture with AI</span>
        </button>

      </div>

      <!-- Right Column: Live Pipeline Stepper & Ingestion History -->
      <div style="display:flex;flex-direction:column;gap:16px">
        
        <!-- Processing Pipeline Stepper -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:12px;display:block">Ingestion Pipeline</span>
          <div class="stepper-v">
            <div class="stepper-v-item" id="step-1">
              <div class="stepper-v-num">1</div>
              <div>
                <div style="font-weight:600;font-size:13px;color:var(--txt-1)">Transcript Ingestion</div>
                <div class="caption-text">Fetch captions &amp; clean noise</div>
              </div>
            </div>
            <div class="stepper-v-item" id="step-2">
              <div class="stepper-v-num">2</div>
              <div>
                <div style="font-weight:600;font-size:13px;color:var(--txt-1)">Structured Synthesis</div>
                <div class="caption-text">Summary &amp; 16 key concepts</div>
              </div>
            </div>
            <div class="stepper-v-item" id="step-3">
              <div class="stepper-v-num">3</div>
              <div>
                <div style="font-weight:600;font-size:13px;color:var(--txt-1)">Quiz Calibration</div>
                <div class="caption-text">20 active recall practice items</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Ingestions List -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:10px;display:block">Recent Ingestions</span>
          <div id="av-recents-list" style="display:flex;flex-direction:column;gap:8px">
            ${skel('100%', 32)}
            ${skel('100%', 32)}
          </div>
        </div>

      </div>

    </div>
  `;

  // Source Switcher (YouTube / Manual)
  const ytSec = document.getElementById('import-yt-section');
  const manSec = document.getElementById('import-manual-section');
  container.querySelectorAll('#import-source-seg .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#import-source-seg .segmented-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isYt = btn.dataset.src === 'youtube';
      if (ytSec) ytSec.style.display = isYt ? 'flex' : 'none';
      if (manSec) manSec.style.display = isYt ? 'none' : 'flex';
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

  urlInput?.addEventListener('input', checkUrl);
  if (prefillUrl) checkUrl();

  // Load Existing Courses and Recents
  try {
    const courses = await API.get('/api/courses');
    const dl = document.getElementById('existing-courses-dl');
    if (dl) dl.innerHTML = courses.map(c => `<option value="${c.name}">`).join('');

    const recentsList = document.getElementById('av-recents-list');
    if (recentsList) {
      const allVideos = [];
      courses.forEach(c => {
        (c.videos || []).forEach(v => allVideos.push({ ...v, courseName: c.name }));
      });
      if (!allVideos.length) {
        recentsList.innerHTML = `<div class="caption-text">No lectures imported yet.</div>`;
      } else {
        recentsList.innerHTML = allVideos.slice(0, 4).map(v => `
          <a class="card card-xs" href="#lecture/${v.id}" onclick="window.navigate('lecture/${v.id}');return false;" style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-2);padding:8px 10px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:12.5px;color:var(--txt-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.title}</div>
              <div class="caption-text">${v.courseName}</div>
            </div>
            <span class="chip chip-ok" style="font-size:10px">Ready</span>
          </a>
        `).join('');
      }
    }
  } catch { /**/ }

  // Submit Handler
  document.getElementById('av-submit-btn')?.addEventListener('click', async () => {
    const url = (document.getElementById('av-url')?.value || '').trim();
    const manual = (document.getElementById('av-manual')?.value || '').trim();
    const title = (document.getElementById('av-title')?.value || '').trim();
    const course = (document.getElementById('av-course')?.value || '').trim();

    if (!title) { showToast('Enter a lecture title', 'warn'); return; }
    if (!course) { showToast('Enter a course name', 'warn'); return; }
    if (!url && !manual) { showToast('Provide a YouTube link or transcript', 'warn'); return; }

    const submitBtn = document.getElementById('av-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Synthesizing with Gemini AI…</span>`;
    }

    // Step animation feedback
    const s1 = document.getElementById('step-1');
    const s2 = document.getElementById('step-2');
    const s3 = document.getElementById('step-3');

    s1?.classList.add('active');
    setTimeout(() => { s1?.classList.add('done'); s2?.classList.add('active'); }, 1800);
    setTimeout(() => { s2?.classList.add('done'); s3?.classList.add('active'); }, 3600);

    try {
      const res = await API.post('/api/add-video', {
        url,
        title,
        course,
        manual_transcript: manual,
      });

      s3?.classList.add('done');
      showToast(`"${res.title}" successfully ingested!`, 'success');
      invalidateCoursesCache();
      navigate(`lecture/${res.id || ''}`);
    } catch (err) {
      showToast(err.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Process Lecture with AI</span>`;
      }
    }
  });
}
