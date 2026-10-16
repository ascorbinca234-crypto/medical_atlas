'use strict';
const test = require('node:test'), assert = require('node:assert');
const net = require('net');
const { mailer } = require('../src/mail');
const { ydbStore } = require('../src/store/ydb');

test('SMTP: полный диалог с сервером, AUTH LOGIN, UTF-8 тема, dot-stuffing', async () => {
  const got = { lines: [] };
  const srv = net.createServer(sock => {
    sock.setEncoding('utf8'); let buf = '', inData = false, data = '';
    const say = s => sock.write(s + '\r\n');
    say('220 fake ESMTP');
    sock.on('data', c => {
      buf += c; let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (line === '.') { inData = false; got.data = data; say('250 queued'); } else data += line + '\n'; continue; }
        got.lines.push(line);
        if (/^EHLO/.test(line)) { sock.write('250-fake\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n'); }
        else if (line === 'AUTH LOGIN') say('334 VXNlcm5hbWU6');
        else if (got.lines.length === 3) say('334 UGFzc3dvcmQ6');
        else if (got.lines.length === 4) say('235 ok');
        else if (/^MAIL FROM/.test(line) || /^RCPT TO/.test(line)) say('250 ok');
        else if (line === 'DATA') { inData = true; say('354 go'); }
        else if (line === 'QUIT') { say('221 bye'); sock.end(); }
      }
    });
  });
  await new Promise(r => srv.listen(0, r));
  const m = mailer({ transport: 'smtp', host: '127.0.0.1', port: srv.address().port, secure: false, user: 'atlas@yandex.ru', pass: 'app-pass', from: 'atlas@yandex.ru', fromName: 'Медицинский атлас' });
  await m.send({ to: 'u@ex.ru', subject: 'Подтвердите почту', text: 'строка\n.точка в начале', html: '<p>ok</p>' });
  srv.close();
  assert.strictEqual(Buffer.from(got.lines[2], 'base64').toString(), 'atlas@yandex.ru');
  assert.strictEqual(Buffer.from(got.lines[3], 'base64').toString(), 'app-pass');
  assert.ok(got.lines.includes('MAIL FROM:<atlas@yandex.ru>') && got.lines.includes('RCPT TO:<u@ex.ru>'));
  assert.match(got.data, /Subject: =\?UTF-8\?B\?/);
  const textPart = /charset=utf-8\nContent-Transfer-Encoding: base64\n\n([A-Za-z0-9+/=\n]+)/.exec(got.data)[1];
  assert.strictEqual(Buffer.from(textPart.replace(/\n/g, ''), 'base64').toString(), 'строка\n.точка в начале');
});

test('YDB Document API: формат запросов и условная запись', async () => {
  const reqs = [];
  const items = {};
  const fake = async (url, o) => {
    const target = o.headers['X-Amz-Target'].split('.')[1], b = JSON.parse(o.body);
    reqs.push({ url, target, b, auth: o.headers.Authorization });
    const res = (status, j) => ({ ok: status < 300, status, text: async () => JSON.stringify(j) });
    const key = b.TableName + ':' + JSON.stringify(b.Key || { k: b.Item.k || b.Item.id });
    if (target === 'PutItem') { const k = b.TableName + ':' + JSON.stringify(b.Item.k ? { k: b.Item.k } : { id: b.Item.id }); if (b.ConditionExpression && items[k]) return res(400, { __type: 'com.amazonaws.dynamodb.v20120810#ConditionalCheckFailedException', message: 'cond' }); items[k] = b.Item; return res(200, {}); }
    if (target === 'GetItem') return res(200, items[key] ? { Item: items[key] } : {});
    if (target === 'UpdateItem') { const it = items[key] || (items[key] = { n: { N: '0' } }); it.n = { N: String(+it.n.N + 1) }; return res(200, { Attributes: it }); }
    return res(200, {});
  };
  const s = ydbStore({ endpoint: 'https://docapi.serverless.yandexcloud.net/ru-central1/b1g/etn', accessKeyId: 'AK', secretAccessKey: 'SK', prefix: 'ma_' }, fake);
  await s.putUser({ id: 'u1', name: 'Анна' });
  assert.deepStrictEqual(await s.getUser('u1'), { id: 'u1', name: 'Анна' });
  assert.strictEqual(await s.createIdentity('email:a@b.ru', 'u1'), true);
  assert.strictEqual(await s.createIdentity('email:a@b.ru', 'u2'), false);
  assert.strictEqual(await s.getIdentity('email:a@b.ru'), 'u1');
  assert.strictEqual(await s.incr('rl:x', 900), 1);
  assert.strictEqual(await s.incr('rl:x', 900), 2);
  assert.match(reqs[0].auth, /^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/ru-central1\/dynamodb\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/);
  assert.strictEqual(reqs[0].b.TableName, 'ma_users');
});
