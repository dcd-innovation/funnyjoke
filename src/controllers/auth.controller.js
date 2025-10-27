// src/controllers/auth.controller.js
// Controllers for login/register/logout (modal-first flow; email-based)

import bcrypt from 'bcrypt';

/**
 * @param {Object} deps
 * @param {import('passport').PassportStatic} deps.passport
 * @param {Object} deps.userRepo  – must implement:
 *   - findById(id)                         -> Promise<user|null>
 *   - findByEmail(email)                   -> Promise<user|null>   (preferred)
 *     (fallback supported: findByUsername(username))
 *   - create({ email, name, passwordHash }) -> Promise<user>
 */
export function createAuthController({ passport, userRepo }) {
  if (!passport) throw new Error('[auth.controller] passport is required');
  if (!userRepo) throw new Error('[auth.controller] userRepo is required');

  /* ------------------------------- Helpers -------------------------------- */
  const wantsJSON = (req) => {
    const accept = req.get('accept') || '';
    return accept.includes('application/json');
  };

  const sendError = (req, res, status, msg, redirectTo) => {
    if (wantsJSON(req)) return res.status(status).json({ ok: false, error: msg });
    if (req.session) req.session.error = msg;
    return res.redirect(redirectTo);
  };

  const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  // Allow only safe internal redirects: "/", "/profile", "/post/123", "/search?q=..."
  const sanitizeReturnTo = (val) => {
    if (!val) return null;
    try {
      // Disallow absolute URLs and protocol-relative; allow only plain paths
      if (/^https?:\/\//i.test(val) || /^\/\//.test(val)) return null;
      // Must start with "/" and not contain control chars
      if (!val.startsWith('/')) return null;
      if (/[\u0000-\u001F\u007F]/.test(val)) return null;
      return val;
    } catch {
      return null;
    }
  };

  const findUserByEmailOrUsername = async (emailLike) => {
    if (typeof userRepo.findByEmail === 'function') {
      return userRepo.findByEmail(emailLike);
    }
    if (typeof userRepo.findByUsername === 'function') {
      return userRepo.findByUsername(emailLike);
    }
    throw new Error('[auth.controller] userRepo needs findByEmail or findByUsername');
  };

  /* -------------------------------- Login --------------------------------- */
  // POST /login  (expects { email, password })
  const postLogin = (req, res, next) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return sendError(req, res, 400, 'Email and password are required', '/?auth=login');
    }
    if (!isValidEmail(email)) {
      return sendError(req, res, 400, 'Please enter a valid email address', '/?auth=login');
    }

    // passport-local is configured with { usernameField: 'email' } and normalizes itself
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        const message = info?.message || 'Invalid email or password';
        return sendError(req, res, 401, message, '/?auth=login');
      }
      req.logIn(user, (err2) => {
        if (err2) return next(err2);

        const rawReturnTo =
          req.body?.returnTo ||
          req.session?.returnTo ||
          null;
        const dest = sanitizeReturnTo(rawReturnTo) || '/profile';
        if (req.session) req.session.returnTo = null;

        if (wantsJSON(req)) {
          return res.json({
            ok: true,
            redirect: dest,
            user: { id: user.id, email: user.email, name: user.name }
          });
        }
        return res.redirect(dest);
      });
    })(req, res, next);
  };

  /* ------------------------------ Registration ---------------------------- */
  // POST /register  (expects { name, email, password })
  const postRegister = async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const rawReturnTo = String(req.body?.returnTo || '');
      const dest = sanitizeReturnTo(rawReturnTo) || req.session?.returnTo || '/profile';

      if (!cleanEmail || !password) {
        return sendError(req, res, 400, 'Email and password are required', '/?auth=register');
      }
      if (!isValidEmail(cleanEmail)) {
        return sendError(req, res, 400, 'Please enter a valid email address', '/?auth=register');
      }
      if (password.length < 8) {
        return sendError(req, res, 400, 'Password must be at least 8 characters', '/?auth=register');
      }
      if (name && name.length > 120) {
        return sendError(req, res, 400, 'Name is too long', '/?auth=register');
      }

      const exists = await findUserByEmailOrUsername(cleanEmail);
      if (exists) {
        return sendError(req, res, 409, 'An account with that email already exists', '/?auth=register');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      if (typeof userRepo.create !== 'function') {
        throw new Error('[auth.controller] userRepo.create is required');
      }

      const user = await userRepo.create({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        passwordHash,
      });

      // Auto-login after register
      req.logIn(user, (err) => {
        if (err) return next(err);

        if (req.session) req.session.returnTo = null;

        if (wantsJSON(req)) {
          return res.status(201).json({
            ok: true,
            redirect: dest,
            user: { id: user.id, email: user.email, name: user.name }
          });
        }
        return res.redirect(dest);
      });
    } catch (e) {
      return next(e);
    }
  };

  /* -------------------------------- Logout -------------------------------- */
  // GET /logout
  const logout = (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session?.destroy(() => {
        if (wantsJSON(req)) return res.json({ ok: true, redirect: '/' });
        return res.redirect('/');
      });
    });
  };

  /* -------------------------------- Profile ------------------------------- */
  // GET /profile (simple example)
  const showProfile = (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect('/?auth=login');
    }
    res.render('pages/profile', {
      title: 'Your Profile',
      layout: 'layouts/layout',
      user: req.user,
    });
  };

  return {
    postLogin,
    postRegister,
    logout,
    showProfile,
  };
}

export default createAuthController;
