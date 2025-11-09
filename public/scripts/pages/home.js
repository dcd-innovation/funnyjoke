// public/scripts/pages/home.js
// ES module: Home page behaviors (shuffle feed + tab a11y)
// Works with views/pages/home.ejs (root has data-page="home")

export function init() {
  const root = document.querySelector('[data-page="home"]');
  if (!root) return;

  const feed = root.querySelector('[data-feed]');
  if (!feed) return;

  // Remove skeleton if posts rendered on first paint
  removeSkeleton(feed);

  // ---------------------------
  // Tabs: a11y + client response
  // ---------------------------
  const tablist = root.querySelector('.tabs[role="tablist"]');
  if (tablist) {
    tablist.addEventListener('click', (e) => {
      const btn = e.target.closest('[role="tab"].tab');
      if (!btn) return;

      // Update selection state
      const tabs = tablist.querySelectorAll('[role="tab"].tab');
      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
        t.setAttribute('tabindex', '-1');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      btn.setAttribute('tabindex', '0');
      btn.focus();

      // Light feedback + shuffle (client-side)
      announce(`Tab selected: ${btn.textContent.trim()}`);
      clientShuffle();           // reuse existing shuffle as a cheap “refresh”
      removeSkeleton(feed);      // ensure skeleton is gone once we have cards
    });

    // Keyboard support: Left/Right arrows move focus among tabs
    tablist.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const tabs = [...tablist.querySelectorAll('[role="tab"].tab')];
      if (!tabs.length) return;

      const current = document.activeElement.closest('[role="tab"].tab');
      const i = Math.max(0, tabs.indexOf(current));
      let nextIdx = i;

      if (e.key === 'ArrowRight') nextIdx = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft')  nextIdx = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home')       nextIdx = 0;
      if (e.key === 'End')        nextIdx = tabs.length - 1;

      tabs[nextIdx]?.focus();
      e.preventDefault();
    });
  }

  // ---------------------------
  // Shuffle trigger (link + event)
  // ---------------------------
  const shuffleLink =
    document.querySelector('[data-shuffle]') ||
    document.querySelector('a[href="/shuffle"]');

  if (shuffleLink) {
    shuffleLink.addEventListener('click', async (e) => {
      // Let modified clicks behave normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();

      const ok = await fetchAndSwap();
      if (!ok) clientShuffle();
    });
  }

  // Programmatic shuffle
  document.addEventListener('fj:shuffle', async () => {
    const ok = await fetchAndSwap();
    if (!ok) clientShuffle();
  });

  // ---------------------------
  // Networking helpers
  // ---------------------------
  async function fetchAndSwap() {
    try {
      // GET is fine here (no CSRF needed); include Accept for partial HTML
      const res = await fetch('/shuffle?partial=posts', { headers: { Accept: 'text/html' } });
      if (!res.ok) return false;
      const html = await res.text();
      feed.innerHTML = html;
      removeSkeleton(feed);
      spotlightRandom();
      announce('Feed shuffled (server).');
      return true;
    } catch {
      return false;
    }
  }

  // Example POST helper (use when you add mutating routes)
  async function postJSON(url, payload) {
    const tokenEl = document.querySelector('meta[name="csrf-token"]');
    const csrf = tokenEl?.content || '';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'CSRF-Token': csrf,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return res;
  }

  // ---------------------------
  // Client-side shuffle (fallback)
  // ---------------------------
  function clientShuffle() {
    const cards = Array.from(feed.querySelectorAll('.post-card'));
    if (!cards.length) return;
    const pool = cards.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.forEach((el) => feed.appendChild(el));
    removeSkeleton(feed);
    spotlightRandom();
    announce('Feed shuffled (client).');
  }

  function spotlightRandom() {
    const cards = feed.querySelectorAll('.post-card');
    if (!cards.length) return;
    const el = cards[Math.floor(Math.random() * cards.length)];
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const prevOutline = el.style.outline;
    const prevOffset = el.style.outlineOffset;
    el.style.outline = '2px solid #2f7fff';
    el.style.outlineOffset = '3px';
    setTimeout(() => {
      el.style.outline = prevOutline || '';
      el.style.outlineOffset = prevOffset || '';
    }, 900);
  }

  // ---------------------------
  // a11y live region
  // ---------------------------
  let live = document.getElementById('live-region');
  if (!live) {
    live = document.createElement('div');
    live.id = 'live-region';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    Object.assign(live.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      margin: '-1px',
      border: '0',
      padding: '0',
      clip: 'rect(0 0 0 0)',
      overflow: 'hidden'
    });
    document.body.appendChild(live);
  }
  function announce(msg) { live.textContent = msg; }

  // ---------------------------
  // Local helpers
  // ---------------------------
  function removeSkeleton(container) {
    const hasPosts = container.querySelector('.post-card');
    const skel = container.querySelector('.skeleton-list');
    if (hasPosts && skel) skel.remove();
  }
}
