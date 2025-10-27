// /public/scripts/features/avatarMenu.js
export function initAvatarMenu() {
  const avatarBtn  = document.querySelector('[data-avatar-toggle]');
  const avatarMenu = document.querySelector('[data-avatar-menu]');
  if (!avatarBtn || !avatarMenu || avatarBtn.dataset.initialized) return;

  // one-time guard
  avatarBtn.dataset.initialized = 'true';

  // a11y wiring
  if (!avatarMenu.id) avatarMenu.id = 'avatarMenu';
  avatarBtn.setAttribute('aria-controls', avatarMenu.id);
  avatarBtn.setAttribute('aria-haspopup', 'menu');
  avatarBtn.setAttribute('aria-expanded', 'false');

  const open = () => {
    avatarMenu.classList.add('is-open');
    avatarBtn.setAttribute('aria-expanded', 'true');
    // tell other widgets to close themselves
    document.dispatchEvent(new CustomEvent('fj:popover-open', { detail: 'avatar' }));
  };

  const close = () => {
    avatarMenu.classList.remove('is-open');
    avatarBtn.setAttribute('aria-expanded', 'false');
  };

  const toggle = (e) => {
    e.stopPropagation();
    (avatarMenu.classList.contains('is-open') ? close : open)();
  };

  // handlers
  avatarBtn.addEventListener('click', toggle);
  avatarMenu.addEventListener('click', (e) => e.stopPropagation());

  const onDocClick = (e) => {
    if (!avatarMenu.contains(e.target) && !avatarBtn.contains(e.target)) close();
  };
  document.addEventListener('click', onDocClick);

  const onKeyDown = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKeyDown);

  // close if another popover opens
  const onPopoverOpen = (e) => { if (e.detail !== 'avatar') close(); };
  document.addEventListener('fj:popover-open', onPopoverOpen);

  // optional: expose a cleanup for hot-reload or teardown
  return () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('fj:popover-open', onPopoverOpen);
    avatarBtn.removeEventListener('click', toggle);
    close();
    delete avatarBtn.dataset.initialized;
  };
}
