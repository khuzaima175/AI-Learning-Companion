import { API, showToast } from '../app.js';

export async function renderAddVideo(container) {
  container.innerHTML = `
    <div class="page-header enter">
      <div class="page-icon-wrap">📚</div>
      <div class="page-title-text">
        <h1>Add New Video</h1>
        <p class="page-subtitle">Paste a YouTube link — AI generates summary, concepts & quiz in one shot</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start" class="enter" style="animation-delay:80ms">

      <!-- Form card -->
      <div class="card">
        <div class="form-group">
          <label class="form-label" for="av-url">YouTube URL</label>
          <div class="search-bar">
            <span class="search-icon">🔗</span>
            <input id="av-url" class="search-input" type="url" placeholder="https://www.youtube.com/watch?v=…" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label class="form-label" for="av-title">Video Title</label>
            <input id="av-title" class="form-input" type="text" placeholder="Introduction to…" />
          </div>
          <div class="form-group">
            <label class="form-label" for="av-course">Course / Topic</label>
            <input id="av-course" class="form-input" type="text" placeholder="Deep Learning, Biology…" />
          </div>
        </div>

        <!-- Manual transcript accordion -->
        <div class="accordion" id="manual-acc">
          <div class="accordion-hdr" id="manual-acc-hdr">
            <span>📝 Paste transcript manually <span style="color:var(--text-3);font-weight:400;font-size:.8rem">(optional)</span></span>
            <span class="accordion-arrow">▾</span>
          </div>
          <div class="accordion-body">
            <p style="font-size:.8rem;color:var(--text-3);margin-bottom:10px">Use this if YouTube auto-captions aren't available for the video.</p>
            <textarea id="av-manual" class="form-textarea" style="min-height:130px" placeholder="Paste full transcript here…"></textarea>
          </div>
        </div>

        <button class="btn btn-teal btn-full btn-lg" id="av-submit" style="margin-top:22px">
          <span class="btn-text">✨ Process Video with AI</span>
        </button>

        <div id="av-status" style="margin-top:16px"></div>
      </div>

      <!-- Info sidebar -->
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card card-sm" style="border-color:var(--border-t)">
          <div style="font-size:.8rem;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">What AI generates</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${infoRow('📝','Detailed Summary','4-6 paragraph breakdown of the content')}
            ${infoRow('💡','16 Key Concepts','Core definitions for the most important terms')}
            ${infoRow('⚡','20 Takeaways','Actionable, specific bullet-point lessons')}
            ${infoRow('🧠','Quiz Questions','20 MCQs for practice & staggered review')}
          </div>
        </div>

        <div class="card card-sm" style="border-color:var(--border-a)">
          <div style="font-size:.8rem;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Tips</div>
          <ul class="bullet-list">
            <li>Works best with educational/tutorial videos</li>
            <li>English transcripts give best results</li>
            <li>Use manual transcript for non-English content</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Result -->
    <div id="av-result" style="max-width:660px;margin-top:24px;display:none" class="enter"></div>
  `;

  // Accordion
  document.getElementById('manual-acc-hdr').addEventListener('click', () => {
    document.getElementById('manual-acc').classList.toggle('open');
  });

  // Submit
  document.getElementById('av-submit').addEventListener('click', async () => {
    const url    = document.getElementById('av-url').value.trim();
    const title  = document.getElementById('av-title').value.trim();
    const course = document.getElementById('av-course').value.trim();
    const manual = document.getElementById('av-manual').value.trim();

    if (!title)            { showToast('Enter a video title', 'error'); return; }
    if (!course)           { showToast('Enter a course/topic name', 'error'); return; }
    if (!url && !manual)   { showToast('Provide a YouTube URL or paste a transcript', 'error'); return; }

    const btn    = document.getElementById('av-submit');
    const status = document.getElementById('av-status');

    btn.classList.add('btn-loading');
    btn.disabled = true;

    status.innerHTML = `
      <div class="card card-sm" style="border-color:var(--border-t)">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="spinner"></div>
          <div>
            <div style="font-weight:600;color:var(--teal)">AI is processing your video…</div>
            <div style="font-size:.8rem;color:var(--text-2);margin-top:3px">Generating summary, 16 key concepts & 20 quiz questions</div>
          </div>
        </div>
        <div class="progress-track" style="margin-top:14px">
          <div class="progress-fill" id="av-fake-progress" style="width:0%"></div>
        </div>
      </div>`;

    // Fake progress animation
    let prog = 0;
    const progInt = setInterval(() => {
      prog = Math.min(prog + Math.random() * 8, 88);
      const bar = document.getElementById('av-fake-progress');
      if (bar) bar.style.width = prog + '%';
    }, 400);

    try {
      const res = await API.post('/api/add-video', { url, title, course, manual_transcript: manual });
      clearInterval(progInt);
      const bar = document.getElementById('av-fake-progress');
      if (bar) bar.style.width = '100%';

      setTimeout(() => {
        status.innerHTML = '';
        const result = document.getElementById('av-result');
        result.style.display = '';
        result.innerHTML = `
          <div class="card" style="border-color:rgba(16,185,129,0.35)">
            <div style="display:flex;gap:14px;align-items:flex-start">
              <div style="font-size:2.8rem">🎉</div>
              <div>
                <div style="font-weight:800;font-size:1.15rem;color:var(--emerald);margin-bottom:6px">Video processed successfully!</div>
                <div style="font-weight:600;color:var(--text)">${res.title}</div>
                <div style="font-size:.82rem;color:var(--text-2);margin-top:4px">Ready to browse, quiz and review. Go to <strong>Browse Content</strong> to explore.</div>
              </div>
            </div>
          </div>`;
        result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Clear form
        ['av-url','av-title','av-course','av-manual'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        showToast(`"${res.title}" added!`, 'success');
      }, 500);
    } catch (e) {
      clearInterval(progInt);
      status.innerHTML = `
        <div class="card card-sm" style="border-color:rgba(255,107,107,0.35);color:var(--coral)">
          ❌ ${e.message}
        </div>`;
      showToast(e.message, 'error');
    } finally {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  });
}

function infoRow(icon, title, desc) {
  return `
    <div style="display:flex;gap:10px;align-items:flex-start">
      <span style="font-size:1.1rem;flex-shrink:0;margin-top:1px">${icon}</span>
      <div>
        <div style="font-size:.82rem;font-weight:700;color:var(--text)">${title}</div>
        <div style="font-size:.76rem;color:var(--text-2);margin-top:2px">${desc}</div>
      </div>
    </div>`;
}
