'use strict';
// JWT (HS256) для сессий и зашифрованные одноразовые токены (AES-256-GCM) для писем и OAuth.
const crypto = require('crypto');

const b64u = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const now = () => Math.floor(Date.now() / 1000);

function keys(secret) {
  const k = info => Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), Buffer.from(info), 32));
  return { jwt: k('ma-jwt-v1'), seal: k('ma-seal-v1') };
}

function jwtSign(payload, key) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(crypto.createHmac('sha256', key).update(head + '.' + body).digest());
  return head + '.' + body + '.' + sig;
}

function jwtVerify(token, key) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  let head;
  try { head = JSON.parse(unb64u(parts[0]).toString('utf8')); } catch (e) { return null; }
  if (!head || head.alg !== 'HS256') return null;
  const want = crypto.createHmac('sha256', key).update(parts[0] + '.' + parts[1]).digest();
  const got = unb64u(parts[2]);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  let p;
  try { p = JSON.parse(unb64u(parts[1]).toString('utf8')); } catch (e) { return null; }
  if (!p || typeof p.exp !== 'number' || p.exp < now()) return null;
  return p;
}

function seal(obj, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return b64u(Buffer.concat([iv, ct, c.getAuthTag()]));
}

function open(str, key) {
  try {
    const buf = unb64u(str);
    if (buf.length < 29) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(buf.length - 16));
    const obj = JSON.parse(Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]).toString('utf8'));
    if (!obj || typeof obj.exp !== 'number' || obj.exp < now()) return null;
    return obj;
  } catch (e) { return null; }
}

const randomId = (n = 16) => b64u(crypto.randomBytes(n));

module.exports = { keys, jwtSign, jwtVerify, seal, open, randomId, b64u, now };
