// /public/scripts/features/darkMode.js
export function initDarkMode() {
  const KEY  = 'fj-theme';                 // 'dark' | 'light' | null
  const root = document.documentElement;    // <html>
  const dm   = document.getElementById('darkModeToggle');

  // Read saved + system prefs
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const systemMode = mql.matches ? 'dark' : 'light';
  const savedMode  = localStorage.getItem(KEY); // may be null

  // Apply a mode to DOM (+ meta theme-color)
  const apply = (mode) => {
    const dark = mode === 'dark';
    root.classList.toggle('dark', dark);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0E0E0E' : '#ffffff'); // match your base.css

    if (dm) dm.checked = dark;
  };

  // Initial paint: saved wins, else system
  apply(savedMode || systemMode);

  // Guard so we don’t bind twice on hot-reload
  if (dm && !dm.dataset.initialized) {
    dm.dataset.initialized = 'true';
    dm.setAttribute('aria-pressed', String(dm.checked));

    dm.addEventListener('change', () => {
      const mode = dm.checked ? 'dark' : 'light';
      localStorage.setItem(KEY, mode);
      apply(mode);
      dm.setAttribute('aria-pressed', String(dm.checked));
    });
  }

  // If user has NOT chosen a mode (no saved pref), follow system changes
  const onSystemChange = (e) => {
    if (!localStorage.getItem(KEY)) apply(e.matches ? 'dark' : 'light');
  };
  mql.addEventListener?.('change', onSystemChange);

  // Keep multiple tabs/windows in sync
  const onStorage = (e) => {
    if (e.key === KEY) apply(e.newValue || systemMode);
  };
  window.addEventListener('storage', onStorage);

  // Optional teardown (useful for hot-reload)
  return () => {
    mql.removeEventListener?.('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
    if (dm) delete dm.dataset.initialized;
  };
}
