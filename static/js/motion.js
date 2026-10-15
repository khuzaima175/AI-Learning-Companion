/* Motion lifecycle for initial, asynchronous and in-session UI updates. */
const media = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let observer, mutations, currentRoot, pointerFrame, mutationFrame, tabsResize;
const countValues = new WeakMap();
const barValues = new WeakMap();
const frames = new Map();
const animations = new Set();
const seen = new WeakSet();

export function reducedMotion() {
  return media.matches || document.documentElement.dataset.motion === 'reduced';
}

export function setMotionPreference(value = 'system') {
  const preference = ['system', 'full', 'reduced'].includes(value) ? value : 'system';
  localStorage.setItem('alc_motion', preference);
  document.documentElement.dataset.motion = preference;
  if (currentRoot) {
    const root = currentRoot;
    cleanupMotion();
    initMotion(root);
  }
}

document.documentElement.dataset.motion = localStorage.getItem('alc_motion') || 'system';
media.addEventListener('change', () => {
  if (currentRoot) {
    const root = currentRoot;
    cleanupMotion();
    initMotion(root);
  }
});

function countUp(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target) || countValues.get(el) === target) return;
  countValues.set(el, target);
  const suffix = el.dataset.countSuffix || '';
  if (reducedMotion()) { el.textContent = `${target}${suffix}`; return; }
  if (frames.has(el)) cancelAnimationFrame(frames.get(el));
  const start = performance.now();
  const step = now => {
    if (!el.isConnected) { frames.delete(el); return; }
    const t = Math.min((now - start) / 850, 1);
    el.textContent = `${Math.round(target * (1 - (1 - t) ** 3))}${suffix}`;
    if (t < 1) frames.set(el, requestAnimationFrame(step));
    else frames.delete(el);
  };
  frames.set(el, requestAnimationFrame(step));
}

function animateBar(el) {
  const value = `${el.style.width}|${el.style.height}|${el.dataset.barWidth || ''}|${el.dataset.barHeight || ''}`;
  if (barValues.get(el) === value) return;
  barValues.set(el, value);
  if (el.dataset.barWidth) el.style.width = el.dataset.barWidth;
  if (el.dataset.barHeight) el.style.height = el.dataset.barHeight;
  if (reducedMotion() || !el.animate) return;
  const vertical = el.classList.contains('chart-bar-fill') || !!el.dataset.barHeight;
  const anim = el.animate([
    { transform: vertical ? 'scaleY(0)' : 'scaleX(0)', transformOrigin: vertical ? 'bottom' : 'left' },
    { transform: 'scale(1)', transformOrigin: vertical ? 'bottom' : 'left' },
  ], { duration: 850, easing: 'cubic-bezier(.16,1,.3,1)' });
  animations.add(anim);
  anim.finished.catch(() => {}).finally(() => animations.delete(anim));
}

function updateSelection(group) {
  const selected = group.querySelector('.segmented-btn.active');
  if (!selected) return;
  group.style.setProperty('--selection-x',`${selected.offsetLeft}px`);
  group.style.setProperty('--selection-y',`${selected.offsetTop}px`);
  group.style.setProperty('--selection-width',`${selected.offsetWidth}px`);
  group.style.setProperty('--selection-height',`${selected.offsetHeight}px`);
}

function prepare(root) {
  root.querySelectorAll('.segmented').forEach(group => {
    if (!group.classList.contains('moving-tabs')) {
      group.classList.add('moving-tabs');
      group.addEventListener('click',() => queueMicrotask(() => updateSelection(group)));
    }
    updateSelection(group);
    tabsResize?.observe(group);
  });
  root.querySelectorAll('[data-stagger]').forEach(group => {
    [...group.children].forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--i', Math.min(i, 5));
    });
  });
  root.querySelectorAll('.page-head,.desk-hero,.workspace-section,.import-deliverables,.import-form,.insights-volume,.insights-calendar,.card,.stat-card,.concept-card-item,.library-courses-pane').forEach(el => {
    if (seen.has(el) || el.closest('.flip-card') || (el.parentElement.closest('.card') && !el.classList.contains('today-continue-card'))) return;
    seen.add(el);
    el.classList.add('reveal');
  });
  root.querySelectorAll('.reveal:not(.in)').forEach(el => {
    if (reducedMotion() || !observer) { el.classList.add('in'); return; }
    el.classList.add('motion-pending');
    observer.observe(el);
  });
  root.querySelectorAll('[data-count]').forEach(el => {
    if (countValues.get(el) !== Number(el.dataset.count)) {
      if (reducedMotion() || !observer) countUp(el);
      else observer.observe(el);
    }
  });
  root.querySelectorAll('.progress-fill,.chart-bar-fill,[data-chart-bar]').forEach(animateBar);
  root.querySelectorAll('.radio-card,.course-row-item,.quiz-opt-row,.lec-option-row').forEach(el => {
    if (el.dataset.keyboardReady) return;
    el.dataset.keyboardReady = 'true';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!el.classList.contains('disabled') && !el.classList.contains('answered')) el.click();
      }
    });
  });
}

function pointerMove(e) {
  if (pointerFrame || reducedMotion() || !finePointer.matches) return;
  const card = e.target.closest('.card.spot,.welcome-banner');
  if (!card) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = null;
    if (!card.isConnected) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    card.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
}

export function initMotion(root = document) {
  cleanupMotion();
  currentRoot = root;
  document.documentElement.classList.add('motion-ready');
  if ('IntersectionObserver' in window && !reducedMotion()) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        target.classList.add('in');
        target.classList.remove('motion-pending');
        if (target.hasAttribute('data-count')) countUp(target);
        observer?.unobserve(target);
      });
    }, { threshold: .06 });
  }
  if ('ResizeObserver' in window) tabsResize = new ResizeObserver(entries => entries.forEach(({target}) => updateSelection(target)));
  prepare(root);
  mutations = new MutationObserver(records => {
    // Counter text changes must not retrigger scanning every animation frame.
    const meaningful = records.some(r => r.type === 'attributes' || [...r.addedNodes].some(n => n.nodeType === 1));
    if (!meaningful || mutationFrame) return;
    mutationFrame = requestAnimationFrame(() => {
      mutationFrame = null;
      if (currentRoot) prepare(currentRoot);
    });
  });
  mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-count'] });
  root.addEventListener('pointermove', pointerMove, { passive: true });
}

export function cleanupMotion() {
  observer?.disconnect();
  mutations?.disconnect();
  tabsResize?.disconnect();
  currentRoot?.removeEventListener('pointermove', pointerMove);
  currentRoot?.querySelectorAll('.motion-pending').forEach(el => {
    el.classList.remove('motion-pending');
    el.classList.add('in');
  });
  frames.forEach((frame, el) => {
    cancelAnimationFrame(frame);
    el.textContent = `${el.dataset.count}${el.dataset.countSuffix || ''}`;
  });
  frames.clear();
  animations.forEach(a => a.cancel());
  animations.clear();
  if (pointerFrame) cancelAnimationFrame(pointerFrame);
  if (mutationFrame) cancelAnimationFrame(mutationFrame);
  observer = mutations = currentRoot = pointerFrame = mutationFrame = tabsResize = null;
}

export function animateContent(el) {
  if (reducedMotion() || !el.animate) return;
  const animation = el.animate([{opacity:0,transform:'translateX(8px)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});
  animations.add(animation);
  animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
}
