// src/repositories/userRepo.memory.js
export function createUserRepo({ seed = [] } = {}) {
  const _users = seed.map(u => {
    const raw = String(u.email ?? u.username ?? '').trim().toLowerCase();
    const nid = Number(u.id);
    return {
      ...u,
      id: Number.isFinite(nid) ? nid : undefined,       // <- numeric id or undefined
      email: raw || null,
      username: raw || null,                             // back-compat
      name: u.name ?? (raw ? raw.split('@')[0] : null),
      createdAt: u.createdAt ?? new Date().toISOString(),
    };
  });

  let nextId = _users.reduce((m, u) => Number.isFinite(u?.id) ? Math.max(m, u.id) : m, 0) + 1;

  const clone = (obj) => (obj ? { ...obj } : null);

  const findById = async (id) =>
    clone(_users.find(u => String(u.id) === String(id)) || null);

  const findByEmail = async (email) => {
    const e = String(email || '').trim().toLowerCase();
    return clone(_users.find(x => (x.email || '').toLowerCase() === e) || null);
  };

  const findByUsername = async (username) => findByEmail(username);

  const create = async ({ email, username, name, passwordHash, avatarUrl = null }) => {
    const raw = String(email ?? username ?? '').trim().toLowerCase();
    if (!raw || !passwordHash) throw new Error('email & passwordHash required');
    if (await findByEmail(raw)) throw new Error('Email already registered');

    const user = {
      id: nextId++,
      email: raw,
      username: raw,
      name: (name && String(name).trim()) || raw.split('@')[0],
      passwordHash,
      avatarUrl: avatarUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    _users.push(user);
    return clone(user);
  };

  const _debugAll = () =>
    _users.map(({ passwordHash, ...rest }) => ({ ...rest, passwordHash: '***' }));

  return { findById, findByEmail, findByUsername, create, _debugAll };
}
