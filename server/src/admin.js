'use strict';
// One-time provisioning. The password hash is configured privately in Cloud Functions.
// The durable marker prevents restarts from undoing credential changes or deletion.
const crypto = require('crypto');
async function provisionAdmin(store, seed) {
  if (!seed) return;
  const key = 'setup:content-admin:' + seed.id;
  const uid = 'admin-' + crypto.createHash('sha256').update(seed.id).digest('hex').slice(0, 24);
  const owner = crypto.randomBytes(12).toString('hex');
  for (let attempt = 0; attempt < 100; attempt++) {
    const record = await store.getDoc(key);
    if (record && record.d.complete) return;
    if (record && record.d.until > Date.now()) { await new Promise(r => setTimeout(r, 30)); continue; }
    if (!await store.putDoc(key, { owner, until: Date.now() + 30000 }, record ? record.v : 0)) continue;
    const lock = await store.getDoc(key);
    try {
      const identity = 'email:' + seed.email, previous = await store.getIdentity(identity);
      if (previous && previous !== uid) throw new Error('Admin login is already occupied; existing account was not changed');
      let user = await store.getUser(uid);
      if (!user) {
        user = { id: uid, email: seed.email, emailVerified: true, name: 'Администратор', avatar: null,
          pw: seed.passwordHash, tv: 0, ids: [identity], contentAdmin: true, createdAt: new Date().toISOString() };
        await store.putUser(user);
      } else if (!user.contentAdmin || user.email !== seed.email) throw new Error('Admin bootstrap identity mismatch');
      if (!previous && !await store.createIdentity(identity, uid) && await store.getIdentity(identity) !== uid) throw new Error('Admin login conflict');
      if (!await store.putDoc(key, { complete: true, userId: uid }, lock.v)) throw new Error('Admin setup conflict');
      return;
    } catch (error) {
      await store.putDoc(key, { owner, until: 0 }, lock.v);
      throw error;
    }
  }
  throw new Error('Admin setup is busy; retry');
}
module.exports = { provisionAdmin };
