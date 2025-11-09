// src/repositories/userRepo.mongo.js
export function createUserRepoMongo(db) {
  const col = db.collection('users');

  return {
    async findById(id)           { return col.findOne({ _id: id }); },
    async findByEmail(email)     { return col.findOne({ email: email.toLowerCase() }); },
    async findByUsername(u)      { return col.findOne({ username: u.toLowerCase() }); },

    async create(user)           { await col.insertOne(user); return user; },

    async findOrCreateFromGoogle(profile) {
      const email = (profile.emails?.[0]?.value || '').toLowerCase();
      let u = await col.findOne({ email });
      if (!u) {
        u = {
          _id: profile.id,
          email,
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value || null,
          provider: 'google',
          createdAt: new Date()
        };
        await col.insertOne(u);
      }
      return u;
    },

    async findOrCreateFromFacebook(profile) {
      const email = (profile.emails?.[0]?.value || '').toLowerCase() || `fb_${profile.id}@example.local`;
      let u = await col.findOne({ $or: [{ _id: profile.id }, { email }] });
      if (!u) {
        u = {
          _id: profile.id,
          email,
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value || null,
          provider: 'facebook',
          createdAt: new Date()
        };
        await col.insertOne(u);
      }
      return u;
    },
  };
}
