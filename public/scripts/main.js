// /public/scripts/main.js
import { initSidebar }        from './features/sidebar.js';
import { initSearch }         from './features/search.js';
import { initAvatarMenu }     from './features/avatarMenu.js';
import { initPrimaryNav }     from './features/primaryNav.js';
import { initModal }          from './features/modal.js';
import { initDarkMode }       from './features/darkMode.js';
import { initRefreshConfirm } from './features/refreshConfirm.js';
import { initScrollTop }      from './features/scrollTop.js';

// Optional, page-specific bootstrap
import('./pages/home.js')
  .then(m => typeof m.init === 'function' && m.init())
  .catch(() => { /* no home.js, ignore */ });

document.addEventListener('DOMContentLoaded', () => {
  // Init order: modal first so window.openAuthModal is ready
  initModal?.();
  initSearch?.();
  initPrimaryNav?.();
  initAvatarMenu?.();
  initDarkMode?.();
  initSidebar?.();
  initRefreshConfirm?.();
  initScrollTop?.();

  // Deep-link auth via ?auth=login|register and optional ?returnTo=...
  const params = new URLSearchParams(location.search);
  const mode = params.get('auth');
  const ret  = params.get('returnTo');
  if (ret) sessionStorage.setItem('auth:returnTo', ret);

  if (mode === 'login' || mode === 'register') {
    window.openAuthModal?.(mode);
    // clean URL (remove both auth and returnTo)
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

  // Remember current page as returnTo whenever an auth opener is clicked
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
