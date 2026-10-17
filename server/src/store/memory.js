'use strict';
// Хранилище в памяти — для локальной разработки и тестов. С путём к файлу сохраняет данные на диск.
const fs = require('fs');

function memoryStore(file) {
  let db = { users: {}, identities: {}, kv: {}, docs: {} };
  if (file && fs.existsSync(file)) { try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* начнём с пустого */ } }
  const save = () => { if (file) fs.writeFileSync(file, JSON.stringify(db, null, 1)); };
  const now = () => Math.floor(Date.now() / 1000);
  const clone = o => (o ? JSON.parse(JSON.stringify(o)) : null);
  return {
    kind: 'memory',
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
