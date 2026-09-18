/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Settings & User Preferences (`#/settings`)
   Restrained Configuration Pane for Account, Study Goals & Data Cache
   ══════════════════════════════════════════════════════════════════ */

import { getUser, signOut } from '../auth.js';
import { DailyGoal, showToast } from '../app.js';

export async function renderSettings(container) {
  const user = getUser();
  const goal = DailyGoal.get();

  container.innerHTML = `
    <!-- Header -->
    <div class="page-head">
      <div>
        <h1 class="page-head-title">Settings</h1>
        <div class="page-head-desc">Account profile, study interval preferences, and local cache controls.</div>
      </div>
    </div>

    <div style="max-width:640px;display:flex;flex-direction:column;gap:18px">
      
      <!-- Profile Card -->
      <div class="card">
        <span class="card-title" style="margin-bottom:14px;display:block">Account Identity</span>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="user-avatar" style="width:40px;height:40px;font-size:14px">${(user?.email || 'ST').slice(0, 2).toUpperCase()}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;color:var(--txt-1)">${user?.email || 'Student Account'}</div>
            <div class="caption-text">Supabase Cloud Authenticated Session</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="settings-logout-btn">Sign Out</button>
        </div>
      </div>

      <!-- Study Preferences -->
      <div class="card">
        <span class="card-title" style="margin-bottom:14px;display:block">Study Cadence &amp; Goals</span>
        
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label" for="setting-target-input">Daily Card Review Target</label>
          <div style="display:flex;gap:10px">
            <input class="form-input" id="setting-target-input" type="number" min="5" max="200" value="${goal.target || 20}" style="max-width:140px" />
            <button class="btn btn-secondary btn-sm" id="setting-save-target-btn">Update Target</button>
          </div>
          <span class="caption-text">Recommended: 15–30 cards per day for steady retention.</span>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--line-1)">
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--txt-1)">Interval Predictions</div>
            <div class="caption-text">Show next recall intervals ("10m", "1d", "3d", "7d") on grading buttons.</div>
          </div>
          <input type="checkbox" class="chk-input" checked id="setting-intervals-chk" />
        </div>
      </div>

      <!-- Danger Zone / Cache Management -->
      <div class="card" style="border-color:rgba(224, 92, 71, 0.25)">
        <span class="card-title" style="margin-bottom:12px;display:block;color:var(--danger-400)">Local Cache Management</span>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--txt-1)">Clear Local Data Cache</div>
            <div class="caption-text">Purges stored streak history and local SWR cache. Cloud data remains safe.</div>
          </div>
          <button class="btn btn-danger btn-sm" id="settings-clear-cache-btn">Purge Cache</button>
        </div>
      </div>

    </div>
  `;

  document.getElementById('settings-logout-btn')?.addEventListener('click', signOut);

  document.getElementById('setting-save-target-btn')?.addEventListener('click', () => {
    const val = parseInt(document.getElementById('setting-target-input')?.value, 10);
    if (val >= 5 && val <= 500) {
      DailyGoal.save('cards', val);
      showToast(`Daily target set to ${val} cards`, 'success');
    } else {
      showToast('Enter a target between 5 and 500', 'warn');
    }
  });

  document.getElementById('settings-clear-cache-btn')?.addEventListener('click', () => {
    if (confirm('Clear local cache and refresh app?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  });
}
