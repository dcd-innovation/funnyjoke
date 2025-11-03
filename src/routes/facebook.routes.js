// src/routes/facebook.routes.js
import { Router } from 'express';
import crypto, { randomBytes } from 'crypto';
import { config } from '../config/env.js';

function base64UrlDecodeToBuf(str = '') {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + '='.repeat(pad), 'base64');
}

function verifySignedRequest(signedRequest, appSecret) {
  const [encodedSig, encodedPayload] = String(signedRequest || '').split('.', 2);
  if (!encodedSig || !encodedPayload) throw new Error('Malformed signed_request');

  const sigBuf = base64UrlDecodeToBuf(encodedSig);
  const expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();

  if (sigBuf.length !== expected.length || !crypto.timingSafeEqual(sigBuf, expected)) {
    throw new Error('Bad signature');
  }
  const payloadBuf = base64UrlDecodeToBuf(encodedPayload);
  return JSON.parse(payloadBuf.toString('utf8')); // contains user_id, issued_at, etc.
}

export function createFacebookRouter({ userRepo }) {
  const router = Router();

  // POST x-www-form-urlencoded: { signed_request: ... }
  router.post('/data-deletion', async (req, res) => {
    try {
      // Enforce expected content type (Meta docs send form-url-encoded)
      if (!req.is('application/x-www-form-urlencoded')) {
        return res.status(400).type('application/json').json({ error: 'Bad content type' });
      }

      const { signed_request } = req.body || {};
      const appSecret = config?.facebook?.clientSecret || config?.facebook?.appSecret;
      if (!signed_request) throw new Error('signed_request missing');
      if (!appSecret)       throw new Error('FACEBOOK_APP_SECRET missing');

      const data = verifySignedRequest(signed_request, appSecret);
      const userId = data?.user_id;
      if (!userId) throw new Error('user_id missing in signed_request');

      // Best-effort delete in your repo
      if (typeof userRepo.deleteByProviderId === 'function') {
        await userRepo.deleteByProviderId('facebook', userId);
      } else if (typeof userRepo.deleteByFacebookId === 'function') {
        await userRepo.deleteByFacebookId(userId);
      } else {
        console.warn('[fb-deletion] No delete method implemented; userId=', userId);
      }

      // Short opaque confirmation code (no PII)
      const confirmation_code = randomBytes(6).toString('hex'); // e.g., "a1b2c3d4e5f6"
      const statusUrl = `${res.locals.baseUrl}/facebook/deletion-status/${encodeURIComponent(confirmation_code)}`;

      console.info('[fb-deletion]', { ok: true, uid: userId, code: confirmation_code });

      // Meta requires 200 with { url, confirmation_code }
      return res.status(200).type('application/json').json({ url: statusUrl, confirmation_code });
    } catch (err) {
      console.error('[fb-deletion] error:', err?.message || err);
      const confirmation_code = randomBytes(6).toString('hex');
      const statusUrl = `${res.locals.baseUrl}/facebook/deletion-status/${encodeURIComponent(confirmation_code)}?error=1`;
      return res.status(200).type('application/json').json({ url: statusUrl, confirmation_code });
    }
  });

  // If someone GETs the POST endpoint, send them to the info page
  router.get('/data-deletion', (req, res) => res.redirect(302, '/data-deletion'));

  // Show a friendly confirmation page at /facebook/deletion-status/:code
  router.get('/deletion-status/:code', (req, res) => {
    const isError = req.query.error === '1';
    res.locals.pageTitle = 'Deletion Status';
    res.status(200).render('pages/deletion-status', {
      code: req.params.code,
      error: isError
    });
  });

  return router;
}
