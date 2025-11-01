// src/app.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import expressLayouts from 'express-ejs-layouts';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import { config } from './config/env.js';
import { requestLogger } from './utils/loggers.js';

// Passport (singleton)
import passport from 'passport';
import { configurePassport } from './config/passport.js';
import { createUserRepo } from './repositories/userRepo.memory.js';

// Routes
import buildAuthRoutes from './routes/auth.routes.js';
import jokesApiRoutes from './routes/api/jokes.routes.js';
import pagesRoutes from './routes/pages.routes.js';
import { createFacebookRouter } from './routes/facebook.routes.js';

// Errors
import { errorHandler, notFound as notFoundHandler } from './middleware/errorHandler.js';

// ---- Redis session store (connect-redis v7/v8 + redis v4) ----
let RedisStore;
{
  const mod = await import('connect-redis');
  RedisStore = mod.RedisStore || mod.default || mod;
}
import { createClient as createRedisClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

/* ----------------------------- Core middleware ---------------------------- */
if (config.isProd) app.set('trust proxy', 1); // needed for secure cookies on Render
app.disable('x-powered-by');                  // minor hardening

// Gzip/brotli where available
app.use(compression());

// Secure headers + CSP (allow FB/Google avatars)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],                 // keep strict; add nonces only if needed
        "style-src": ["'self'", "'unsafe-inline'"], // allow inline styles if present
        "img-src": [
          "'self'",
          "data:",
          "https://graph.facebook.com",
          "https://*.fbcdn.net",
          "https://*.facebook.com",
          "https://lh3.googleusercontent.com",
          "https://*.googleusercontent.com"
        ],
        "connect-src": ["'self'"],
        "font-src": ["'self'", "data:"],
        "frame-ancestors": ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger());

// Static assets (prod: cache; dev: no-store)
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    etag: true,
    lastModified: true,
    maxAge: config.isProd ? '7d' : 0,
    setHeaders(res) {
      if (!config.isProd) res.setHeader('Cache-Control', 'no-store');
    }
  })
);

/* ----------------------------- Sessions + Passport ------------------------ */
let store;
let redisClient; // so we can close gracefully

if (process.env.REDIS_URL) {
  const useTls = process.env.REDIS_URL.startsWith('rediss://');
  redisClient = createRedisClient({
    url: process.env.REDIS_URL,
    socket: useTls ? { tls: true, rejectUnauthorized: false } : undefined
  });

  redisClient.on('error', (err) => {
    console.error('[redis] error:', err?.message || err);
  });

  await redisClient.connect();

  store = new RedisStore({
    client: redisClient,
    prefix: 'sess:'
  });
} else {
  console.warn('[session] REDIS_URL not set — using MemoryStore (dev only)');
}

app.use(session({
  store,                        // undefined => MemoryStore (OK for local dev only)
  secret: config.sessionSecret, // REQUIRED
  resave: false,
  saveUninitialized: false,
  name: 'fj.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,            // true on Render/HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7   // 7 days
  }
}));

// Configure passport (singleton)
const userRepo = createUserRepo();
await configurePassport({ userRepo });
app.use(passport.initialize());
app.use(passport.session());

/* ------------------------------- View engine ------------------------------ */
app.use(expressLayouts);
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/layout');
app.set('view cache', config.isProd);

/* ----------------------------- Locals / defaults -------------------------- */
app.use((req, res, next) => {
  res.locals.user = req.user ?? null;

  const base = (config.baseUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.locals.baseUrl         = base;
  res.locals.canonical       = `${base}${req.path}`;
  res.locals.ogImage         = `${base}/images/og-default.jpg`;
  res.locals.twitterImage    = `${base}/images/twitter-1200x675.png`;
  res.locals.pageDescription = 'Best jokes & riddles to brighten your day!';
  res.locals.pageCss         = null;
  res.locals.pageScript      = null;

  // Layout toggles
  res.locals.showSidebar    = true;
  res.locals.sidebarPartial = '../partials/sidebar.ejs';
  res.locals.showFooter     = true;

  // Flash one-shot errors from session
  res.locals.error = req.session?.error ?? null;
  if (req.session) req.session.error = null;

  // Public, non-secret flags for templates
  res.locals.env = {
    GOOGLE_CLIENT_ID:   config.google?.clientID || '',
    FACEBOOK_CLIENT_ID: config.facebook?.clientID || '',
    APPLE_CLIENT_ID:    config.apple?.clientID || '',
    hasGoogle:   Boolean(config.google?.clientID && config.google?.clientSecret),
    hasFacebook: Boolean(config.facebook?.clientID && config.facebook?.clientSecret),
    hasApple:    Boolean(
      config.apple?.clientID &&
      config.apple?.teamID &&
      config.apple?.keyID &&
      config.apple?.privateKey
    )
  };

  next();
});

/* -------------------------------- Hardening -------------------------------- */
// Light rate limits on sensitive paths
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120 });
const deletionLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
app.use('/auth/', authLimiter);

/* --------------------------------- Health --------------------------------- */
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

/* --------------------------------- Routes -------------------------------- */
app.use('/api/jokes', jokesApiRoutes);
app.use('/', buildAuthRoutes({ passport, userRepo })); // /login /register /logout /profile
app.use('/', pagesRoutes);

// Facebook routes (data deletion + optional status page)
const fbRouter = createFacebookRouter({ userRepo });
app.use('/facebook', deletionLimiter, fbRouter);

/* ---------------------------- 404 & Error handlers ------------------------ */
app.use(notFoundHandler);
app.use(errorHandler);

/* ------------------------------ Graceful shutdown ------------------------- */
function shutdown() {
  if (redisClient) {
    redisClient.quit().catch(() => redisClient.disconnect());
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/* -------------------------------- Exports -------------------------------- */
export default app;
