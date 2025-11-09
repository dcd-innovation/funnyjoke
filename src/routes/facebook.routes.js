// src/routes/facebook.routes.js
import { Router } from 'express';
import crypto, { randomBytes } from 'crypto';
import { config } from '../config/env.js';

function b64urlToBuf(str = '') {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + '='.repeat(pad), 'base64');
}

function verifySignedRequest(signedRequest, appSecret) {
  const [encodedSig, encodedPayload] = String(signedRequest || '').split('.', 2);
  if (!encodedSig || !encodedPayload) throw new Error('Malformed signed_request');

  const sigBuf = b64urlToBuf(encodedSig);
  const expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();

  if (sigBuf.length !== expected.length || !crypto.timingSafeEqual(sigBuf, expected)) {
    throw new Error('Bad signature');
  }

  const payload = JSON.parse(b64urlToBuf(encodedPayload).toString('utf8'));

  // Optional but recommended: ensure algorithm and basic freshness
  if (payload.algorithm && payload.algorithm.toUpperCase() !== 'HMAC-SHA256') {
    throw new Error('Unexpected algorithm');
  }
  if (payload.issued_at && Date.now() / 1000 - payload.issued_at > 3600 * 24) {
    // older than 24h — you can relax/adjust as needed
    throw new Error('signed_request too old');
  }

  return payload; // { user_id, issued_at, ... }
}

export function createFacebookRouter({ userRepo }) {
  const router = Router();

  // Meta Data Deletion Callback (server-to-server)
  router.post('/data-deletion', async (req, res) => {
    try {
      if (!req.is('application/x-www-form-urlencoded')) {
        return res.status(400).json({ error: 'Bad content type' });
      }

      const { signed_request } = req.body || {};
      const appSecret = config?.facebook?.clientSecret || config?.facebook?.appSecret;
      if (!signed_request) return res.status(400).json({ error: 'signed_request missing' });
      if (!appSecret)       return res.status(500).json({ error: 'Facebook app secret missing' });

      const data = verifySignedRequest(signed_request, appSecret);
      const userId = data?.user_id;
      if (!userId) return res.status(400).json({ error: 'user_id missing in signed_request' });

      // Best-effort delete in your repo
      if (typeof userRepo.deleteByProviderId === 'function') {
        await userRepo.deleteByProviderId('facebook', userId);
      } else if (typeof userRepo.deleteByFacebookId === 'function') {
        await userRepo.deleteByFacebookId(userId);
      } else {
        console.warn('[fb-deletion] No repo delete method found; uid=', userId);
      }

      const confirmation_code = randomBytes(6).toString('hex');
      const statusUrl = `${res.locals.baseUrl}/facebook/deletion-status/${encodeURIComponent(confirmation_code)}`;

      console.info('[fb-deletion]', { ok: true, uid: userId, code: confirmation_code });
      return res.status(200).json({ url: statusUrl, confirmation_code });
    } catch (err) {
      console.error('[fb-deletion] error:', err?.message || err);
      const confirmation_code = randomBytes(6).toString('hex');
      const statusUrl = `${res.locals.baseUrl}/facebook/deletion-status/${encodeURIComponent(confirmation_code)}?error=1`;
      return res.status(200).json({ url: statusUrl, confirmation_code });
    }
  });

  // Redirect GETs to your info page
  router.get('/data-deletion', (_req, res) => res.redirect(302, '/data-deletion'));

  // Human-readable status page
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
