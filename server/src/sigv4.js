'use strict';
// Подпись запросов AWS Signature V4 — ею подписываются запросы к YDB Document API (совместим с DynamoDB).
const crypto = require('crypto');

const hmac = (key, s) => crypto.createHmac('sha256', key).update(s, 'utf8').digest();
const sha256hex = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/**
 * @param {{method:string, url:string, headers:Object<string,string>, body:string}} req
 * @param {{accessKeyId:string, secretAccessKey:string, region:string, service:string, date?:Date}} o
 * @returns {Object<string,string>} заголовки с X-Amz-Date и Authorization
 */
function sign(req, o) {
  const u = new URL(req.url);
  const d = o.date || new Date();
  const amzDate = d.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers = Object.assign({}, req.headers, { host: u.host, 'x-amz-date': amzDate });
  const lower = {};
  Object.keys(headers).forEach(k => { lower[k.toLowerCase()] = String(headers[k]).trim().replace(/\s+/g, ' '); });
  const names = Object.keys(lower).sort();
  const canonPath = u.pathname.split('/').map(seg => enc(decodeURIComponent(seg))).join('/') || '/';
  const query = [...u.searchParams.entries()].map(([k, v]) => [enc(k), enc(v)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1)).map(p => p.join('=')).join('&');
  const canon = [req.method.toUpperCase(), canonPath, query, names.map(n => n + ':' + lower[n]).join('\n') + '\n', names.join(';'), sha256hex(req.body || '')].join('\n');
  const scope = `${day}/${o.region}/${o.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canon)].join('\n');
  let k = hmac('AWS4' + o.secretAccessKey, day);
  k = hmac(k, o.region); k = hmac(k, o.service); k = hmac(k, 'aws4_request');
  const signature = crypto.createHmac('sha256', k).update(toSign, 'utf8').digest('hex');
  const out = Object.assign({}, req.headers, { 'X-Amz-Date': amzDate });
  out.Authorization = `AWS4-HMAC-SHA256 Credential=${o.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return out;
}

module.exports = { sign };
