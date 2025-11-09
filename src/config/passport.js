// src/config/passport.js
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { config, getCallbackUrl } from './env.js';

export async function configurePassport({ userRepo }) {
  if (!userRepo || !userRepo.findById) {
    throw new Error('[passport] userRepo with findById is required');
  }
  if (!userRepo.findByEmail && !userRepo.findByUsername) {
    throw new Error('[passport] userRepo needs findByEmail or findByUsername');
  }

  /* ------------------------------------------------------------------------ */
  /* serialize/deserialize                                                    */
  /* ------------------------------------------------------------------------ */
  // Store a stable id in the session (Mongo _id preferred; fallback to id)
  passport.serializeUser((user, done) => {
    const sid = user?._id || user?.id;
    done(null, sid);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userRepo.findById(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  // Prefer email lookup; fallback to username for legacy users
  const findByEmailOrUsername = async (emailLike) => {
    if (typeof userRepo.findByEmail === 'function') {
      return userRepo.findByEmail(emailLike);
    }
    return userRepo.findByUsername(emailLike);
  };

  /* ------------------------------------------------------------------------ */
  /* Local (email + password)                                                 */
  /* ------------------------------------------------------------------------ */
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const cleanEmail = String(email || '').trim().toLowerCase();
          const user = await findByEmailOrUsername(cleanEmail);
          if (!user) return done(null, false, { message: 'Invalid email or password' });

          const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
          if (!ok) return done(null, false, { message: 'Invalid email or password' });

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  /* ------------------------------------------------------------------------ */
  /* Google (optional)                                                        */
  /* ------------------------------------------------------------------------ */
  if (config.google?.clientID && config.google?.clientSecret) {
    const { Strategy: GoogleStrategy } = await import('passport-google-oauth20');

    const googleCallback = getCallbackUrl('/auth/google/callback');
    console.info(`[passport] Google enabled. callbackURL=${googleCallback}`);

    passport.use(
      new GoogleStrategy(
        {
          clientID:     config.google.clientID,
          clientSecret: config.google.clientSecret,
          callbackURL:  googleCallback,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            if (!userRepo.findOrCreateFromGoogle) {
              return done(new Error('[passport] userRepo.findOrCreateFromGoogle not implemented'));
            }
            const user = await userRepo.findOrCreateFromGoogle(profile);
            done(null, user);
          } catch (e) {
            done(e);
          }
        }
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Facebook (optional)                                                      */
  /* ------------------------------------------------------------------------ */
  if (config.facebook?.clientID && config.facebook?.clientSecret) {
    const { Strategy: FacebookStrategy } = await import('passport-facebook');

    const fbCallback = getCallbackUrl('/auth/facebook/callback');
    console.info(`[passport] Facebook enabled. callbackURL=${fbCallback}`);

    passport.use(
      new FacebookStrategy(
        {
          clientID:     config.facebook.clientID,
          clientSecret: config.facebook.clientSecret,
          callbackURL:  fbCallback,
          profileFields: ['id', 'displayName', 'emails', 'photos'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            if (!userRepo.findOrCreateFromFacebook) {
              return done(new Error('[passport] userRepo.findOrCreateFromFacebook not implemented'));
            }
            const user = await userRepo.findOrCreateFromFacebook(profile);
            done(null, user);
          } catch (e) {
            done(e);
          }
        }
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Apple (optional)                                                         */
  /* ------------------------------------------------------------------------ */
  if (
    config.apple?.clientID &&
    config.apple?.teamID &&
    config.apple?.keyID &&
    config.apple?.privateKey
  ) {
    const { Strategy: AppleStrategy } = await import('passport-apple');

    const appleCallback = getCallbackUrl('/auth/apple/callback');
    console.info(`[passport] Apple enabled. callbackURL=${appleCallback}`);

    passport.use(
      new AppleStrategy(
        {
          clientID:    config.apple.clientID,
          teamID:      config.apple.teamID,
          keyID:       config.apple.keyID,
          privateKey:  config.apple.privateKey,
          callbackURL: appleCallback,
        },
        async (_accessToken, _refreshToken, _idToken, profile, done) => {
          try {
            if (!userRepo.findOrCreateFromApple) {
              return done(new Error('[passport] userRepo.findOrCreateFromApple not implemented'));
            }
            const user = await userRepo.findOrCreateFromApple(profile);
            done(null, user);
          } catch (e) {
            done(e);
          }
        }
      )
    );
  }

  return passport; // singleton instance configured
}

/**
 * Gate for protected routes. Preserves returnTo so the user goes back to the
 * original page after authenticating.
 */
export function ensureAuthed(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();

  const dest = req.originalUrl || '/profile';
  if (req.session) req.session.returnTo = dest;

  if (req.method === 'GET') {
    const encoded = encodeURIComponent(dest);
    return res.redirect(`/?auth=login&returnTo=${encoded}`);
  }
  return res.redirect('/?auth=login');
}
