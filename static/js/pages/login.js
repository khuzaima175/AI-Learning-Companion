import { signIn, signUp } from '../auth.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;
                justify-content:center;padding:24px">
      <div class="card" style="width:100%;max-width:400px;padding:36px">

        <!-- Logo -->
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:2.5rem;margin-bottom:8px">🎓</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--text)">AI Learning Companion</div>
          <div style="font-size:.82rem;color:var(--text-3);margin-top:4px">Your personal AI tutor</div>
        </div>

        <!-- Tabs -->
        <div class="tabs" style="margin-bottom:24px; display:flex; gap:8px">
          <button class="tab-btn active" id="tab-signin" style="flex:1">Sign In</button>
          <button class="tab-btn" id="tab-signup" style="flex:1">Sign Up</button>
        </div>

        <!-- Form -->
        <div class="form-group">
          <label class="form-label">Email</label>
          <input id="auth-email" class="form-input" type="email" placeholder="you@example.com" />
        </div>
        <div class="form-group" style="margin-top:14px">
          <label class="form-label">Password</label>
          <input id="auth-password" class="form-input" type="password" placeholder="••••••••" />
        </div>

        <div id="auth-error" style="display:none;margin-top:12px;
             padding:10px 14px;border-radius:8px;font-size:.82rem;
             background:rgba(255,107,107,0.1);color:var(--coral);
             border:1px solid rgba(255,107,107,0.3)"></div>

        <button class="btn btn-teal btn-full btn-lg" id="auth-submit" style="margin-top:20px; width:100%">
          Sign In
        </button>

        <div id="auth-success" style="display:none;margin-top:12px;
             padding:10px 14px;border-radius:8px;font-size:.82rem;
             background:rgba(16,185,129,0.1);color:var(--emerald);
             border:1px solid rgba(16,185,129,0.3);text-align:center"></div>

      </div>
    </div>
  `;

  let mode = 'signin'; // or 'signup'

  // Tab switching
  document.getElementById('tab-signin').addEventListener('click', () => {
    mode = 'signin';
    document.getElementById('tab-signin').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('auth-submit').textContent = 'Sign In';
    clearMessages();
  });

  document.getElementById('tab-signup').addEventListener('click', () => {
    mode = 'signup';
    document.getElementById('tab-signup').classList.add('active');
    document.getElementById('tab-signin').classList.remove('active');
    document.getElementById('auth-submit').textContent = 'Create Account';
    clearMessages();
  });

  // Submit
  document.getElementById('auth-submit').addEventListener('click', async () => {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn      = document.getElementById('auth-submit');

    if (!email || !password) { showError('Please fill in both fields'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters'); return; }

    btn.classList.add('btn-loading');
    btn.disabled = true;
    clearMessages();

    try {
      if (mode === 'signin') {
        await signIn(email, password);
        // onAuthStateChange in app.js will handle the redirect
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

  // Enter key support
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('auth-submit').click();
  });

  function showError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = '❌ ' + msg;
    el.style.display = '';
  }
  function showSuccess(msg) {
    const el = document.getElementById('auth-success');
    el.textContent = '✅ ' + msg;
    el.style.display = '';
  }
  function clearMessages() {
    document.getElementById('auth-error').style.display   = 'none';
    document.getElementById('auth-success').style.display = 'none';
  }
}
