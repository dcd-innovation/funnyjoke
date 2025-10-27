// src/middleware/errorHandler.js

// 404 -> forward as an error (kept as-is)
export const notFound = (req, res, next) => {
  const err = new Error(`Not Found - ${req.originalUrl}`);
  err.status = 404;
  next(err);
};

// Centralized error handler
export const errorHandler = (err, req, res, next) => {
  const status  = err.status || err.statusCode || 500;
  const env     = process.env.NODE_ENV || 'development';
  const message = err.message || 'Internal Server Error';

  // Prefer JSON for XHR/fetch or when HTML not accepted
  if (req.xhr || (req.accepts('json') && !req.accepts('html'))) {
    const payload = { message };
    if (env !== 'production') payload.stack = err.stack;
    return res.status(status).json(payload);
  }

  // HTML error pages
  const view = status === 404 ? 'errors/404' : 'errors/500';

  try {
    return res.status(status).render(view, {
      title: status === 404 ? 'Page Not Found' : 'Server Error',
      status,
      message,
      error: env !== 'production' ? err : null, // expose stack in dev only
      showSidebar: false
    });
  } catch (renderErr) {
    // Minimal fallback
    return res
      .status(status)
      .send(
        `<h1>${status}</h1><p>${message}</p>${
          env !== 'production'
            ? `<pre style="white-space:pre-wrap">${err.stack}</pre>`
            : ''
        }`
      );
  }
};
