document.addEventListener('DOMContentLoaded', () => {
  // Init order: modal first so window.openAuthModal is ready
  initModal?.();
  initSearch?.();
  initPrimaryNav?.();
  initAvatarMenu?.();
  initDarkMode?.();
  initSidebar?.();
  initRefreshConfirm?.(); // confirm dialog for logo

  // Deep-link auth via ?auth=login|register and optional ?returnTo=...
  const params = new URLSearchParams(location.search);
  const mode = params.get('auth');
  const ret  = params.get('returnTo');
  if (ret) sessionStorage.setItem('auth:returnTo', ret);

  if (mode) {
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

	// If there's already a ?returnTo=... in the URL, your existing code handles it.
	// Otherwise, store the current location so the server can send them back here.
	const params = new URLSearchParams(location.search);
	if (!params.get('returnTo')) {
		const here = `${location.pathname}${location.search}${location.hash}`;
		sessionStorage.setItem('auth:returnTo', here);
	}
	}, true);

});
