'use strict';
// Локальный сервер для разработки:  node dev-server.js
// Настройки — из переменных окружения (см. .env.example); по умолчанию данные в памяти, письма в консоль.
const http = require('http');
const { fromEnv } = require('./src/runtime');

const env = Object.assign({ STORE: 'memory', MAIL_TRANSPORT: 'log' }, process.env);
const app = fromEnv(env);
const port = Number(env.PORT || 8787);

http.createServer((req, res) => {
  let data = '';
  req.on('data', c => { data += c; });
  req.on('end', async () => {
    const u = new URL(req.url, 'http://localhost');
    const headers = {};
    Object.keys(req.headers).forEach(k => { headers[k] = Array.isArray(req.headers[k]) ? req.headers[k].join(', ') : req.headers[k]; });
    const r = await app.handle({ method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams), headers, body: data, ip: req.socket.remoteAddress });
    res.writeHead(r.status, r.headers || {});
    res.end(r.base64 ? Buffer.from(r.body, 'base64') : r.body);
  });
}).listen(port, () => console.log(`API: http://localhost:${port}  (хранилище: ${env.STORE}, почта: ${env.MAIL_TRANSPORT})`));
