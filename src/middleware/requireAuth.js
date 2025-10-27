// middleware/requireAuth.js

/**
 * Guard: requires a logged-in session user.
 * - HTML request: redirects to /login (and remembers returnTo)
 * - JSON/XHR: responds 401 JSON
 */
export function requireAuth(req, res, next) {
  if (req.session?.user) return next();

  // For API/AJAX callers, give JSON
  if (req.xhr || (req.accepts('json') && !req.accepts('html'))) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Remember where to go back after login
  if (req.method === 'GET') {
    req.session.returnTo = req.originalUrl || req.url;
  }
  return res.redirect('/login');
}

/**
 * Optional: only allow guests (e.g., login/register pages).
 * If already logged in, bounce to profile or home.
 */
export function requireGuest(req, res, next) {
  if (!req.session?.user) return next();
  return res.redirect('/profile'); // or '/'
}
