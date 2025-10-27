// public/scripts/features/scrollTop.js
export function initScrollTop() {
  const btn = document.querySelector('[data-to-top]');
  if (!btn || btn.dataset.initialized) return;
  btn.dataset.initialized = '1';

  const THRESHOLD = 400; // px scrolled before showing

  const update = () => {
    const show = window.scrollY > THRESHOLD;
    btn.hidden = !show;
    btn.classList.toggle('to-top--show', show);
  };

  // Scroll to top (respect reduced motion)
  const toTop = () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  btn.addEventListener('click', toTop);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  // Initial state
  update();
}
