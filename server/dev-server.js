'use strict';
const http = require('http');
const { fromEnv } = require('./src/runtime');

function createServer(app, { maxBodyBytes = 256 * 1024, bodyTimeoutMs = 15000 } = {}) {
  return http.createServer({ headersTimeout: 10000, requestTimeout: 30000 }, (req, res) => {
    let finished = false, timer, size = 0;
    const chunks = [];
    function reply(status, body, headers = {}) {
      if (finished || res.destroyed) return;
      finished = true; clearTimeout(timer);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
      res.end(body);
    }
    const reject = status => {
      reply(status, JSON.stringify({ error: 'invalid_request' }), { Connection: 'close' });
      req.resume();
    };
    req.on('error', () => { clearTimeout(timer); if (!res.destroyed) reject(400); });
    req.on('aborted', () => { finished = true; clearTimeout(timer); });
    res.on('error', () => { finished = true; clearTimeout(timer); });
    res.on('close', () => { finished = true; clearTimeout(timer); });
    let u;
    try {
      if (!req.url.startsWith('/') || req.url.startsWith('//')) throw new Error('Invalid target');
      u = new URL(req.url, 'http://localhost');
    } catch (e) { reject(400); return; }
    if (Number(req.headers['content-length']) > maxBodyBytes) { reject(413); return; }
    timer = setTimeout(() => reject(408), bodyTimeoutMs);
    req.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > maxBodyBytes) { chunks.length = 0; reject(413); return; }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (finished) return;
      clearTimeout(timer);
      try {
        const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));
        const r = await app.handle({ method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams), headers,
          body: Buffer.concat(chunks).toString('utf8'), ip: req.socket.remoteAddress });
        reply(r.status, r.base64 ? Buffer.from(r.body, 'base64') : r.body, r.headers);
      } catch (e) { reply(500, JSON.stringify({ error: 'server' })); }
    });
  });
}
if (require.main === module) {
  const env = { STORE: 'memory', MAIL_TRANSPORT: 'log', ...process.env };
  const port = Number(env.PORT || 8787);
  createServer(fromEnv(env)).listen(port, env.HOST || '127.0.0.1', () => console.log(`API: http://localhost:${port}`));
}
module.exports = { createServer };
