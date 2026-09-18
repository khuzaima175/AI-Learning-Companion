import { API, showToast, icon, ytId, ytThumb, launchConfetti, navigate, skel } from '../app.js';

export async function renderAddVideo(container) {
  container.innerHTML = `
    <!-- Page Header -->
    <div style="margin-bottom:28px">
      <div class="page-title">Add Video <em>Lecture</em></div>
      <p class="page-subtitle">Paste a YouTube link or transcript — Gemini AI will generate summary, concepts, takeaways, and 20 practice cards.</p>
    </div>

    <!-- 2-Column Grid -->
    <div class="add-video-grid">

      <!-- Main Form Column -->
      <div style="display:flex;flex-direction:column;gap:24px">
        
        <div class="card">
          <!-- YouTube URL Field -->
          <div class="form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <label class="form-label" for="av-url" style="margin-bottom:0">YouTube Lecture URL</label>
              <button id="av-paste-btn" class="btn btn-ghost btn-sm" style="padding:4px 10px;font-size:0.78rem">
                ${icon('copy', '', 'width:12px;height:12px')}
                <span>Paste Link</span>
              </button>
            </div>
            <div style="position:relative;display:flex;align-items:center">
              <input id="av-url" class="form-input input" type="url" 
                     placeholder="https://www.youtube.com/watch?v=..." 
                     style="padding-left:46px;font-size:0.95rem" />
              <div style="position:absolute;left:16px;color:var(--faint);pointer-events:none;display:flex;align-items:center">
                ${icon('video', '', 'width:18px;height:18px')}
              </div>
            </div>

            <!-- Real-time Thumbnail Preview -->
            <div id="av-thumb-preview" class="thumb-preview-card" style="display:none">
              <img id="av-thumb-img" class="thumb-preview-img thumb" alt="Video Preview" />
              <div style="position:absolute;bottom:12px;left:12px;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.15);border-radius:var(--r-sm);padding:5px 10px;font-family:'JetBrains Mono', monospace;font-size:0.72rem;color:#fff" id="av-vid-id-lbl">
                YouTube ID Detected
              </div>
            </div>
          </div>

          <!-- Video Title & Course Row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div class="form-group">
              <label class="form-label" for="av-title">Lecture Title</label>
              <input id="av-title" class="form-input input" type="text" placeholder="e.g. Transformers & Self-Attention" />
            </div>
            <div class="form-group">
              <label class="form-label" for="av-course">Course / Subject</label>
              <input id="av-course" list="existing-courses-dl" class="form-input input" type="text" placeholder="e.g. Deep Learning" />
              <datalist id="existing-courses-dl"></datalist>
            </div>
          </div>

          <!-- Manual Transcript Accordion -->
          <div class="card card-xs" style="background:var(--sf2);border:1px solid var(--line);margin:6px 0 28px 0;padding:0;overflow:hidden">
            <div id="manual-acc-hdr" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;cursor:pointer">
              <div style="display:flex;align-items:center;gap:10px">
                ${icon('edit-3', '', 'width:15px;height:15px;color:var(--teal)')}
                <span style="font-weight:500;font-size:0.85rem;color:var(--muted)">Paste Manual Transcript (Optional)</span>
              </div>
              <span id="manual-acc-chevron" style="color:var(--faint);transition:transform 0.2s">${icon('chevron-down', '', 'width:15px;height:15px')}</span>
            </div>
            <div id="manual-acc-body" style="display:none;padding:18px;border-top:1px solid var(--line)">
              <p style="font-size:0.8rem;color:var(--muted);margin-bottom:10px">Use for videos without automated captions or custom audio recordings.</p>
              <textarea id="av-manual" class="form-textarea input" placeholder="Paste transcript text here..."></textarea>
            </div>
          </div>

          <!-- Submit Button -->
          <button class="btn btn-primary btn-full btn-lg" id="av-submit">
            <span class="spin" id="av-btn-spin" style="display:none"></span>
            <span id="av-btn-label">Process Lecture with AI</span>
          </button>
        </div>

        <!-- Terminal Window Output -->
        <div id="av-terminal-wrap" style="display:none">
          <div class="terminal-window">
            <div class="terminal-hdr">
              <span class="term-dot red"></span>
              <span class="term-dot yellow"></span>
              <span class="term-dot green"></span>
              <span class="mono-meta" style="margin-left:8px;font-size:0.7rem">gemini-flash · transcript processor</span>
            </div>
            <div class="terminal-body" id="av-terminal-body">
              <div class="term-line" id="av-cursor-line">
                <span style="color:var(--teal)">$</span>
                <span class="term-cursor"></span>
              </div>
            </div>
          </div>
        </div>

        <div id="av-result" style="display:none"></div>
      </div>

      <!-- Right Rail: Stepper Overview & Recents -->
      <div style="display:flex;flex-direction:column;gap:20px">

        <!-- Stepper Breakdown -->
        <div class="card card-sm">
          <div class="card-title" style="margin-bottom:18px">Processing Pipeline</div>
          <div class="stepper-rail">
            <div class="stepper-item">
              <div class="stepper-num">1</div>
              <div>
                <div style="font-weight:600;font-size:0.88rem">Transcript Ingestion</div>
                <div style="font-size:0.76rem;color:var(--muted);margin-top:3px;line-height:1.45">Extract clean English captions</div>
              </div>
            </div>
            <div class="stepper-item">
              <div class="stepper-num">2</div>
              <div>
                <div style="font-weight:600;font-size:0.88rem">Structured Synthesis</div>
                <div style="font-size:0.76rem;color:var(--muted);margin-top:3px;line-height:1.45">Summary, 16 concepts &amp; 20 takeaways</div>
              </div>
            </div>
            <div class="stepper-item">
              <div class="stepper-num">3</div>
              <div>
                <div style="font-weight:600;font-size:0.88rem">Quiz Calibration</div>
                <div style="font-size:0.76rem;color:var(--muted);margin-top:3px;line-height:1.45">20 active recall practice questions</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recently Added Lectures -->
        <div class="card card-sm" id="av-recents-card">
          <div class="card-title" style="margin-bottom:14px">Recently Added</div>
          <div id="av-recents-list" style="display:flex;flex-direction:column;gap:10px">
            ${skel('100%', 44, 8)}
            ${skel('100%', 44, 8)}
          </div>
        </div>

      </div>
    </div>
  `;

  // Populate Existing Courses
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
      const top3 = allVideos.slice(0, 3);
      if (!top3.length) {
        recentsList.innerHTML = `<div style="font-size:0.8rem;color:var(--faint);padding:6px 0">No lectures processed yet.</div>`;
      } else {
        recentsList.innerHTML = top3.map(v => `
          <div class="recent-item-tile" onclick="window.navigate('browse')">
            <div class="icon-chip teal" style="width:32px;height:32px;flex-shrink:0">${icon('video', '', 'width:15px;height:15px')}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.84rem;font-weight:600;color:var(--text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${v.title}</div>
              <div class="mono-meta" style="font-size:0.65rem;margin-top:2px">${v.courseName}</div>
            </div>
          </div>`).join('');
      }
    }
  } catch { /**/ }

  // Live Thumbnail Detection
  const urlInput = document.getElementById('av-url');
  const thumbWrap = document.getElementById('av-thumb-preview');
  const thumbImg = document.getElementById('av-thumb-img');
  const vidIdLbl = document.getElementById('av-vid-id-lbl');

  function checkUrlForThumb() {
    const val = urlInput.value.trim();
    const id = ytId(val);
    if (id) {
      thumbImg.src = ytThumb(id);
      vidIdLbl.textContent = `YouTube detected · ${id}`;
      thumbWrap.style.display = 'flex';
    } else {
      thumbWrap.style.display = 'none';
    }
  }

  urlInput.addEventListener('input', checkUrlForThumb);
  urlInput.addEventListener('change', checkUrlForThumb);

  // Paste Link Button
  document.getElementById('av-paste-btn')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text;
        checkUrlForThumb();
        showToast('Pasted YouTube link from clipboard', 'info');
      }
    } catch {
      urlInput.focus();
    }
  });

  // Manual Transcript Accordion Toggle
  const accHdr = document.getElementById('manual-acc-hdr');
  const accBody = document.getElementById('manual-acc-body');
  const accChev = document.getElementById('manual-acc-chevron');
  accHdr.addEventListener('click', () => {
    const isHidden = accBody.style.display === 'none';
    accBody.style.display = isHidden ? 'block' : 'none';
    accChev.style.transform = isHidden ? 'rotate(180deg)' : '';
  });

  // Submit Handler
  document.getElementById('av-submit').addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const title = document.getElementById('av-title').value.trim();
    const course = document.getElementById('av-course').value.trim();
    const manual = document.getElementById('av-manual').value.trim();

    if (!title) { showToast('Please enter a lecture title', 'error'); return; }
    if (!course) { showToast('Please enter a course name', 'error'); return; }
    if (!url && !manual) { showToast('Provide a YouTube URL or paste a transcript', 'error'); return; }

    const btn = document.getElementById('av-submit');
    const btnSpin = document.getElementById('av-btn-spin');
    const btnLabel = document.getElementById('av-btn-label');
    const termWrap = document.getElementById('av-terminal-wrap');
    const termBody = document.getElementById('av-terminal-body');
    const resultBox = document.getElementById('av-result');

    btn.classList.add('loading');
    btn.disabled = true;
    if (btnSpin) btnSpin.style.display = 'inline-block';
    if (btnLabel) btnLabel.textContent = 'Processing Video…';
    resultBox.style.display = 'none';
    termWrap.style.display = 'block';

    termBody.innerHTML = `
      <div class="term-line" id="av-cursor-line">
        <span style="color:var(--teal)">$</span>
        <span class="term-cursor"></span>
      </div>`;

    const STEPS = [
      'Extracting clean English transcript…',
      'Initializing Gemini AI analysis engine…',
      'Synthesizing structured lecture summary…',
      'Extracting 16 core concepts & definitions…',
      'Calibrating 20 practice quiz questions…',
      'Writing course and card entities to database…',
    ];

    let stepIdx = 0;
    function appendTerminalLine(text, type = 'teal') {
      const cursorLine = document.getElementById('av-cursor-line');
      const line = document.createElement('div');
      line.className = `term-line ${type}`;
      line.innerHTML = `<span>✓</span> <span>${text}</span>`;
      termBody.insertBefore(line, cursorLine);
      termBody.scrollTop = termBody.scrollHeight;
    }

    const timer = setInterval(() => {
      if (stepIdx < STEPS.length) {
        appendTerminalLine(STEPS[stepIdx++]);
      }
    }, 1800);

    try {
      const res = await API.post('/api/add-video', {
        url, title, course, manual_transcript: manual
      });
      clearInterval(timer);
      appendTerminalLine('Video processed successfully. All cards saved.', 'done');

      launchConfetti();
      showToast(`"${res.title}" added to library`, 'success');

      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div class="card" style="border-color:rgba(52,211,153,0.3);display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-weight:600;font-size:1rem;color:var(--text)">${res.title}</div>
            <div style="font-size:0.8rem;color:var(--muted);margin-top:2px">Ready: Summary, 16 Concepts, 20 Takeaways, and Quiz.</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.navigate('browse')">
            <span>Open in Library</span>
            ${icon('arrow-right', '', 'width:14px;height:14px')}
          </button>
        </div>`;

      urlInput.value = '';
      document.getElementById('av-title').value = '';
      document.getElementById('av-course').value = '';
      document.getElementById('av-manual').value = '';
      thumbWrap.style.display = 'none';

    } catch (e) {
      clearInterval(timer);
      appendTerminalLine(`Error: ${e.message}`, 'err');
      showToast(e.message, 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
      if (btnSpin) btnSpin.style.display = 'none';
      if (btnLabel) btnLabel.textContent = 'Process Lecture with AI';
    }
  });
}
