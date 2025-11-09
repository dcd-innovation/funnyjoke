// src/app.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import expressLayouts from 'express-ejs-layouts';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';
import MongoStore from 'connect-mongo';
import { config } from './config/env.js';
import { requestLogger } from './utils/loggers.js';

// Passport (singleton)
import passport from 'passport';
import { configurePassport } from './config/passport.js';
import { createUserRepoMongo } from './repositories/userRepo.mongo.js';

// Routes
import buildAuthRoutes from './routes/auth.routes.js';
import jokesApiRoutes from './routes/api/jokes.routes.js';
import pagesRoutes from './routes/pages.routes.js';
import { createFacebookRouter } from './routes/facebook.routes.js';

// Errors
import { errorHandler, notFound as notFoundHandler } from './middleware/errorHandler.js';


/* ---- Redis session store (connect-redis v7/v8 + redis v4) ---- */
import { createClient as createRedisClient } from 'redis';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

/* ------------------------------- MongoDB (single connect) ------------------------------- */
const mongoUri = config.MONGO_URI || process.env.MONGO_URI || '';
let mongoClient = null;

if (!mongoUri) {
  console.warn('[mongo] MONGO_URI not set — app will run without a DB (dev fallback).');
} else {
  try {
    // modern driver; Server API v1 for Atlas
    mongoClient = new MongoClient(mongoUri, { serverApi: { version: '1' } });
    await mongoClient.connect();
    app.locals.db = mongoClient.db(); // default DB from URI
    console.log('[mongo] Connected');
  } catch (err) {
    console.error('[mongo] Connection error:', err?.message || err);
  }
}

// Guard: ensure DB exists before initializing repos
if (!app.locals.db) {
  console.error('[mongo] No DB available — aborting startup to prevent runtime errors.');
  process.exit(1);
}

// Create unique indexes (idempotent)
try {
  const users = app.locals.db.collection('users');
  await users.createIndex({ email: 1 },    { unique: true, sparse: true, name: 'uniq_email' });
  await users.createIndex({ username: 1 }, { unique: true, sparse: true, name: 'uniq_username' });
  console.log('[mongo] user indexes OK');
} catch (e) {
  console.warn('[mongo] index setup skipped:', e?.codeName || e?.message || e);
}

/* ----------------------------- Core middleware ---------------------------- */
if (config.isProd) app.set('trust proxy', 1);
app.disable('x-powered-by');

// Per-request CSP nonce
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(compression());

// Secure headers + CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "script-src": ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "style-src-elem": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
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
        "frame-ancestors": ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger());

// Static assets
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

/* ---------------- Sessions: Redis primary, Mongo fallback ---------------- */
let store;
let redisClient; // for graceful shutdown

async function buildSessionStore() {
  // Try Redis first
  if (process.env.REDIS_URL) {
    try {
      const useTls = process.env.REDIS_URL.startsWith('rediss://');
      const { createClient } = await import('redis');
      redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: useTls ? { tls: true, rejectUnauthorized: false } : undefined
      });
      redisClient.on('error', (e) => console.error('[redis] error:', e?.message || e));
      await redisClient.connect();

      const mod = await import('connect-redis');
      const RedisStore = mod.RedisStore || mod.default || mod;
      console.log('[session] Using RedisStore');
      return new RedisStore({ client: redisClient, prefix: 'sess:' });
    } catch (e) {
      console.warn('[session] Redis unavailable, falling back to MongoStore:', e?.message || e);
    }
  }

  // Fallback to Mongo (needs Mongo connected)
  if (app.locals.db) {
    console.log('[session] Using MongoStore');
    return MongoStore.create({
      client: mongoClient,
      dbName: app.locals.db.databaseName,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 7, // 7 days
      autoRemove: 'interval',
      autoRemoveInterval: 10 // minutes
    });
  }

  // Last resort: Memory (dev only)
  console.warn('[session] Using MemoryStore (dev only)');
  return undefined; // express-session defaults to MemoryStore
}

store = await buildSessionStore();

app.use(session({
  store,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'fj.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// Configure passport (singleton) with Mongo repo
const userRepo = createUserRepoMongo(app.locals.db);
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

  // Public flags for templates
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

  res.locals.title = null;
  res.locals.pageTitle = null;

  next();
});

/* -------------------------------- Hardening -------------------------------- */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120 });
const deletionLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
app.use('/auth/', authLimiter);

/* --------------------------------- Health --------------------------------- */
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

/* --------------------------------- Routes -------------------------------- */
app.use('/api/jokes', jokesApiRoutes);
app.use('/', buildAuthRoutes({ passport, userRepo }));
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
  if (mongoClient) {
    mongoClient.close().catch(() => {});
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/* -------------------------------- Exports -------------------------------- */
export default app;
