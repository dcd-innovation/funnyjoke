// src/routes/auth.routes.js
import { Router } from 'express';
import { ensureAuthed } from '../config/passport.js';
import { createAuthController } from '../controllers/auth.controller.js';

/**
 * Factory: build the auth router with injected deps.
 * In app.js:  app.use('/', buildAuthRoutes({ passport, userRepo }));
 */
export function buildAuthRoutes({ passport, userRepo }) {
  if (!passport) throw new Error('[auth.routes] passport required');
  if (!userRepo) throw new Error('[auth.routes] userRepo required');

  const {
    postLogin,
    postRegister,
    logout,
    showProfile,
  } = createAuthController({ passport, userRepo });

  const router = Router();

  /* ------------------------- Helpers ------------------------- */

  // Capture ?returnTo before kicking off OAuth so we can redirect back after callback
  const captureReturnTo = (req, _res, next) => {
    if (req.query?.returnTo && req.session) {
      req.session.returnTo = String(req.query.returnTo);
    }
    next();
  };

  // DRY: redirect /login or /register to homepage with ?auth=...
  const redirectWithAuth = (auth) => (req, res) => {
    const params = new URLSearchParams({ auth });
    if (req.query.returnTo) params.set('returnTo', String(req.query.returnTo));
    res.redirect(`/?${params.toString()}`);
  };

  /* ------------------- Modal-first GET routes ------------------- */
  router.get('/login',    redirectWithAuth('login'));
  router.get('/register', redirectWithAuth('register'));

  /* ----------------------- Local auth (POST) --------------------- */
  router.post('/login',    postLogin);
  router.post('/register', postRegister);

  /* -------------------------- Session --------------------------- */
  router.get('/profile', ensureAuthed, showProfile);

  // POST-only logout (recommended)
  router.post('/logout', logout);

  /* --------------------------- OAuth ---------------------------- */
  // Google
  router.get('/auth/google',
    captureReturnTo,
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );
  router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?auth=login' }),
    (req, res) => {
      const dest = req.session?.returnTo || '/profile';
      if (req.session) req.session.returnTo = null;
      res.redirect(dest);
    }
  );

  // Facebook
  router.get('/auth/facebook',
    captureReturnTo,
    passport.authenticate('facebook', { scope: ['email'] })
  );
  router.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/?auth=login' }),
    (req, res) => {
      const dest = req.session?.returnTo || '/profile';
      if (req.session) req.session.returnTo = null;
      res.redirect(dest);
    }
  );

  // Apple
  router.get('/auth/apple',
    captureReturnTo,
    passport.authenticate('apple')
  );
  router.post('/auth/apple/callback',
    passport.authenticate('apple', { failureRedirect: '/?auth=login' }),
    (req, res) => {
      const dest = req.session?.returnTo || '/profile';
      if (req.session) req.session.returnTo = null;
      res.redirect(dest);
    }
  );

  return router;
}

export default buildAuthRoutes;
