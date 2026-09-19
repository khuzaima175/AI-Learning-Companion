/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Authentication Screen (`#/login`)
   Restrained 400px Centered Card with Clean Form Controls
   ══════════════════════════════════════════════════════════════════ */

import { signIn, signUp } from '../auth.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div style="min-height:80vh;display:flex;align-items:center;justify-content:center;padding:24px;width:100%">
      <div class="card" style="width:100%;max-width:400px;padding:32px 28px">
        
        <!-- Logo & Header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
          <div class="icon-tile accent" style="width:32px;height:32px">
            <svg style="width:16px;height:16px"><use href="#i-brand-logo"/></svg>
          </div>
          <div>
            <div style="font-weight:600;font-size:15px;color:var(--txt-1)">AI Learning Companion</div>
            <div class="caption-text">Active Study Workspace</div>
          </div>
        </div>

        <!-- Mode Segmented Tabs -->
        <div class="segmented" style="width:100%;margin-bottom:20px">
          <button class="segmented-btn active" id="auth-tab-signin" style="flex:1">Sign In</button>
          <button class="segmented-btn" id="auth-tab-signup" style="flex:1">Create Account</button>
        </div>

        <!-- Inputs -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="form-group">
            <label class="form-label" for="auth-email">Email Address</label>
            <input class="form-input" id="auth-email" type="email" placeholder="name@university.edu" autocomplete="email" />
          </div>

          <div class="form-group">
            <label class="form-label" for="auth-password">Password</label>
            <input class="form-input" id="auth-password" type="password" placeholder="••••••••" autocomplete="current-password" />
          </div>

          <div id="auth-error-box" class="card card-xs" style="display:none;background:var(--danger-tint);color:var(--danger-400);border-color:rgba(224,92,71,0.3);font-size:12.5px"></div>
          <div id="auth-success-box" class="card card-xs" style="display:none;background:var(--ok-tint);color:var(--ok-400);border-color:rgba(79,184,121,0.3);font-size:12.5px"></div>

          <button class="btn btn-primary btn-full btn-lg" id="auth-submit-btn" style="margin-top:8px">
            <span>Sign In</span>
          </button>
        </div>

        <div class="caption-text mono" style="margin-top:20px;text-align:center">
          Cloud-synchronized multi-tenant study database.
        </div>

      </div>
    </div>
  `;

  let mode = 'signin';
  const tabIn = document.getElementById('auth-tab-signin');
  const tabUp = document.getElementById('auth-tab-signup');
  const submitBtn = document.getElementById('auth-submit-btn');

  tabIn?.addEventListener('click', () => {
    mode = 'signin';
    tabIn.classList.add('active');
    tabUp.classList.remove('active');
    submitBtn.querySelector('span').textContent = 'Sign In';
    clearMessages();
  });

  tabUp?.addEventListener('click', () => {
    mode = 'signup';
    tabUp.classList.add('active');
    tabIn.classList.remove('active');
    submitBtn.querySelector('span').textContent = 'Create Account';
    clearMessages();
  });

  submitBtn?.addEventListener('click', async () => {
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
      submitBtn.innerHTML = `<span>${mode === 'signin' ? 'Sign In' : 'Create Account'}</span>`;
    }
  });

  document.getElementById('auth-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitBtn?.click();
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
