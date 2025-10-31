// src/repositories/userRepo.memory.js
export function createUserRepo({ seed = [] } = {}) {
  const norm = (s) => String(s ?? '').trim().toLowerCase();

  // ============================
  // Robust avatar picker (FINAL)
  // - Facebook: always use Graph URL with explicit size
  // - Google: keep Google's size param (=s96), DO NOT strip query
  // ============================
  const pickAvatarFromProfile = (provider, profile) => {               // NEW / FINAL
    if (!profile) return null;

    let url = profile?.photos?.[0]?.value || null;

    if (provider === 'google') {
      // Fallback if photos[] is missing
      url = url || profile?._json?.picture || null;
      // Normalize size (keep query string)
      if (url && url.includes('=s')) {
        url = url.replace(/=s\d+/, '=s96');                             // CHANGED
      } else if (url && url.includes('googleusercontent')) {
        // Some URLs omit "=sNN" — append a reasonable default
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}s=96`;                                       // CHANGED
      }
      // IMPORTANT: do NOT split('?')[0]; keep params for sizing            // CHANGED
    }

    if (provider === 'facebook') {
      const fbId = String(profile?.id || '').trim();
      if (fbId) {
        // Use Graph with explicit size; redirect=1 is default but fine
        url = `https://graph.facebook.com/${fbId}/picture?width=128&height=128&redirect=1`; // CHANGED
      }
    }

    return url || null;
  };

  // …(unchanged seed, nextId, clone, finders, etc.)

  // Create/update a social user (passwordless)
  const createSocial = async ({ email, name, avatarUrl, provider, providerId }) => {
    const rawEmail = norm(email) || null;

    // Upsert by email
    let existing = rawEmail ? _users.find((u) => norm(u.email) === rawEmail) : null;
    if (existing) {
      if (!existing.name && name) existing.name = name;
      if (avatarUrl) existing.avatarUrl = avatarUrl;                    // keep avatar fresh
      if (provider === 'google')   existing.googleId   = providerId;
      if (provider === 'facebook') existing.facebookId = providerId;
      if (provider === 'apple')    existing.appleId    = providerId;
      return clone(existing);
    }

    // Upsert by provider id if no email
    if (!rawEmail) {
      const byProvider =
        (provider === 'google'   && _users.find((u) => u.googleId   === providerId)) ||
        (provider === 'facebook' && _users.find((u) => u.facebookId === providerId)) ||
        (provider === 'apple'    && _users.find((u) => u.appleId    === providerId)) ||
        null;
      if (byProvider) {
        if (avatarUrl) byProvider.avatarUrl = avatarUrl;                // refresh avatar
        return clone(byProvider);
      }
    }

    const user = {
      id: nextId++,
      email: rawEmail,
      username: rawEmail,
      name: (name && String(name).trim()) || (rawEmail ? rawEmail.split('@')[0] : 'New User'),
      passwordHash: undefined,
      avatarUrl: avatarUrl || null,
      googleId:   provider === 'google'   ? providerId : null,
      facebookId: provider === 'facebook' ? providerId : null,
      appleId:    provider === 'apple'    ? providerId : null,
      createdAt: new Date().toISOString(),
    };
    _users.push(user);
    return clone(user);
  };

  /* ---- Social upserts call the picker ---- */
  const findOrCreateFromGoogle = async (profile) => {
    const email = profile?.emails?.[0]?.value || null;
    const name  = profile?.displayName || null;
    const avatarUrl = pickAvatarFromProfile('google', profile);         // FINAL
    const providerId = String(profile?.id || '');
    if (!providerId) throw new Error('Google profile missing id');
    return createSocial({ email, name, avatarUrl, provider: 'google', providerId });
  };

  const findOrCreateFromFacebook = async (profile) => {
    const email = profile?.emails?.[0]?.value || null;
    const name  = profile?.displayName || null;
    const avatarUrl = pickAvatarFromProfile('facebook', profile);       // FINAL
    const providerId = String(profile?.id || '');
    if (!providerId) throw new Error('Facebook profile missing id');
    return createSocial({ email, name, avatarUrl, provider: 'facebook', providerId });
  };

  // …(deletions, _debugAll, exports unchanged)
}
