// public/scripts/pages/home.js
// ES module: Home page behaviors (shuffle feed)
// Works with views/pages/home.ejs (root has data-page="home")

export function init() {
  const root = document.querySelector('[data-page="home"]');
  if (!root) return;

  const feed = root.querySelector('[data-feed]');
  if (!feed) return;

  // Prefer a data attribute; fall back to href match
  const shuffleLink =
    document.querySelector('[data-shuffle]') ||
    document.querySelector('a[href="/shuffle"]');

  if (shuffleLink) {
    shuffleLink.addEventListener('click', async (e) => {
      // Let new-tab / modified clicks behave normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      e.preventDefault();

      const ok = await fetchAndSwap();
      if (!ok) clientShuffle();
    });
  }

  // Programmatic shuffle support
  document.addEventListener('fj:shuffle', async () => {
    const ok = await fetchAndSwap();
    if (!ok) clientShuffle();
  });

  async function fetchAndSwap() {
    try {
      const res = await fetch('/shuffle?partial=posts', { headers: { Accept: 'text/html' } });
      if (!res.ok) return false;
      const html = await res.text();
      feed.innerHTML = html;
      spotlightRandom();
      announce('Feed shuffled (server).');
      return true;
    } catch {
      return false;
    }
  }

  function clientShuffle() {
    const cards = Array.from(feed.querySelectorAll('.post-card'));
    if (!cards.length) return;
    const pool = cards.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.forEach((el) => feed.appendChild(el));
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

  // minimal aria-live region
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
}
