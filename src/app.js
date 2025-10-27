// src/app.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import expressLayouts from 'express-ejs-layouts';

import { config } from './config/env.js';
import { requestLogger } from './utils/loggers.js';

// Passport
import passport from 'passport';
import { configurePassport } from './config/passport.js';
import { createUserRepo } from './repositories/userRepo.memory.js';

// Routes
import buildAuthRoutes from './routes/auth.routes.js';
import jokesApiRoutes from './routes/api/jokes.routes.js';
import pagesRoutes from './routes/pages.routes.js';

// Errors
import { errorHandler, notFound as notFoundHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

/* ----------------------------- Core middleware ---------------------------- */
if (config.isProd) app.set('trust proxy', 1);

app.use(express.json());                         // JSON bodies
app.use(express.urlencoded({ extended: true })); // HTML form POSTs
app.use(requestLogger());                        // optional

// Static assets
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ----------------------------- Sessions + Passport ------------------------ */
app.use(session({
  secret: config.sessionSecret || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  },
}));

const userRepo = createUserRepo();
await configurePassport({ passport, userRepo });
app.use(passport.initialize());
app.use(passport.session());

/* ------------------------------- View engine ------------------------------ */
app.use(expressLayouts);
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/layout');
app.set('view cache', false);

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

  // ---- Public env for templates (DO NOT expose secrets) ----
  res.locals.env = {
    GOOGLE_CLIENT_ID:   config.google?.clientID || '',
    FACEBOOK_CLIENT_ID: config.facebook?.clientID || '',
    APPLE_CLIENT_ID:    config.apple?.clientID || '',
    hasGoogle:          Boolean(config.google?.clientID && config.google?.clientSecret),
    hasFacebook:        Boolean(config.facebook?.clientID && config.facebook?.clientSecret),
    hasApple:           Boolean(config.apple?.clientID && config.apple?.teamID && config.apple?.keyID && config.apple?.privateKey),
  };
  // ----------------------------------------------------------

  next();
});

/* --------------------------------- Routes -------------------------------- */
app.use('/api/jokes', jokesApiRoutes);
app.use('/', buildAuthRoutes({ passport, userRepo })); // /login /register /logout /profile
app.use('/', pagesRoutes);                              // SSR pages

/* ---------------------------- 404 & Error handlers ------------------------ */
app.use(notFoundHandler);
app.use(errorHandler);

/* -------------------------------- Exports -------------------------------- */
export default app;
