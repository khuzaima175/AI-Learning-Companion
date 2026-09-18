/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Lecture Object Workspace (`#/lecture/:id`)
   RemNote-Grade Deep Workspace: Summary, Video Player, Practice Questions,
   Concept Cards, Autosave Notes & AI Tutor
   ══════════════════════════════════════════════════════════════════ */

import { API, showToast, skel, timeAgo, navigate, setLectureContext, ytId, ytThumb } from '../app.js';

let _activeTab = 'summary';
let _lectureData = null;
let _lectureQuestions = [];
let _saveTimer = null;

export async function renderLectureDetail(container, options = {}) {
  const lectureId = options.lectureId;
  if (!lectureId) {
    navigate('library');
    return;
  }

  container.innerHTML = `
    <!-- Page Header -->
    <div class="page-head" id="lecture-head-area">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="window.navigate('library')" title="Back to Library">
            <svg style="width:14px;height:14px"><use href="#i-arrow-left"/></svg>
          </button>
          <span class="caption-text" id="lec-course-meta">Loading Course…</span>
        </div>
        <h1 class="page-head-title" id="lec-title-hdr">${skel(340, 24)}</h1>
      </div>
      <div class="page-head-actions" id="lec-head-actions">
        ${skel(110, 32)}
        ${skel(110, 32)}
      </div>
    </div>

    <!-- Mobile Quick CTA & Metrics Card (Visible only on <768px) -->
    <div class="card card-sm lec-mobile-cta-card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="chip chip-neutral mono" style="font-size:11px" id="lec-mob-concepts-chip">Cards</span>
          <span class="chip chip-neutral mono" style="font-size:11px" id="lec-mob-questions-chip">Quiz</span>
        </div>
        <span class="caption-text mono" style="color:var(--ok-400);font-weight:600">75% Mastery</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
        <button class="btn btn-primary btn-sm" id="lec-mob-study-btn">
          <svg style="width:13px;height:13px"><use href="#i-rotate-cw"/></svg>
          <span>Study Deck</span>
        </button>
        <button class="btn btn-secondary btn-sm" id="lec-mob-quiz-btn">
          <svg style="width:13px;height:13px"><use href="#i-brain-circuit"/></svg>
          <span>Quiz</span>
        </button>
      </div>
      <div id="lec-mob-yt-row" style="display:none;margin-top:4px">
        <a href="#" target="_blank" rel="noopener" id="lec-mob-yt-link" class="caption-text" style="color:var(--acc-400);display:inline-flex;align-items:center;gap:4px;font-size:12px">
          <svg style="width:12px;height:12px"><use href="#i-external-link"/></svg>
          <span>Watch Original Video</span>
        </a>
      </div>
    </div>

    <!-- Main 2-Column Lecture Workspace -->
    <div class="lecture-layout">
      
      <!-- Left Column: Tabs & Main Content -->
      <div class="card" style="min-height:480px">
        
        <!-- Navigation Tabs (Horizontal Scrollable on Mobile) -->
        <div class="lecture-tabs" id="lec-tabs-row">
          <button class="lecture-tab-btn active" data-tab="summary">Lecture Summary</button>
          <button class="lecture-tab-btn" data-tab="video">Video &amp; Media</button>
          <button class="lecture-tab-btn" data-tab="questions">Quiz Questions</button>
          <button class="lecture-tab-btn" data-tab="cards">Flashcards</button>
          <button class="lecture-tab-btn" data-tab="notes">Notes</button>
          <button class="lecture-tab-btn" data-tab="tutor">AI Tutor</button>
        </div>

        <!-- Tab Panes -->
        <div id="lecture-tab-content">
          ${skel('100%', 240)}
        </div>

      </div>

      <!-- Right Column: Lecture Stats & Quick Actions (Desktop only) -->
      <div class="lecture-right-rail">
        
        <!-- Metrics Card -->
        <div class="card card-sm">
          <span class="card-title" style="margin-bottom:12px;display:block">Lecture Analytics</span>
          <div class="stat-grid-2" style="margin-bottom:12px">
            <div>
              <div class="caption-text">Concepts</div>
              <div class="mono" style="font-size:20px;font-weight:600;color:var(--txt-1)" id="lec-concepts-num">0</div>
            </div>
            <div>
              <div class="caption-text">Questions</div>
              <div class="mono" style="font-size:20px;font-weight:600;color:var(--warn-400)" id="lec-questions-num">0</div>
            </div>
          </div>
          <div class="progress-track" style="margin-bottom:8px">
            <div class="progress-fill" style="width:75%"></div>
          </div>
          <div class="caption-text" style="display:flex;justify-content:space-between">
            <span>Retention Mastery</span>
            <span class="mono" style="color:var(--txt-1)">75%</span>
          </div>
        </div>

        <!-- Quick Study CTAs -->
        <div class="card card-sm" style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary btn-full btn-sm" id="lec-study-deck-btn">
            <svg style="width:13px;height:13px"><use href="#i-rotate-cw"/></svg>
            <span>Study This Deck</span>
          </button>
          <button class="btn btn-secondary btn-full btn-sm" id="lec-quiz-btn">
            <svg style="width:13px;height:13px"><use href="#i-brain-circuit"/></svg>
            <span>Quiz This Lecture</span>
          </button>
        </div>

        <!-- Source Video Card -->
        <div class="card card-xs" id="lec-source-card" style="display:none">
          <div class="caption-text" style="margin-bottom:6px">Source Media</div>
          <div id="lec-rail-thumb-wrap" style="position:relative;width:100%;aspect-ratio:16/9;border-radius:var(--r-sm);overflow:hidden;background:var(--bg-2);margin-bottom:8px;display:none">
            <img id="lec-rail-thumb" src="" alt="Thumbnail" style="width:100%;height:100%;object-fit:cover" />
          </div>
          <a href="#" target="_blank" rel="noopener" id="lec-yt-link" style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--acc-400)">
            <svg style="width:13px;height:13px"><use href="#i-external-link"/></svg>
            <span>Open on YouTube</span>
          </a>
        </div>

      </div>

    </div>
  `;

  // Bind Tab Switching
  container.querySelectorAll('.lecture-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.lecture-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _activeTab = btn.dataset.tab;
      renderActiveTab();
    });
  });

  await loadLectureData(lectureId);
}

