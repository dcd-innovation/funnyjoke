// src/repositories/userRepo.memory.js
import { MongoClient } from 'mongodb';  // <-- Add MongoDB client import
import { config } from '../config/env.js';  // <-- Assuming MongoDB URI is in config

// Establish connection to MongoDB
const mongoUri = config.MONGO_URI; // Get Mongo URI from environment or config
const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

await client.connect();
const db = client.db();  // Connect to the default database (you can specify db name if needed)
const usersCollection = db.collection('users');  // This is where user data will be stored

const norm = (s) => String(s ?? '').trim().toLowerCase();

// ============================
// Avatar URL functions (same as before)
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
const findById = async (id) => {
  const user = await usersCollection.findOne({ id: Number(id) });  // MongoDB query
  return user ? { ...user } : null;  // Return user data if found
};

const findByEmail = async (email) => {
  const user = await usersCollection.findOne({ email: norm(email) });  // MongoDB query
  return user ? { ...user } : null;  // Return user data if found
};

const findByUsername = async (username) => findByEmail(username);

const create = async ({ email, username, name, passwordHash, avatarUrl = null }) => {
  const raw = norm(email ?? username);
  if (!raw || !passwordHash) throw new Error('email & passwordHash required');
  if (await findByEmail(raw)) throw new Error('Email already registered');

  const user = {
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

  const result = await usersCollection.insertOne(user);  // MongoDB insert
  return { ...result.ops[0] };  // Return newly created user
};

// Create/update a social user (passwordless)
const createSocial = async ({ email, name, avatarUrl, provider, providerId }) => {
  const rawEmail = norm(email) || null;

  // Upsert by email (preferred)
  let existing = rawEmail ? await findByEmail(rawEmail) : null;  // MongoDB query
  if (existing) {
    if (!existing.name && name) existing.name = name;
    if (avatarUrl) existing.avatarUrl = avatarUrl; // refresh avatar on login
    if (provider === 'google') existing.googleId = providerId;
    if (provider === 'facebook') existing.facebookId = providerId;
    if (provider === 'apple') existing.appleId = providerId;

    await usersCollection.updateOne({ email: rawEmail }, { $set: existing });  // MongoDB update
    return { ...existing };
  }

  // Upsert by provider id if no email
  if (!rawEmail) {
    const byProvider =
      (provider === 'google' && await usersCollection.findOne({ googleId: providerId })) ||
      (provider === 'facebook' && await usersCollection.findOne({ facebookId: providerId })) ||
      (provider === 'apple' && await usersCollection.findOne({ appleId: providerId })) ||
      null;
    if (byProvider) {
      if (avatarUrl) byProvider.avatarUrl = avatarUrl;
      return { ...byProvider };
    }
  }

  // Create new user in MongoDB
  const user = {
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

  const result = await usersCollection.insertOne(user);  // MongoDB insert
  return { ...result.ops[0] };
};

/* ---------------------------- Social upserts ---------------------------- */
const findOrCreateFromGoogle = async (profile) => {
  const email = profile?.emails?.[0]?.value || null;
  const name = profile?.displayName || null;
  const avatarUrl = pickAvatarFromProfile('google', profile);
  const providerId = String(profile?.id || '');
  if (!providerId) throw new Error('Google profile missing id');
  return createSocial({ email, name, avatarUrl, provider: 'google', providerId });
};

const findOrCreateFromFacebook = async (profile) => {
  const email = profile?.emails?.[0]?.value || null;
  const name = profile?.displayName || null;
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

// -------------------------------- Deletions -----------------------------
const deleteByProviderId = async (provider, providerId) => {
  if (!provider || !providerId) return false;
  const key =
    provider === 'google' ? 'googleId' :
    provider === 'facebook' ? 'facebookId' :
    provider === 'apple' ? 'appleId' : null;
  if (!key) return false;

  let deleted = false;
  const result = await usersCollection.deleteMany({ [key]: providerId });  // MongoDB delete
  if (result.deletedCount > 0) deleted = true;
  return deleted;
};

const deleteByFacebookId = async (fbId) => deleteByProviderId('facebook', fbId);

/* -------------------------------- Debugging ----------------------------- */
const _debugAll = async () => {
  const users = await usersCollection.find().toArray();  // Fetch all users
  return users.map(({ passwordHash, ...rest }) => ({ ...rest, passwordHash: '***' }));
};

/* --------------------------------- Export -------------------------------- */
export default {
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
