// src/routes/facebook.routes.js
import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config/env.js';

function base64UrlDecodeToBuf(str = '') {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  // pad to multiple of 4
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + '='.repeat(pad), 'base64');
}

function verifySignedRequest(signedRequest, appSecret) {
  const [encodedSig, encodedPayload] = String(signedRequest || '').split('.', 2);
  if (!encodedSig || !encodedPayload) throw new Error('Malformed signed_request');

  const sigBuf = base64UrlDecodeToBuf(encodedSig);
  const payloadBuf = base64UrlDecodeToBuf(encodedPayload);

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest();

  // If lengths differ, timingSafeEqual throws — quick constant-time-ish guard
  if (sigBuf.length !== expected.length || !crypto.timingSafeEqual(sigBuf, expected)) {
    throw new Error('Bad signature');
  }

  return JSON.parse(payloadBuf.toString('utf8')); // contains user_id, issued_at, etc.
}

export function createFacebookRouter({ userRepo }) {
  const router = Router();

  // POST x-www-form-urlencoded: { signed_request: ... }
  router.post('/data-deletion', async (req, res) => {
    try {
      const { signed_request } = req.body || {};
      const appSecret = config?.facebook?.clientSecret || config?.facebook?.appSecret;
      if (!signed_request) throw new Error('signed_request missing');
      if (!appSecret)       throw new Error('FACEBOOK_APP_SECRET missing');

      const data = verifySignedRequest(signed_request, appSecret);
      const userId = data?.user_id;
      if (!userId) throw new Error('user_id missing in signed_request');

      // Best-effort delete
      if (typeof userRepo.deleteByProviderId === 'function') {
        await userRepo.deleteByProviderId('facebook', userId);
      } else if (typeof userRepo.deleteByFacebookId === 'function') {
        await userRepo.deleteByFacebookId(userId);
      } else {
        console.warn('[fb-deletion] No delete method implemented; userId=', userId);
      }

      const confirmation_code = `fb-${userId}-${Date.now()}`;
      const statusUrl = `https://funnyjoke-vv54.onrender.com/data-deletion?ticket=${encodeURIComponent(confirmation_code)}`;

      // Facebook requires 200 with { url, confirmation_code }
      return res.status(200).json({ url: statusUrl, confirmation_code });
    } catch (err) {
      console.error('[fb-deletion] error:', err?.message || err);
      const confirmation_code = `fb-error-${Date.now()}`;
      const statusUrl = `https://funnyjoke-vv54.onrender.com/data-deletion?error=1&ticket=${encodeURIComponent(confirmation_code)}`;
      return res.status(200).json({ url: statusUrl, confirmation_code });
    }
  });

  return router;
}
