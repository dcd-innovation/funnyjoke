// /public/scripts/main.js
import { initSidebar }        from './features/sidebar.js';
import { initSearch }         from './features/search.js';
import { initAvatarMenu }     from './features/avatarMenu.js';
import { initPrimaryNav }     from './features/primaryNav.js';
import { initModal }          from './features/modal.js';
import { initDarkMode }       from './features/darkMode.js';
import { initRefreshConfirm } from './features/refreshConfirm.js';
import { initScrollTop }      from './features/scrollTop.js';

document.addEventListener('DOMContentLoaded', () => {
  // --- Core features (order matters: modal first) ---
  initModal?.();
  initSearch?.();
  initPrimaryNav?.();
  initAvatarMenu?.();
  initDarkMode?.();
  initSidebar?.();
  initRefreshConfirm?.();
  initScrollTop?.();

  // --- Page-scoped bootstrap: only load home.js if the home page is present ---
  const onHome = document.querySelector('[data-page="home"]');
  if (onHome) {
    import('./pages/home.js')
      .then(m => typeof m.init === 'function' && m.init())
      .catch(() => { /* missing home.js – safe to ignore */ });
  }

  // --- Deep-link auth handling (?auth=login|register & optional ?returnTo=...) ---
  const params = new URLSearchParams(location.search);
  const mode = params.get('auth');
  const ret  = params.get('returnTo');
  if (ret) sessionStorage.setItem('auth:returnTo', ret);

  if (mode === 'login' || mode === 'register') {
    window.openAuthModal?.(mode);
    // Clean URL (remove both auth and returnTo)
    params.delete('auth');
    params.delete('returnTo');
    const qs = params.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  } else {
    // If server surfaced an error, auto-open register form (modal.js reads the message)
    const errNode = document.getElementById('auth-error');
    if (errNode && errNode.dataset.error) {
      window.openAuthModal?.('register');
    }
  }

  // --- Remember current page as returnTo whenever an auth opener is clicked ---
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-post]');
    if (!opener) return;

    // If URL already has ?returnTo=..., keep it; otherwise, store current page.
    const p = new URLSearchParams(location.search);
    if (!p.get('returnTo')) {
      const here = `${location.pathname}${location.search}${location.hash}`;
      sessionStorage.setItem('auth:returnTo', here);
    }
  }, true);
});
