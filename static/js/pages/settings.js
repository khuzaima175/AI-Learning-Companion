/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Settings & User Preferences (`#/settings`)
   Restrained Configuration Pane for Account, Study Goals & Data Cache
   ══════════════════════════════════════════════════════════════════ */

import { getUser, signOut } from '../auth.js';
import { DailyGoal, showToast, updateGlobalMetrics, escapeHtml } from '../app.js';
import { setMotionPreference } from '../motion.js';

export async function renderSettings(container) {
  const user = getUser();
  const goal = DailyGoal.get();

  container.innerHTML = `
    <!-- Header -->
    <div class="page-head">
      <div>
        <div class="chapter-tag"><span>05</span>Workspace preferences</div><h1 class="page-head-title">Settings</h1>
        <div class="page-head-desc">Your account, daily target, and motion preferences.</div>
      </div>
    </div>

    <div class="settings-layout"><nav class="settings-index" aria-label="Settings sections"><a href="#settings-account" data-scroll="settings-account"><span class="mono">01</span>Account</a><a href="#settings-study" data-scroll="settings-study"><span class="mono">02</span>Study &amp; motion</a><a href="#settings-cache" data-scroll="settings-cache"><span class="mono">03</span>Local cache</a></nav><div class="settings-stack">
      
      <!-- Profile Card -->
      <div class="card" id="settings-account">
        <span class="card-title" style="margin-bottom:14px;display:block">Account</span>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div class="user-avatar" style="width:40px;height:40px;font-size:14px">${(user?.email || 'ST').slice(0, 2).toUpperCase()}</div>
          <div style="flex:1;min-width:160px">
            <div style="font-weight:600;font-size:14px;color:var(--txt-1);overflow:hidden;text-overflow:ellipsis">${escapeHtml(user?.email || 'Student Account')}</div>
            <div class="caption-text">Your personal learning account</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="settings-logout-btn">Sign Out</button>
        </div>
      </div>

      <!-- Study Preferences -->
      <div class="card" id="settings-study">
        <span class="card-title" style="margin-bottom:14px;display:block">Study &amp; motion</span>
        
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label" for="setting-target-input">Daily Card Review Target</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <input class="form-input" id="setting-target-input" type="number" min="5" max="500" value="${goal.target || 20}" style="max-width:140px" />
            <button class="btn btn-secondary btn-sm" id="setting-save-target-btn">Update Target</button>
          </div>
          <span class="caption-text">Choose a target between 5 and 500 cards. You can adjust it at any time.</span>
        </div>

        <div style="border-top:1px solid var(--line-1);padding-top:18px"><label class="form-label" for="setting-motion">Motion &amp; animations</label><p class="caption-text" style="margin-top:6px">Choose the motion that feels right for you. Device accessibility preferences are always respected.</p><select class="form-select motion-choice" id="setting-motion"><option value="system">Follow device preference</option><option value="full">Standard animations</option><option value="reduced">Reduce animations</option></select></div>
      </div>

      <!-- Danger Zone / Cache Management -->
      <div class="card" id="settings-cache" style="border-color:rgba(224, 92, 71, 0.25)">
        <span class="card-title" style="margin-bottom:12px;display:block;color:var(--danger-400)">Local cache</span>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <div style="font-size:13px;font-weight:500;color:var(--txt-1)">Clear Local Data Cache</div>
            <div class="caption-text">Clear cached view data while keeping your study goals and history.</div>
          </div>
          <button class="btn btn-danger btn-sm" id="settings-clear-cache-btn">Clear cache</button>
        </div>
      </div>

    </div></div>
  `;

  container.querySelectorAll('[data-scroll]').forEach(link => link.addEventListener('click', e => { e.preventDefault(); document.getElementById(link.dataset.scroll)?.scrollIntoView({behavior:document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'}); }));
  const motionSelect = document.getElementById('setting-motion');
  motionSelect.value = localStorage.getItem('alc_motion') || 'system';
  motionSelect.addEventListener('change', () => { setMotionPreference(motionSelect.value); showToast('Motion preference updated.', 'success'); });

  document.getElementById('settings-logout-btn')?.addEventListener('click', signOut);

  document.getElementById('setting-save-target-btn')?.addEventListener('click', () => {
    const val = parseInt(document.getElementById('setting-target-input')?.value, 10);
    if (val >= 5 && val <= 500) {
      DailyGoal.save('cards', val);
      updateGlobalMetrics();
      showToast(`Daily target set to ${val} cards`, 'success');
    } else {
      showToast('Enter a target between 5 and 500', 'warn');
    }
  });

  document.getElementById('settings-clear-cache-btn')?.addEventListener('click', () => {
    if (confirm('Clear local cache and refresh app?')) {
      Object.keys(localStorage).filter(k => k.startsWith('alc_cache_')).forEach(k => localStorage.removeItem(k));
      window.location.reload();
    }
  });
}
