import { signIn, signUp } from '../auth.js';
import { icon } from '../app.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;width:100%">
      <div class="card" style="width:100%;max-width:420px;padding:38px 32px">

        <!-- Logo & Title -->
        <div style="text-align:center;margin-bottom:28px">
          <div class="icon-chip teal" style="width:52px;height:52px;margin:0 auto 14px">
            ${icon('sparkles', '', 'width:26px;height:26px')}
          </div>
          <h2 style="font-size:1.8rem;color:var(--text)">AI Learning <em>Companion</em></h2>
          <p style="font-size:0.82rem;color:var(--muted);margin-top:4px">Your personalized AI study companion</p>
        </div>

        <!-- Tab Switching -->
        <div class="tabs-segmented" style="margin-bottom:20px">
          <button class="tab-btn-v2 active" id="tab-signin" style="flex:1">Sign In</button>
          <button class="tab-btn-v2" id="tab-signup" style="flex:1">Create Account</button>
        </div>

        <!-- Form Fields -->
        <div class="form-group">
          <label class="form-label" for="auth-email">Email Address</label>
          <input id="auth-email" class="form-input input" type="email" placeholder="you@university.edu" />
        </div>

        <div class="form-group" style="margin-top:14px">
          <label class="form-label" for="auth-password">Password</label>
          <input id="auth-password" class="form-input input" type="password" placeholder="••••••••" />
        </div>

        <div id="auth-error" style="display:none;margin-top:14px;padding:10px 14px;border-radius:var(--r-ctl);font-size:0.82rem;background:rgba(251,113,133,0.1);color:var(--coral);border:1px solid rgba(251,113,133,0.3)"></div>
        <div id="auth-success" style="display:none;margin-top:14px;padding:10px 14px;border-radius:var(--r-ctl);font-size:0.82rem;background:rgba(52,211,153,0.1);color:var(--emerald);border:1px solid rgba(52,211,153,0.3);text-align:center"></div>

        <button class="btn btn-primary btn-full btn-lg" id="auth-submit" style="margin-top:22px">
          <span>Sign In</span>
          ${icon('arrow-right', '', 'width:16px;height:16px')}
        </button>

      </div>
    </div>
  `;

  let mode = 'signin';

  document.getElementById('tab-signin')?.addEventListener('click', () => {
    mode = 'signin';
    document.getElementById('tab-signin').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('auth-submit').querySelector('span').textContent = 'Sign In';
    clearMessages();
  });

  document.getElementById('tab-signup')?.addEventListener('click', () => {
    mode = 'signup';
    document.getElementById('tab-signup').classList.add('active');
    document.getElementById('tab-signin').classList.remove('active');
    document.getElementById('auth-submit').querySelector('span').textContent = 'Create Account';
    clearMessages();
  });

  document.getElementById('auth-submit')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
    const btn = document.getElementById('auth-submit');

    if (!email || !password) { showError('Please fill in both fields'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters'); return; }

    btn.classList.add('btn-loading');
    btn.disabled = true;
    clearMessages();

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        showSuccess('Account created! Check your email to confirm, then sign in.');
      }
    } catch (e) {
      showError(e.message);
    } finally {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  });

  document.getElementById('auth-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('auth-submit')?.click();
  });

  function showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = '❌ ' + msg; el.style.display = 'block'; }
  }
  function showSuccess(msg) {
    const el = document.getElementById('auth-success');
    if (el) { el.textContent = '✅ ' + msg; el.style.display = 'block'; }
  }
  function clearMessages() {
    const err = document.getElementById('auth-error');
    const suc = document.getElementById('auth-success');
    if (err) err.style.display = 'none';
    if (suc) suc.style.display = 'none';
  }
}
