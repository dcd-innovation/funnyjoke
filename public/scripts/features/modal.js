// /public/scripts/features/modal.js
export function initModal() {
  const modal = document.querySelector('[data-post-modal]');
  if (!modal || modal.dataset.initialized) return;
  modal.dataset.initialized = '1';

  const panel    = modal.querySelector('.modal__panel');
  const actions  = modal.querySelector('.modal__actions');
  const closeEls = modal.querySelectorAll('[data-close-post]');
  const header   = document.querySelector('header.header');
  const main     = document.querySelector('main');
  if (!panel || !actions) return;

  const originalActionsHTML = actions.innerHTML;
  let lastActive = null;

  // --- Portal support ---
  let placeholder = null;
  const toBody = () => {
    if (modal.parentElement === document.body) return;
    placeholder = document.createComment('modal-placeholder');
    modal.parentElement.insertBefore(placeholder, modal);
    document.body.appendChild(modal);
  };
  const restorePlace = () => {
    if (!placeholder) return;
    placeholder.parentElement.insertBefore(modal, placeholder);
    placeholder.remove();
    placeholder = null;
  };

  // a11y helpers
  const isVisible = (el) => {
    const st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  };
  const getFocusable = () =>
    Array.from(panel.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )).filter(isVisible);

  const setInert = (on) => {
    const toggle = (el, v) => v ? el?.setAttribute('inert', '') : el?.removeAttribute('inert');
    toggle(main, on);
    toggle(header, on);
    document.documentElement.style.overflow = on ? 'hidden' : '';
  };

  const focusFirst = () => {
    const f = getFocusable();
    (f[0] || panel).focus();
  };

  // Footer helper
  const setFooter = (mode /* 'login' | 'register' | 'social' */) => {
    const foot = modal.querySelector('.modal__foot');
    if (!foot) return;
    if (mode === 'login') {
      foot.innerHTML = `New here? <a href="/register" data-auth="register">Create an account</a>`;
    } else if (mode === 'register') {
      foot.innerHTML = `Already a member? <a href="/login" data-auth="login">Log in</a>`;
    } else {
      foot.innerHTML = `Already a member? <a href="/login" data-auth="login">Log in</a>`;
    }
  };

  const restoreDefaultActions = () => {
    actions.innerHTML = originalActionsHTML; // social choices
    bindInnerAuthButtons();
    setFooter('social');
  };

  const open = () => {
    lastActive = document.activeElement;
    restoreDefaultActions();
    toBody();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setInert(true);
    focusFirst();
  };

  const close = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    setInert(false);
    restorePlace();
    restoreDefaultActions();
    if (lastActive?.focus) lastActive.focus();
  };

  /* ------------------ Inline email form (AJAX submit) ------------------ */
  const showEmailForm = (mode = 'login') => {
    const isLogin = mode === 'login';
    setFooter(isLogin ? 'login' : 'register');

    const formId = isLogin ? 'auth-login-form' : 'auth-register-form';
    const firstFieldId = isLogin ? 'auth-email' : 'auth-fullname';

    actions.innerHTML = `
      <form id="${formId}" class="auth-email-form" method="POST"
            action="/${isLogin ? 'login' : 'register'}" autocomplete="on" novalidate>
        ${!isLogin ? `
          <div class="field">
            <label for="auth-fullname">Full name</label>
            <input id="auth-fullname" name="name" type="text" required
                   autocomplete="name" inputmode="text" />
          </div>
        ` : ''}

        <div class="field">
          <label for="auth-email">Email address</label>
          <input id="auth-email" name="email" type="email" required
                 autocomplete="email" inputmode="email" />
        </div>

        <div class="field">
          <label for="auth-password">Password</label>
          <input id="auth-password" name="password" type="password" required
                 ${isLogin ? 'autocomplete="current-password"' : 'autocomplete="new-password"'}
                 minlength="8" />
        </div>

        <div class="field" data-captcha-slot hidden></div>

        <div class="auth-actions-row">
          <button class="btn primary" type="submit">${isLogin ? 'Log in' : 'Sign up'}</button>
          <button class="btn ghost" type="button" data-auth="back">Use social instead</button>
        </div>
      </form>
      <div class="auth-inline-error" role="alert" style="margin:8px 0 0;color:#c02626;font-size:14px;display:none;"></div>
    `;

    bindInnerAuthButtons();
    actions.querySelector(`#${firstFieldId}`)?.focus();

    /* Add returnTo to social links (Google/Facebook/Apple) */
    (() => {
      const ret = sessionStorage.getItem('auth:returnTo');
      if (!ret) return;
      actions.querySelectorAll('a.btn.social[href^="/auth/"]').forEach(a => {
        const url = new URL(a.getAttribute('href'), location.origin);
        if (!url.searchParams.has('returnTo')) {
          url.searchParams.set('returnTo', ret);
          a.setAttribute('href', url.pathname + url.search);
        }
      });
    })();

    // AJAX submit with re-entrancy guard (URL-encoded body)
    const form = actions.querySelector('form.auth-email-form');
    const err  = actions.querySelector('.auth-inline-error');
    let inFlight = false;

    if (form) {
      form.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        if (inFlight) return;
        inFlight = true;

        // Attach returnTo while inputs are enabled
        const ret = sessionStorage.getItem('auth:returnTo');
        if (ret && !form.querySelector('input[name="returnTo"]')) {
          const hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'returnTo';
          hidden.value = ret;
          form.appendChild(hidden);
        }

        // ✅ Build body BEFORE disabling inputs (disabled fields aren't serialized)
        const body = new URLSearchParams(new FormData(form));

        // Lock UI
        form.setAttribute('aria-busy', 'true');
        form.querySelectorAll('button, input, a').forEach(el => {
          if (el.tagName === 'A') el.setAttribute('aria-disabled', 'true');
          else el.disabled = true;
        });

        try {
          const res = await fetch(form.action, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }, // let browser set Content-Type
            body
          });

          // Redirected (3xx) success path
          if (res.redirected) {
            close();
            sessionStorage.removeItem('auth:returnTo');   // clear after success
            return location.assign(res.url);
          }

          const ctype = res.headers.get('content-type') || '';
          if (ctype.includes('application/json')) {
            const data = await res.json();

            // JSON success path
            if (data?.ok) {
              close();
              sessionStorage.removeItem('auth:returnTo'); // clear after success
              return location.assign(data.redirect || '/profile');
            }

            // Error payload
            err.textContent = data?.error || 'Something went wrong. Please try again.';
            err.style.display = 'block';
          } else {
            // Non-JSON fallback
            return location.reload();
          }
        } catch {
          err.textContent = 'Network error. Please try again.';
          err.style.display = 'block';
        } finally {
          inFlight = false;
          form.removeAttribute('aria-busy');
          form.querySelectorAll('button, input, a').forEach(el => {
            if (el.tagName === 'A') el.removeAttribute('aria-disabled');
            else el.disabled = false;
          });
          (form.querySelector(':invalid') || form.querySelector('#auth-email'))?.focus();
        }
      });
    }
  };

  // expose openers
  window.openAuthModal = (mode) => {
    open();
    if (mode === 'login' || mode === 'register') showEmailForm(mode);
  };

  // Bind clicks inside the modal (since we swap its HTML)
  const bindInnerAuthButtons = () => {
    actions.querySelectorAll('[data-auth="email"], [data-auth="login"], [data-auth="register"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = el.dataset.auth === 'register' ? 'register' : 'login';
        showEmailForm(mode);
      });
    });
    actions.querySelector('[data-auth="back"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      restoreDefaultActions();
    });
  };

  /* --------------------------- Event wiring --------------------------- */
  panel.addEventListener('click', (e) => e.stopPropagation());
  closeEls.forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); close(); }));
  modal.addEventListener('click', () => close());

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = getFocusable(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1], active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Delegated opener (any element with [data-open-post]) — capture phase
  const openerHandler = (e) => {
    const opener = e.target.closest('[data-open-post]');
    if (!opener) return;

    if (opener.tagName === 'A') {
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
      const newTab   = opener.target === '_blank';
      if (!modified && !newTab) e.preventDefault();
    }

    setTimeout(() => {
      open();
      const mode = opener.dataset.auth;
      if (mode === 'login' || mode === 'register') showEmailForm(mode);
    }, 0);
  };
  document.addEventListener('click', openerHandler, true);
}
