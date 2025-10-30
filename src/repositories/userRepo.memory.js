// src/repositories/userRepo.memory.js
export function createUserRepo({ seed = [] } = {}) {
  const norm = (s) => String(s ?? '').trim().toLowerCase();

  // In-memory array of users
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
      passwordHash: u.passwordHash, // may be undefined for social
    };
  });

  let nextId =
    _users.reduce((m, u) => (Number.isFinite(u?.id) ? Math.max(m, u.id) : m), 0) + 1;

  const clone = (obj) => (obj ? { ...obj } : null);

  /* ------------------------------- Lookups ------------------------------- */
  const findById = async (id) =>
    clone(_users.find((u) => String(u.id) === String(id)) || null);

  const findByEmail = async (email) => {
    const e = norm(email);
    return clone(_users.find((x) => norm(x.email) === e) || null);
  };

  const findByUsername = async (username) => findByEmail(username);

  /* ------------------------------- Creates ------------------------------- */
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

    // If email present, upsert into the same account
    let existing = rawEmail ? _users.find((u) => norm(u.email) === rawEmail) : null;
    if (existing) {
      if (!existing.name && name) existing.name = name;
      if (!existing.avatarUrl && avatarUrl) existing.avatarUrl = avatarUrl;
      if (provider === 'google') existing.googleId = providerId;
      if (provider === 'facebook') existing.facebookId = providerId;
      if (provider === 'apple') existing.appleId = providerId;
      return clone(existing);
    }

    // If no email, try to find by provider id to avoid dupes
    if (!rawEmail) {
      const byProvider =
        (provider === 'google' && _users.find((u) => u.googleId === providerId)) ||
        (provider === 'facebook' && _users.find((u) => u.facebookId === providerId)) ||
        (provider === 'apple' && _users.find((u) => u.appleId === providerId)) ||
        null;
      if (byProvider) return clone(byProvider);
    }

    const user = {
      id: nextId++,
      email: rawEmail,
      username: rawEmail,
      name: (name && String(name).trim()) || (rawEmail ? rawEmail.split('@')[0] : 'New User'),
      passwordHash: undefined,
      avatarUrl: avatarUrl || null,
      googleId: provider === 'google' ? providerId : null,
      facebookId: provider === 'facebook' ? providerId : null,
      appleId: provider === 'apple' ? providerId : null,
      createdAt: new Date().toISOString(),
    };
    _users.push(user);
    return clone(user);
  };

  /* ---------------------------- Social upserts --------------------------- */
  const findOrCreateFromGoogle = async (profile) => {
    const email = profile?.emails?.[0]?.value || null;
    const name = profile?.displayName || null;
    const avatarUrl = profile?.photos?.[0]?.value?.split('?')[0] || null;
    const providerId = String(profile?.id || '');
    if (!providerId) throw new Error('Google profile missing id');
    return createSocial({ email, name, avatarUrl, provider: 'google', providerId });
  };

  const findOrCreateFromFacebook = async (profile) => {
    const email = profile?.emails?.[0]?.value || null;
    const name = profile?.displayName || null;
    const avatarUrl = profile?.photos?.[0]?.value?.split('?')[0] || null;
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

  /* ------------------------------ Deletions ------------------------------ */
  // Delete by generic provider+id (returns true if any record was removed)
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

  // Convenience wrapper for Facebook
  const deleteByFacebookId = async (fbId) => deleteByProviderId('facebook', fbId);

  /* ------------------------------- Debugging ----------------------------- */
  const _debugAll = () =>
    _users.map(({ passwordHash, ...rest }) => ({ ...rest, passwordHash: '***' }));

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
