// middleware/asyncHandler.js
// Tiny helper to avoid repetitive try/catch in async route handlers.
// Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
