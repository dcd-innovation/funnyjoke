// /public/scripts/features/refreshConfirm.js
let bound = false;
let off = null;

/**
 * Confirm before refreshing when clicking:
 *  - the brand logo link (".logo-section a"), or
 *  - any element with [data-action="fj"]
 */
export function initRefreshConfirm() {
  if (bound) return;
  bound = true;

  const handler = async (e) => {
    const a = e.target.closest('.logo-section a, [data-action="fj"]');
    if (!a) return;

    // allow modified / non-left clicks to behave normally
    const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
    if (modified) return;

    e.preventDefault();

    // Prefer custom modal if provided (from modal.js), else native confirm
    let ok = false;
    if (typeof window.openConfirm === 'function') {
      ok = await window.openConfirm({
        title: '9gag.com says',
        message: 'Refresh the page?',
        okText: 'OK',
        cancelText: 'Cancel'
      });
    } else {
      ok = window.confirm('Refresh the page?');
    }
    if (!ok) return;

    // Same-path: hard refresh; otherwise navigate to href
    const href = a.getAttribute('href') || a.href;
    try {
      const url = new URL(href, location.origin);
      if (url.pathname === location.pathname && url.search === location.search && url.hash === location.hash) {
        location.reload();                // refresh
      } else {
        location.href = url.toString();   // navigate
      }
    } catch {
      // Fallback if href is malformed/relative without base
      location.reload();
    }
  };

  document.addEventListener('click', handler, true); // capture
  off = () => document.removeEventListener('click', handler, true);
}

export function destroyRefreshConfirm() {
  if (off) off();
  bound = false;
  off = null;
}
