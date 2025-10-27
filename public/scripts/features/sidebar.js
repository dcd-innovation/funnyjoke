// public/scripts/features/sidebar.js
export function initSidebar() {
  const sbBtn   = document.querySelector('[data-sidebar-toggle]');
  const shell   = document.getElementById('page-shell');
  const DESK_BP = 861; // match your CSS breakpoint

  if (!sbBtn || !shell || sbBtn.dataset.initialized) return;
  sbBtn.dataset.initialized = 'true';

  // a11y wiring
  if (!sbBtn.getAttribute('aria-controls')) {
    sbBtn.setAttribute('aria-controls', shell.id || 'page-shell');
  }
  sbBtn.setAttribute('aria-expanded', 'true'); // default: sidebar visible on desktop

  const isDesktop = () => window.innerWidth >= DESK_BP;

  const setAria = () => {
    if (isDesktop()) {
      // expanded = sidebar visible (not collapsed)
      sbBtn.setAttribute('aria-expanded', String(!shell.classList.contains('sidebar-collapsed')));
    } else {
      // expanded = off-canvas open
      sbBtn.setAttribute('aria-expanded', String(shell.classList.contains('sidebar-open')));
    }
  };

  const onClick = () => {
    if (isDesktop()) {
      // Desktop: toggle collapsed column
      shell.classList.toggle('sidebar-collapsed');
      shell.classList.remove('sidebar-open'); // ensure no mobile class leaks
    } else {
      // Mobile: off-canvas slide
      shell.classList.toggle('sidebar-open');
      shell.classList.remove('sidebar-collapsed'); // ensure no desktop class leaks
    }
    setAria();
  };

  sbBtn.addEventListener('click', onClick);

  // Close on Esc (both modes)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isDesktop()) {
      if (!shell.classList.contains('sidebar-collapsed')) {
        shell.classList.add('sidebar-collapsed');
        setAria();
      }
    } else {
      if (shell.classList.contains('sidebar-open')) {
        shell.classList.remove('sidebar-open');
        setAria();
      }
    }
  });

  // Normalize across breakpoint
  window.addEventListener('resize', setAria);

  // Initial sync
  setAria();
}
