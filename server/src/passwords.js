'use strict';
// Хеширование паролей: scrypt (N=16384, r=8, p=1), соль 16 байт.
const crypto = require('crypto');
const N = 16384, R = 8, P = 1, LEN = 64;

const scrypt = (pw, salt) => new Promise((ok, fail) => crypto.scrypt(pw, salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? fail(e) : ok(k))));

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pw).normalize('NFKC'), salt);
  return ['s1', salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(pw, stored) {
  const [v, s, h] = String(stored || '').split('$');
  if (v !== 's1' || !s || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = await scrypt(String(pw).normalize('NFKC'), Buffer.from(s, 'base64'));
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

module.exports = { hashPassword, verifyPassword };
