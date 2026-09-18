import { signIn, signUp } from '../auth.js';
import { icon } from '../app.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div style="min-height:90vh;display:flex;align-items:center;justify-content:center;padding:24px;width:100%">
      <div class="card rev" style="width:100%;max-width:920px;padding:0;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;min-height:560px;--i:0" id="login-split-card">

        <!-- Left: Auth Form -->
        <div style="padding:48px 40px;display:flex;flex-direction:column;justify-content:center">
          
          <!-- Logo & Title -->
          <div style="margin-bottom:28px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div class="icon-chip cyan" style="width:40px;height:40px">
                ${icon('sparkles', '', 'width:20px;height:20px')}
              </div>
              <span class="mono-meta" style="font-size:0.75rem;color:var(--cyan)">SMART STUDY SUITE</span>
            </div>
            <h2 style="font-size:2rem;color:var(--text);letter-spacing:-0.03em">AI Learning <em>Companion</em></h2>
            <p style="font-size:0.86rem;color:var(--muted);margin-top:4px">Spaced repetition and AI-synthesized lecture notes</p>
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

          <div id="auth-error" style="display:none;margin-top:14px;padding:10px 14px;border-radius:var(--r-ctl);font-size:0.82rem;background:rgba(244,63,94,0.1);color:var(--coral);border:1px solid rgba(244,63,94,0.25)"></div>
          <div id="auth-success" style="display:none;margin-top:14px;padding:10px 14px;border-radius:var(--r-ctl);font-size:0.82rem;background:rgba(16,185,129,0.1);color:var(--emerald);border:1px solid rgba(16,185,129,0.25);text-align:center"></div>

          <button class="btn btn-primary btn-full btn-lg" id="auth-submit" style="margin-top:22px">
            <span>Sign In</span>
            ${icon('arrow-right', '', 'width:16px;height:16px')}
          </button>
        </div>

        <!-- Right: AI Showcase Cyber Visual Panel -->
        <div style="position:relative;background:linear-gradient(145deg, #0a0f1d 0%, #06090e 100%);border-left:1px solid var(--line);overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:40px 36px">
          <!-- Cyber Ambient Mesh Glow -->
          <div style="position:absolute;top:-40px;right:-40px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle, rgba(0,240,255,0.12) 0%, transparent 70%);pointer-events:none"></div>
          <div style="position:absolute;bottom:-30px;left:-30px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);pointer-events:none"></div>
          
          <div style="position:relative;z-index:2">
            <div class="pill pill-cyan" style="margin-bottom:14px;font-size:0.72rem;display:inline-flex">
              ${icon('brain-circuit', '', 'width:12px;height:12px')}
              <span>Next-Gen Recall Engine</span>
            </div>
            <h3 style="font-size:1.4rem;color:var(--text-pure);line-height:1.35;margin-bottom:10px;font-weight:700">Master any curriculum in half the time.</h3>
            <p style="font-size:0.84rem;color:var(--muted);line-height:1.6">
              Automated video summarization, SM-2 flashcard scheduling, and real-time comprehension drills.
            </p>
          </div>

          <div style="position:relative;z-index:2;display:flex;flex-direction:column;gap:12px;margin-top:24px">
            <div style="display:flex;align-items:center;gap:10px;font-size:0.8rem;color:var(--text-dim)">
              <div class="icon-chip cyan" style="width:28px;height:28px;flex-shrink:0">
                ${icon('zap', '', 'width:14px;height:14px')}
              </div>
              <span>Instant AI lecture synthesis</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.8rem;color:var(--text-dim)">
              <div class="icon-chip indigo" style="width:28px;height:28px;flex-shrink:0">
                ${icon('layers', '', 'width:14px;height:14px')}
              </div>
              <span>Spaced repetition memory retention</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.8rem;color:var(--text-dim)">
              <div class="icon-chip amber" style="width:28px;height:28px;flex-shrink:0">
                ${icon('shield-check', '', 'width:14px;height:14px')}
              </div>
              <span>Private cloud synchronized storage</span>
            </div>
          </div>
        </div>

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
