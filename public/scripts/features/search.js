// public/scripts/features/search.js
export function initSearch() {
  const searchBtn = document.querySelector('[data-search-toggle]');
  const searchBox = document.querySelector('[data-search-box]');
  if (!searchBtn || !searchBox || searchBtn.dataset.initialized) return;

  searchBtn.dataset.initialized = 'true';

  // a11y wiring
  if (!searchBox.id) searchBox.id = 'search-popover';
  if (!searchBtn.getAttribute('aria-controls')) {
    searchBtn.setAttribute('aria-controls', searchBox.id);
  }
  searchBtn.setAttribute('aria-expanded', 'false');

  const form    = searchBox.closest('form') || searchBox; // searchBox is your form already
  const input   = searchBox.querySelector('input[type="text"], input[type="search"]');
  const clearBtn= searchBox.querySelector('.clear-btn');

  const open = () => {
    searchBox.classList.add('is-open');
    searchBtn.setAttribute('aria-expanded', 'true');
    document.dispatchEvent(new CustomEvent('fj:popover-open', { detail: 'search' }));
    requestAnimationFrame(() => input && input.focus());
  };

  const close = () => {
    searchBox.classList.remove('is-open');
    searchBtn.setAttribute('aria-expanded', 'false');
  };

  const toggle = (e) => {
    e.stopPropagation(); // don’t bubble to document’s click-to-close
    (searchBox.classList.contains('is-open') ? close : open)();
  };

  // Clicks
  searchBtn.addEventListener('click', toggle);
  searchBox.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target) && !searchBtn.contains(e.target)) close();
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // If another popover opens, close this one
  document.addEventListener('fj:popover-open', (e) => {
    if (e.detail !== 'search') close();
  });

  // Close after submit (let the browser navigate)
  if (form && form.addEventListener) {
    form.addEventListener('submit', () => {
      close();
    });
  }

  // Optional clear button (does not block submission)
  if (clearBtn && input) {
    const syncClearVisibility = () => {
      clearBtn.hidden = input.value.length === 0;
    };
    syncClearVisibility();
    input.addEventListener('input', syncClearVisibility);
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();           // only prevent the clear button from submitting
      input.value = '';
      syncClearVisibility();
      input.focus();
    });
  }

  // Normalize on resize
  window.addEventListener('resize', () => close());
}
