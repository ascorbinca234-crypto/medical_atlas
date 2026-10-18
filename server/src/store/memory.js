'use strict';
// Хранилище в памяти — для локальной разработки и тестов. С путём к файлу сохраняет данные на диск.
const fs = require('fs');
const crypto = require('crypto');

function memoryStore(file) {
  let db = { users: {}, identities: {}, kv: {}, docs: {} };
  if (file && fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const key of ['users', 'identities', 'kv']) {
        if (!parsed || !parsed[key] || typeof parsed[key] !== 'object' || Array.isArray(parsed[key])) throw new Error('Invalid schema');
      }
      if (parsed.docs !== undefined && (!parsed.docs || typeof parsed.docs !== 'object' || Array.isArray(parsed.docs))) throw new Error('Invalid docs');
      db = { ...parsed, docs: parsed.docs || {} };
    } catch (e) { throw new Error('Cannot open store: invalid data; original file preserved', { cause: e }); }
  }
  let committed = JSON.stringify(db);
  const save = () => {
    if (!file) return;
    const tmp = file + '.tmp-' + crypto.randomBytes(8).toString('hex');
    try {
      const next = JSON.stringify(db);
      fs.writeFileSync(tmp, next, { mode: 0o600, flag: 'wx' });
      const fd = fs.openSync(tmp, 'r');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(tmp, file); committed = next;
    } catch (e) { db = JSON.parse(committed); throw e; }
    finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  };
  const now = () => Math.floor(Date.now() / 1000);
  const clone = o => (o ? JSON.parse(JSON.stringify(o)) : null);
  return {
    kind: 'memory',
    async ready() {},
    async updateUser(id, mutate) {
      const u = clone(db.users[id]);
      if (!u || u.deleted) return null;
      mutate(u);
      if (u.id !== id) throw new Error('User id cannot change');
      db.users[id] = clone(u); save(); return clone(u);
    },
    async getUser(id) { return clone(db.users[id]); },
    async putUser(u) { db.users[u.id] = clone(u); save(); },
    async deleteUser(id) { delete db.users[id]; save(); },
    async getIdentity(k) { return db.identities[k] || null; },
    async createIdentity(k, uid) { if (db.identities[k]) return false; db.identities[k] = uid; save(); return true; },
    async deleteIdentity(k) { delete db.identities[k]; save(); },
    async incr(k, ttl) { const x = db.kv[k]; if (!x || x.exp < now()) db.kv[k] = { n: 0, exp: now() + ttl }; db.kv[k].n += 1; save(); return db.kv[k].n; },
    async once(k, ttl) { const x = db.kv[k]; if (x && x.exp >= now()) return false; db.kv[k] = { n: 1, exp: now() + ttl }; save(); return true; },
    // документы с версией: прогресс и ординаторская. putDoc пишет, только если версия не изменилась
    async getDoc(k) { const x = (db.docs || {})[k]; return x ? clone(x) : null; },
    async putDoc(k, d, v) { db.docs = db.docs || {}; const cur = db.docs[k]; if ((cur ? cur.v : 0) !== v) return false; db.docs[k] = { d: clone(d), v: v + 1 }; save(); return true; },
    async deleteDoc(k) { if (db.docs) delete db.docs[k]; save(); },
    _dump: () => db,
  };
}

module.exports = { memoryStore };
