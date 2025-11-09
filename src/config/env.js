// Load .env and expose a normalized config object for the app.
import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd  = nodeEnv === 'production';

// Normalize an origin/base URL and strip trailing slash
function normalizeOrigin(v) {
  if (!v) return null;
  const s = String(v).trim();
  // Basic sanity: must look like http(s)://host[:port]
  if (!/^https?:\/\//i.test(s)) return s.endsWith('/') ? s.slice(0, -1) : s;
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

// Prefer BASE_URL; optional override for callbacks (e.g., ngrok)
const baseUrlRaw            = process.env.BASE_URL || null;
const oauthCallbackBaseRaw  = process.env.OAUTH_CALLBACK_BASE || baseUrlRaw || null;

const baseUrl           = normalizeOrigin(baseUrlRaw);
const oauthCallbackBase = normalizeOrigin(oauthCallbackBaseRaw);

// Coerce port safely
const port = Number(process.env.PORT) || 3000;

export const config = {
  nodeEnv,
  isProd,

  // Server
  host: process.env.HOST || '0.0.0.0',
  port,

  // App / URLs
  baseUrl,             // e.g. "http://localhost:3000" (no trailing slash)
  oauthCallbackBase,   // e.g. "http://localhost:3000" (no trailing slash)

  // Secrets
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  masterKey:     process.env.MASTER_KEY || null,

  // OAuth providers
  google: {
    clientID:     process.env.GOOGLE_CLIENT_ID     || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  facebook: {
    clientID:     process.env.FACEBOOK_CLIENT_ID     || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
  },
  apple: {
    clientID:   process.env.APPLE_CLIENT_ID   || '',
    teamID:     process.env.APPLE_TEAM_ID     || '',
    keyID:      process.env.APPLE_KEY_ID      || '',
    // Keep quotes + \n escapes in .env
    privateKey: process.env.APPLE_PRIVATE_KEY || '',
  },

  // MongoDB
  MONGO_URI: process.env.MONGO_URI || '', // MongoDB URI from environment variables
};

/**
 * Resolve the public origin for links (falls back to request host).
 * Example: const base = resolveBaseUrl(req);
 */
export function resolveBaseUrl(req) {
  const origin = config.baseUrl || `${req.protocol}://${req.get('host')}`;
  return normalizeOrigin(origin);
}

/**
 * Build an absolute Passport callback URL.
 * Use in passport.js:  callbackURL: getCallbackUrl('/auth/google/callback')
 */
export function getCallbackUrl(path = '/') {
  const origin =
    config.oauthCallbackBase ||
    config.baseUrl ||
    // last-resort for dev; avoid in prod
    `http://localhost:${config.port}`;
  const safeOrigin = normalizeOrigin(origin);
  const safePath   = path.startsWith('/') ? path : `/${path}`;
  return `${safeOrigin}${safePath}`;
}

export default config;
