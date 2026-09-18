/* ══════════════════════════════════════════════════════════════════
   AI Learning Companion — Motion System & Micro-Interactions Engine
   Scroll Reveals, Count-ups, Cursor Spotlights & Lifecycle Cleanup
   ══════════════════════════════════════════════════════════════════ */

let _revealObserver = null;
let _countObserver = null;
let _chartObserver = null;
let _rafPointer = null;
let _hasPointerListener = false;

// Ease out cubic
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Animate count-up for numbers (e.g. 170, 80, 24)
function animateCountUp(el) {
  const target = parseFloat(el.dataset.count || el.textContent);
  if (isNaN(target)) return;

  const isPercent = el.dataset.countSuffix === '%' || (el.textContent && el.textContent.includes('%'));
  const duration = 650;
  const startTime = performance.now();
  const startVal = 0;

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const current = Math.round(startVal + (target - startVal) * eased);

    el.textContent = isPercent ? `${current}%` : `${current}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = isPercent ? `${target}%` : `${target}`;
    }
  }

  requestAnimationFrame(step);
}

// Animate chart progress/bar
function animateBar(el) {
  const targetW = el.dataset.barWidth;
  const targetH = el.dataset.barHeight;
  if (targetW) {
    el.style.width = targetW;
  }
  if (targetH) {
    el.style.height = targetH;
  }
}

// Setup pointer listener once globally
function setupPointerTracker() {
  if (_hasPointerListener) return;
  _hasPointerListener = true;

  document.addEventListener('mousemove', (e) => {
    if (_rafPointer) return;
    _rafPointer = requestAnimationFrame(() => {
      _rafPointer = null;
      const card = e.target.closest('.card.spot');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
    });
  }, { passive: true });
}

export function initMotion(root = document) {
  setupPointerTracker();

  // 1. Stagger attributes setup
  root.querySelectorAll('[data-stagger]').forEach(group => {
    [...group.children].forEach((child, idx) => {
      if (!child.classList.contains('reveal')) {
        child.classList.add('reveal');
      }
      child.style.setProperty('--i', idx);
    });
  });

  // 2. Scroll Reveal Observer
  _revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        _revealObserver?.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -24px 0px'
  });

  root.querySelectorAll('.reveal:not(.in)').forEach(el => {
    _revealObserver.observe(el);
  });

  // 3. Count-up Observer
  _countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCountUp(entry.target);
        _countObserver?.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15
  });

  root.querySelectorAll('[data-count]').forEach(el => {
    _countObserver.observe(el);
  });

  // 4. Chart / Bar growth Observer
  _chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateBar(entry.target);
        _chartObserver?.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15
  });

  root.querySelectorAll('[data-chart-bar]').forEach(el => {
    _chartObserver.observe(el);
  });
}

export function cleanupMotion() {
  if (_revealObserver) {
    _revealObserver.disconnect();
    _revealObserver = null;
  }
  if (_countObserver) {
    _countObserver.disconnect();
    _countObserver = null;
  }
  if (_chartObserver) {
    _chartObserver.disconnect();
    _chartObserver = null;
  }
  if (_rafPointer) {
    cancelAnimationFrame(_rafPointer);
    _rafPointer = null;
  }
}