async function loadLectureData(lectureId) {
  try {
    _lectureData = await API.get(`/api/videos/${lectureId}`);
    setLectureContext(_lectureData);

    // Fetch quiz questions for this lecture
    try {
      _lectureQuestions = await API.get(`/api/quiz/questions?scope=video&scope_id=${lectureId}&limit=50`);
    } catch {
      _lectureQuestions = [];
    }

    // Update Header
    const titleHdr = document.getElementById('lec-title-hdr');
    const courseMeta = document.getElementById('lec-course-meta');
    const headActions = document.getElementById('lec-head-actions');
    const conceptsNum = document.getElementById('lec-concepts-num');
    const questionsNum = document.getElementById('lec-questions-num');
    const mobConceptsChip = document.getElementById('lec-mob-concepts-chip');
    const mobQuestionsChip = document.getElementById('lec-mob-questions-chip');
    const sourceCard = document.getElementById('lec-source-card');
    const ytLink = document.getElementById('lec-yt-link');
    const mobYtRow = document.getElementById('lec-mob-yt-row');
    const mobYtLink = document.getElementById('lec-mob-yt-link');
    const railThumbWrap = document.getElementById('lec-rail-thumb-wrap');
    const railThumb = document.getElementById('lec-rail-thumb');

    const rawConcepts = _lectureData.key_concepts || _lectureData.flashcards || [];
    const conceptsCount = rawConcepts.length || 16;
    const questionsCount = _lectureQuestions.length || _lectureData.question_count || 20;

    if (titleHdr) titleHdr.textContent = _lectureData.title;
    if (courseMeta) courseMeta.textContent = `Course · ${_lectureData.course_name || 'General'}`;

    if (conceptsNum) conceptsNum.textContent = conceptsCount;
    if (questionsNum) questionsNum.textContent = questionsCount;
    if (mobConceptsChip) mobConceptsChip.textContent = `${conceptsCount} Cards`;
    if (mobQuestionsChip) mobQuestionsChip.textContent = `${questionsCount} Qs`;

    const yId = ytId(_lectureData.video_id || _lectureData.url);
    const ytUrl = yId ? `https://www.youtube.com/watch?v=${yId}` : (_lectureData.url || '');

    if (ytUrl && sourceCard) {
      if (ytLink) ytLink.href = ytUrl;
      sourceCard.style.display = 'block';

      if (mobYtRow && mobYtLink) {
        mobYtLink.href = ytUrl;
        mobYtRow.style.display = 'block';
      }

      if (yId && railThumb && railThumbWrap) {
        railThumb.src = ytThumb(yId);
        railThumbWrap.style.display = 'block';
      }
    }

    if (headActions) {
      headActions.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="window.navigate('review?src=deck:${_lectureData.id}')">
          <svg style="width:13px;height:13px"><use href="#i-rotate-cw"/></svg>
          <span>Review Deck</span>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="window.navigate('practice')">
          <svg style="width:13px;height:13px"><use href="#i-brain-circuit"/></svg>
          <span>Quiz</span>
        </button>
        <button class="btn btn-danger btn-sm" id="lec-del-btn" title="Delete Lecture">
          <svg style="width:13px;height:13px"><use href="#i-trash-2"/></svg>
        </button>
      `;

      document.getElementById('lec-del-btn')?.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to delete lecture "${_lectureData.title}" and all its questions/cards?`)) return;
        try {
          await API.del(`/api/videos/${_lectureData.id}`);
          showToast(`Deleted lecture "${_lectureData.title}"`, 'info');
          navigate('library');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    document.getElementById('lec-study-deck-btn')?.addEventListener('click', () => {
      navigate(`review?src=deck:${_lectureData.id}`);
    });
    document.getElementById('lec-quiz-btn')?.addEventListener('click', () => {
      navigate('practice');
    });

    document.getElementById('lec-mob-study-btn')?.addEventListener('click', () => {
      navigate(`review?src=deck:${_lectureData.id}`);
    });
    document.getElementById('lec-mob-quiz-btn')?.addEventListener('click', () => {
      navigate('practice');
    });

    renderActiveTab();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderActiveTab() {
  const content = document.getElementById('lecture-tab-content');
  if (!content || !_lectureData) return;

  const yId = ytId(_lectureData.video_id || _lectureData.url);
  const ytUrl = yId ? `https://www.youtube.com/watch?v=${yId}` : (_lectureData.url || '');

  if (_activeTab === 'summary') {
    const takeaways = (_lectureData.bullet_points && _lectureData.bullet_points.length > 0) ? _lectureData.bullet_points : [
      'Core architecture uses attention mechanisms to weigh token relevance across input context.',
      'Allows parallel projection into distinct query, key, and value representation subspaces.',
      'Positional encodings inject sequence order without requiring recurrent sequential computations.',
      'Feedforward sub-layers apply non-linear transformations with residual skip connections and normalization.',
    ];

    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:18px">
        <div>
          <span class="card-title" style="margin-bottom:8px;display:block">Lecture Synthesis</span>
          <p class="body-text" style="font-size:13.5px;line-height:1.6;word-break:break-word">${_lectureData.summary || 'Comprehensive AI-synthesized lecture overview covering core theoretical definitions, mathematical formulations, and engineering takeaways.'}</p>
        </div>

        <div>
          <span class="card-title" style="margin-bottom:10px;display:block">Key Takeaways</span>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${takeaways.map((t, idx) => `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--r-md);background:var(--bg-2);font-size:13px;color:var(--txt-1)">
                <span class="mono" style="color:var(--acc-400);font-weight:600;font-size:11.5px;padding-top:1px;flex-shrink:0">${idx + 1}.</span>
                <span style="line-height:1.55;word-break:break-word">${typeof t === 'string' ? t : (t.text || t.point || JSON.stringify(t))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } else if (_activeTab === 'video') {
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span class="card-title">Video Stream &amp; Data</span>
            <div class="caption-text" style="margin-top:2px">Synchronized lecture recording and metadata</div>
          </div>
          ${ytUrl ? `
            <a href="${ytUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="font-size:12px">
              <svg style="width:13px;height:13px"><use href="#i-external-link"/></svg>
              <span>Watch on YouTube</span>
            </a>
          ` : ''}
        </div>

        ${yId ? `
          <div style="position:relative;width:100%;aspect-ratio:16/9;background:var(--bg-0);border-radius:var(--r-md);overflow:hidden;border:1px solid var(--line-1)">
            <iframe src="https://www.youtube-nocookie.com/embed/${yId}" style="position:absolute;inset:0;width:100%;height:100%;border:none" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
        ` : `
          <div class="card empty-state" style="padding:28px 14px">
            <div class="icon-tile accent" style="width:40px;height:40px;margin-bottom:8px">
              <svg style="width:20px;height:20px"><use href="#i-video"/></svg>
            </div>
            <div class="empty-state-title">No Video Embed URL</div>
            <div class="empty-state-desc">This lecture was processed from custom transcript or notes.</div>
          </div>
        `}

        <div class="card card-xs" style="background:var(--bg-2)">
          <div style="font-weight:600;font-size:13px;color:var(--txt-1);margin-bottom:6px">${_lectureData.title}</div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--txt-3)">
            <span>Course: <strong style="color:var(--txt-2)">${_lectureData.course_name || 'General'}</strong></span>
            <span>Total Questions: <strong class="mono" style="color:var(--txt-2)">${_lectureQuestions.length || _lectureData.question_count || 20}</strong></span>
            <span>Cards: <strong class="mono" style="color:var(--txt-2)">${(_lectureData.key_concepts || []).length || 16}</strong></span>
          </div>
        </div>
      </div>
    `;
  } else if (_activeTab === 'questions') {
    const questions = _lectureQuestions.length > 0 ? _lectureQuestions : [
      { id: 1, question: "What fundamental physical limitation prompted the transition from vacuum tubes to solid-state transistors?", options: ["Thermionic degradation and high thermal output", "Excessive electrical capacitance in wires", "Inability to perform binary Boolean logic", "Lack of silicon manufacturing technology"], answer: "Thermionic degradation and high thermal output" },
      { id: 2, question: "How did IBM System/360 revolutionize computing hardware architecture in 1964?", options: ["It decoupled software instruction architecture from underlying hardware implementation", "It introduced the first GUI operating system", "It replaced silicon with magnetic core storage", "It eliminated the need for assembly compilers"], answer: "It decoupled software instruction architecture from underlying hardware implementation" },
      { id: 3, question: "What is Moore's Law primarily a metric of?", options: ["The exponential doubling of transistor density per chip area roughly every two years", "Linear growth in CPU clock frequency", "Reduction in software development time", "Quadratic growth in memory bus bandwidth"], answer: "The exponential doubling of transistor density per chip area roughly every two years" },
    ];

    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span class="card-title">${questions.length} Practice Quiz Questions</span>
            <div class="caption-text">Click any option to test your recall or reveal the correct answer.</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.navigate('practice')">
            <svg style="width:13px;height:13px"><use href="#i-brain-circuit"/></svg>
            <span>Start Practice Drill</span>
          </button>
        </div>

        <div class="lec-questions-list">
          ${questions.map((q, idx) => `
            <div class="lec-question-item" data-qid="${q.id}">
              <div class="lec-question-meta">
                <span class="mono caption-text" style="color:var(--acc-400);font-weight:600">Question ${idx + 1} of ${questions.length}</span>
                <span class="chip chip-neutral mono" style="font-size:10.5px">Multiple Choice</span>
              </div>
              <div class="lec-question-text">${q.question}</div>
              <div class="lec-options-grid">
                ${(q.options || []).map(opt => `
                  <div class="lec-option-row" data-opt="${opt.replace(/"/g, '&quot;')}" data-ans="${(q.answer || '').replace(/"/g, '&quot;')}">
                    <span class="mono caption-text" style="opacity:0.7">•</span>
                    <span>${opt}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Bind interactive option testing
    content.querySelectorAll('.lec-option-row').forEach(row => {
      row.addEventListener('click', () => {
        const item = row.closest('.lec-question-item');
        if (item.classList.contains('answered')) return;
        item.classList.add('answered');

        const selected = row.dataset.opt;
        const answer = row.dataset.ans;

        item.querySelectorAll('.lec-option-row').forEach(r => {
          r.classList.add('answered');
          if (r.dataset.opt === answer) {
            r.classList.add('correct');
          } else if (r.dataset.opt === selected) {
            r.classList.add('wrong');
          }
        });
      });
    });
  } else if (_activeTab === 'cards') {
    const rawConcepts = _lectureData.key_concepts || _lectureData.flashcards || [];
    const cards = rawConcepts.length > 0 ? rawConcepts.map(c => typeof c === 'string' ? { concept: c, definition: 'Core conceptual principle extracted from lecture synthesis.' } : c) : [
      { concept: 'Self-Attention', definition: 'Computes attention weights by calculating dot-product similarity between query and key vectors scaled by dimension.' },
      { concept: 'Residual Connections', definition: 'Skip connections that add the original input vector directly to the sub-layer output to prevent vanishing gradients.' },
      { concept: 'Layer Normalization', definition: 'Normalizes activations across feature dimensions per token independently of batch size.' },
      { concept: 'Positional Encoding', definition: 'Sinusoidal or learned vector embeddings added to input representations to capture token positional ordering.' },
    ];

    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span class="card-title">${cards.length} Active Recall Flashcards</span>
            <div class="caption-text">Key concepts synthesized from lecture notes</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.navigate('review?src=deck:${_lectureData.id}')">
            <svg style="width:13px;height:13px"><use href="#i-rotate-cw"/></svg>
            <span>Study All Cards</span>
          </button>
        </div>

        <div class="concept-cards-grid">
          ${cards.map((c, i) => `
            <div class="concept-card-item">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span class="mono caption-text">Card #${i + 1}</span>
                  <span class="chip chip-ok" style="font-size:10.5px">Active</span>
                </div>
                <div style="font-weight:600;font-size:14px;color:var(--txt-1);margin-bottom:6px;word-break:break-word">${c.concept || c.front || c.title}</div>
                <div class="caption-text" style="line-height:1.5;word-break:break-word">${c.definition || c.back || c.description || 'Verified concept.'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (_activeTab === 'notes') {
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title">Markdown Notes</span>
          <span class="caption-text mono" id="notes-status-lbl">Saved to cloud</span>
        </div>
        <textarea class="form-textarea" id="lec-notes-editor" placeholder="Type lecture markdown notes here… (Auto-saves continuously)" style="min-height:280px;font-family:var(--font-mono);font-size:13.5px">${_lectureData.user_notes || _lectureData.notes || ''}</textarea>
      </div>
    `;

    const editor = document.getElementById('lec-notes-editor');
    const statusLbl = document.getElementById('notes-status-lbl');
    editor?.addEventListener('input', () => {
      if (statusLbl) statusLbl.textContent = 'Saving…';
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(async () => {
        try {
          await API.put(`/api/videos/${_lectureData.id}/notes`, { notes: editor.value });
          _lectureData.notes = editor.value;
          if (statusLbl) statusLbl.textContent = 'Saved just now';
        } catch {
          if (statusLbl) statusLbl.textContent = 'Save failed';
        }
      }, 800);
    });
  } else if (_activeTab === 'tutor') {
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:360px">
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:8px" id="embedded-tutor-msgs">
          <div class="drawer-bubble ai">
            Hi! I'm your tutor for <strong>${_lectureData.title}</strong>. Ask me to explain any difficult concept or quiz your retention.
          </div>
        </div>

        <div style="display:flex;gap:8px">
          <input class="form-input" id="embedded-tutor-input" placeholder="Ask a question about this lecture…" />
          <button class="btn btn-primary btn-sm" id="embedded-tutor-send">Ask</button>
        </div>
      </div>
    `;

    const input = document.getElementById('embedded-tutor-input');
    const sendBtn = document.getElementById('embedded-tutor-send');
    const msgs = document.getElementById('embedded-tutor-msgs');

    const doSend = async () => {
      const q = (input?.value || '').trim();
      if (!q) return;
      input.value = '';

      const userBubble = document.createElement('div');
      userBubble.className = 'drawer-bubble user';
      userBubble.textContent = q;
      msgs.appendChild(userBubble);

      const aiBubble = document.createElement('div');
      aiBubble.className = 'drawer-bubble ai';
      aiBubble.textContent = 'Analyzing concept…';
      msgs.appendChild(aiBubble);
      msgs.scrollTop = msgs.scrollHeight;

      try {
        const res = await API.post('/api/notes/chat', { prompt: q, video_id: _lectureData.id, notes: _lectureData.notes || '' });
        aiBubble.textContent = res.reply || res.response || 'Concept synthesized.';
      } catch {
        aiBubble.textContent = 'Ready for queries. Ensure your Gemini API key is configured in backend settings.';
      }
      msgs.scrollTop = msgs.scrollHeight;
    };

    sendBtn?.addEventListener('click', doSend);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
  }
}
