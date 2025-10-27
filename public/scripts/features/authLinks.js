// public/scripts/features/authLinks.js
// Minimal helper: only opens the modal for explicit openers.
// It does NOT intercept [data-auth] links anywhere.

export function initAuthLinks() {
  // Guard against double init
  if (document.documentElement.dataset.authLinksInit) return;
  document.documentElement.dataset.authLinksInit = '1';

  const modal = document.querySelector('[data-post-modal]');
  if (!modal) return;

  // Open the modal when clicking any [data-open-post]
  document.querySelectorAll('[data-open-post]').forEach(opener => {
    opener.addEventListener('click', (e) => {
      // Keep href as no-JS fallback, but prevent navigation when JS is active
      if (opener.tagName === 'A') e.preventDefault();

      if (!modal.classList.contains('open')) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
      }
    });
  });

  // NOTE: We intentionally do NOT bind any global handler for [data-auth].
  // Inline email/login/register switching inside the modal is handled by modal.js.
}
