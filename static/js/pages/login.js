/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Authentication Screen (`#/login`)
   Restrained 400px Centered Card with Clean Form Controls
   ══════════════════════════════════════════════════════════════════ */

import { signIn, signUp } from '../auth.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div class="auth-layout">
      <section class="auth-story"><picture class="auth-scene" aria-hidden="true"><source media="(max-width:768px)" srcset="/static/images/study-scene-600.webp"><img src="/static/images/study-scene-1200.webp" width="1200" height="1200" alt="" decoding="async" fetchpriority="low"></picture><div class="auth-brand"><div class="topbar-logo-tile"><svg width="20" height="20"><use href="#i-brand-logo"/></svg></div>AI Learning Companion</div><div><div class="chapter-tag">A workspace for your lectures</div><h1>Your lectures.<br>Made easier<br><span>to study.</span></h1><p>Collect the source. Read the notes. Recall the concepts. Keep your study materials together.</p><div class="auth-demo"><div class="auth-sheet-back" aria-hidden="true"></div><article class="auth-sheet-front"><div class="demo-label"><span>Example study card</span><span>01 / Recall</span></div><h3>What is active recall?</h3><p>Try answering before revealing the explanation.</p><button class="demo-reveal-btn" id="auth-demo-reveal" aria-expanded="false" aria-controls="auth-demo-answer">Reveal explanation <span>↗</span></button><div id="auth-demo-answer" class="demo-answer" hidden>Retrieving an idea from memory rather than simply rereading it. Answering a question or explaining a concept in your own words uses active recall.</div></article></div></div><div class="auth-footer">Lecture notes &nbsp; / &nbsp; Concept cards &nbsp; / &nbsp; Practice quizzes</div></section>
      <section class="auth-panel"><div class="auth-form-wrap"><div class="chapter-tag">Your account</div><h2 id="auth-heading">Welcome back.</h2><p id="auth-subtitle">Sign in to open your study workspace.</p>
        <div class="segmented" style="width:100%;margin-bottom:28px" role="group" aria-label="Account action"><button class="segmented-btn active" id="auth-tab-signin" aria-pressed="true" style="flex:1">Sign in</button><button class="segmented-btn" id="auth-tab-signup" aria-pressed="false" style="flex:1">Create account</button></div>
        <form id="auth-form" class="auth-form"><div class="form-group"><label class="form-label" for="auth-email">Email address</label><input class="form-input" id="auth-email" type="email" placeholder="you@example.com" autocomplete="email" required></div>
          <div class="form-group"><label class="form-label" for="auth-password">Password</label><input class="form-input" id="auth-password" type="password" placeholder="Your password" autocomplete="current-password" minlength="6" required></div>
          <div id="auth-error-box" class="card card-xs" role="alert" style="display:none;background:var(--danger-tint);color:var(--danger-400);font-size:13px"></div><div id="auth-success-box" class="card card-xs" role="status" style="display:none;background:var(--ok-tint);color:var(--ok-400);font-size:13px"></div>
          <button class="btn btn-primary btn-full btn-lg" id="auth-submit-btn" type="submit"><span>Sign in</span><svg width="16" height="16"><use href="#i-arrow-right"/></svg></button>
        </form><p class="auth-note">Your study materials are saved to your account.</p>
      </div></section>
    </div>`;

  document.getElementById('auth-demo-reveal').addEventListener('click', e => {
    const button = e.currentTarget;
    const answer = document.getElementById('auth-demo-answer');
    answer.hidden = !answer.hidden;
    button.setAttribute('aria-expanded',String(!answer.hidden));
    button.innerHTML = answer.hidden ? 'Reveal explanation <span>↗</span>' : 'Hide explanation <span>↗</span>';
  });

  let mode = 'signin';
  const tabIn = document.getElementById('auth-tab-signin');
  const tabUp = document.getElementById('auth-tab-signup');
  const submitBtn = document.getElementById('auth-submit-btn');

  tabIn?.addEventListener('click', () => {
    mode = 'signin';
    document.getElementById('auth-heading').textContent = 'Welcome back.';
    document.getElementById('auth-subtitle').textContent = 'Sign in to open your study workspace.';
    document.getElementById('auth-password').autocomplete = 'current-password';
    tabIn.setAttribute('aria-pressed','true');
    tabUp.setAttribute('aria-pressed','false');
    tabIn.classList.add('active');
    tabUp.classList.remove('active');
    submitBtn.querySelector('span').textContent = 'Sign In';
    clearMessages();
  });

  tabUp?.addEventListener('click', () => {
    mode = 'signup';
    document.getElementById('auth-heading').textContent = 'Create your account.';
    document.getElementById('auth-subtitle').textContent = 'Save your lectures, notes, and practice in one workspace.';
    document.getElementById('auth-password').autocomplete = 'new-password';
    tabIn.setAttribute('aria-pressed','false');
    tabUp.setAttribute('aria-pressed','true');
    tabUp.classList.add('active');
    tabIn.classList.remove('active');
    submitBtn.querySelector('span').textContent = 'Create Account';
    clearMessages();
  });

  document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = (document.getElementById('auth-email')?.value || '').trim();
    const password = document.getElementById('auth-password')?.value || '';

    if (!email || !password) {
      showErr('Please fill in both email and password.');
      return;
    }
    if (password.length < 6) {
      showErr('Password must be at least 6 characters.');
      return;
    }

    submitBtn.disabled = true;
    tabIn.disabled = tabUp.disabled = true;
    submitBtn.innerHTML = '<span>Authenticating…</span>';
    clearMessages();

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        showSuc('Account created! Please verify your email or sign in.');
      }
    } catch (e) {
      showErr(e.message || 'Authentication failed.');
    } finally {
      submitBtn.disabled = false;
      tabIn.disabled = tabUp.disabled = false;
      submitBtn.innerHTML = `<span>${mode === 'signin' ? 'Sign In' : 'Create Account'}</span>`;
    }
  });

  function showErr(msg) {
    const el = document.getElementById('auth-error-box');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function showSuc(msg) {
    const el = document.getElementById('auth-success-box');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function clearMessages() {
    const err = document.getElementById('auth-error-box');
    const suc = document.getElementById('auth-success-box');
    if (err) err.style.display = 'none';
    if (suc) suc.style.display = 'none';
  }
}
