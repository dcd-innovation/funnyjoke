// /public/scripts/features/avatarMenu.js
export function initAvatarMenu() {
  const btn  = document.querySelector('[data-avatar-toggle]');
  const menu = document.querySelector('[data-avatar-menu]');
  if (!btn || !menu || btn.dataset.initialized === '1') return;
  btn.dataset.initialized = '1';

  // a11y wiring
  if (!menu.id) menu.id = 'avatarMenu';
  btn.setAttribute('aria-controls', menu.id);
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');

  const focusablesSel =
    'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

  let lastFocus = null;

  const open = () => {
    lastFocus = document.activeElement;
    menu.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    document.dispatchEvent(new CustomEvent('fj:popover-open', { detail: 'avatar' }));
    // focus first item
    menu.querySelector(focusablesSel)?.focus();
    bindGlobals();
  };

  const close = () => {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    unbindGlobals();
    // return focus for a11y
    (lastFocus instanceof HTMLElement ? lastFocus : btn)?.focus({ preventScroll: true });
  };

  const toggle = (e) => {
    e.stopPropagation();
    menu.classList.contains('is-open') ? close() : open();
  };

  // Clicks
  btn.addEventListener('click', toggle);
  // Inside menu: don’t bubble to document
  menu.addEventListener('click', (e) => {
    // close when an actionable item is clicked
    if (e.target.closest('a, button, [role="menuitem"]')) close();
    e.stopPropagation();
  });

  // Global handlers
  const onDocClick = (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) close();
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key === 'Tab' && menu.classList.contains('is-open')) {
      const items = Array.from(menu.querySelectorAll(focusablesSel));
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      } else {
        if (i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    }
  };
  const onPopoverOpen = (e) => { if (e.detail !== 'avatar') close(); };
  const onResize = () => close();

  function bindGlobals() {
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('fj:popover-open', onPopoverOpen);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }
  function unbindGlobals() {
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('fj:popover-open', onPopoverOpen);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
  }

  // Optional cleanup for HMR/hot-reload
  return () => {
    unbindGlobals();
    btn.removeEventListener('click', toggle);
    close();
    delete btn.dataset.initialized;
  };
}
