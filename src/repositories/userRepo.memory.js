// src/repositories/userRepo.memory.js
export function createUserRepo({ seed = [] } = {}) {
  const norm = (s) => String(s ?? '').trim().toLowerCase();

  // ============================
  // Robust avatar picker (FINAL)
  // - Facebook: Graph /picture with explicit size (stable, no lookaside)
  // - Google: keep size query (=s96); DO NOT strip query params
  // ============================

  function fbAvatarUrlFromId(fbId, size = 128, cacheKey = null) {
    const base = `https://graph.facebook.com/v20.0/${encodeURIComponent(fbId)}/picture?width=${size}&height=${size}`;
    const t = cacheKey ?? Date.now(); // pass a stable key if preferred
    return `${base}&t=${t}`;
  }

  const pickAvatarFromProfile = (provider, profile, opts = {}) => {
    if (!profile) return null;

    let url = profile?.photos?.[0]?.value || null;

    if (provider === 'google') {
      url = url || profile?._json?.picture || null;

      // Normalize Google size; keep existing query string intact.
      if (url && url.includes('=s')) {
        url = url.replace(/=s\d+/, '=s96');
      } else if (url && url.includes('googleusercontent')) {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}s=96`;
      }
    }

    if (provider === 'facebook') {
      const fbId = String(profile?.id || '').trim();
      if (fbId) {
        const size = Number(opts.size) || 128;
        url = fbAvatarUrlFromId(fbId, size, opts.cacheKey);
      }
    }

    return url || null;
  };

  /* ----------------------------- Storage & helpers ----------------------------- */
  const _users = seed.map((u) => {
    const raw = norm(u.email ?? u.username);
    const nid = Number(u.id);
    return {
      ...u,
      id: Number.isFinite(nid) ? nid : undefined,
      email: raw || null,
      username: raw || null,
      name: u.name ?? (raw ? raw.split('@')[0] : null),
      avatarUrl: u.avatarUrl ?? null,
      googleId: u.googleId ?? null,
      facebookId: u.facebookId ?? null,
      appleId: u.appleId ?? null,
      createdAt: u.createdAt ?? new Date().toISOString(),
      passwordHash: u.passwordHash, // may be undefined for social users
    };
  });

  let nextId =
    _users.reduce((m, u) => (Number.isFinite(u?.id) ? Math.max(m, u.id) : m), 0) + 1;

  const clone = (obj) => (obj ? { ...obj } : null);

  /* --------------------------------- Lookups ---------------------------------- */
  const findById = async (id) =>
    clone(_users.find((u) => String(u.id) === String(id)) || null);

  const findByEmail = async (email) => {
    const e = norm(email);
    return clone(_users.find((x) => norm(x.email) === e) || null);
  };

  const findByUsername = async (username) => findByEmail(username);

  /* --------------------------------- Creates ---------------------------------- */
  const create = async ({ email, username, name, passwordHash, avatarUrl = null }) => {
    const raw = norm(email ?? username);
    if (!raw || !passwordHash) throw new Error('email & passwordHash required');
    if (await findByEmail(raw)) throw new Error('Email already registered');

    const user = {
      id: nextId++,
      email: raw,
      username: raw,
      name: (name && String(name).trim()) || raw.split('@')[0],
      passwordHash,
      avatarUrl,
      googleId: null,
      facebookId: null,
      appleId: null,
      createdAt: new Date().toISOString(),
    };
    _users.push(user);
    return clone(user);
  };

  // Create/update a social user (passwordless)
  const createSocial = async ({ email, name, avatarUrl, provider, providerId }) => {
    const rawEmail = norm(email) || null;

    // Upsert by email (preferred)
    let existing = rawEmail ? _users.find((u) => norm(u.email) === rawEmail) : null;
    if (existing) {
      if (!existing.name && name) existing.name = name;
      if (avatarUrl) existing.avatarUrl = avatarUrl; // refresh avatar on login
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
        if (avatarUrl) byProvider.avatarUrl = avatarUrl;
        return clone(byProvider);
      }
    }

    // Create new
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

  /* ---------------------------- Social upserts ---------------------------- */
  const findOrCreateFromGoogle = async (profile) => {
    const email = profile?.emails?.[0]?.value || null;
    const name  = profile?.displayName || null;
    const avatarUrl = pickAvatarFromProfile('google', profile);
    const providerId = String(profile?.id || '');
    if (!providerId) throw new Error('Google profile missing id');
    return createSocial({ email, name, avatarUrl, provider: 'google', providerId });
  };

  const findOrCreateFromFacebook = async (profile) => {
    const email = profile?.emails?.[0]?.value || null;
    const name  = profile?.displayName || null;
    const avatarUrl = pickAvatarFromProfile('facebook', profile);
    const providerId = String(profile?.id || '');
    if (!providerId) throw new Error('Facebook profile missing id');
    return createSocial({ email, name, avatarUrl, provider: 'facebook', providerId });
  };

  const findOrCreateFromApple = async (profile) => {
    const email = profile?.email || profile?._json?.email || null;
    const name =
      profile?.name?.fullName ||
      [profile?.name?.firstName, profile?.name?.lastName].filter(Boolean).join(' ') ||
      null;
    const providerId = String(profile?.id || '');
    if (!providerId) throw new Error('Apple profile missing id');
    return createSocial({ email, name, avatarUrl: null, provider: 'apple', providerId });
  };

  /* -------------------------------- Deletions ----------------------------- */
  const deleteByProviderId = async (provider, providerId) => {
    if (!provider || !providerId) return false;
    const key =
      provider === 'google'   ? 'googleId'   :
      provider === 'facebook' ? 'facebookId' :
      provider === 'apple'    ? 'appleId'    : null;
    if (!key) return false;

    let deleted = false;
    for (let i = _users.length - 1; i >= 0; i--) {
      if (_users[i]?.[key] === providerId) {
        _users.splice(i, 1);
        deleted = true;
      }
    }
    return deleted;
  };

  const deleteByFacebookId = async (fbId) => deleteByProviderId('facebook', fbId);

  /* -------------------------------- Debugging ----------------------------- */
  const _debugAll = () =>
    _users.map(({ passwordHash, ...rest }) => ({ ...rest, passwordHash: '***' }));

  /* --------------------------------- Export -------------------------------- */
  return {
    findById,
    findByEmail,
    findByUsername,
    create,
    findOrCreateFromGoogle,
    findOrCreateFromFacebook,
    findOrCreateFromApple,
    deleteByProviderId,
    deleteByFacebookId,
    _debugAll,
  };
}
