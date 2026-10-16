'use strict';
// Точка входа Yandex Cloud Functions (вызов через API Gateway, payload_format_version 0.1).
const { fromEnv } = require('./src/runtime');
let app = null;

module.exports.handler = async function (event) {
  if (!app) app = fromEnv();
  const headers = {};
  Object.keys(event.headers || {}).forEach(k => { headers[k.toLowerCase()] = event.headers[k]; });
  let p = event.url || event.path || '/';
  try { p = new URL(p, 'http://x').pathname; } catch (e) { /* оставляем как есть */ }
  const ctx = event.requestContext || {};
  const res = await app.handle({
    method: (event.httpMethod || 'GET').toUpperCase(),
    path: p,
    query: event.queryStringParameters || {},
    headers,
    body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : '',
    ip: (ctx.identity && ctx.identity.sourceIp) || String(headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown',
  });
  return { statusCode: res.status, headers: res.headers || {}, body: res.body || '', isBase64Encoded: !!res.base64 };
};
