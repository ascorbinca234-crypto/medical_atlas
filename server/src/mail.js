'use strict';
// Отправка писем. smtp — через почтовый ящик (по умолчанию smtp.yandex.ru:465 с паролем приложения),
// log — для разработки: письма пишутся в файл MAIL_OUTBOX или в консоль.
const net = require('net'), tls = require('tls'), fs = require('fs'), crypto = require('crypto'), os = require('os');

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const wrap = s => s.replace(/.{1,76}/g, '$&\r\n');
const hdr = s => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=');

function buildMessage({ from, fromName, to, replyTo, subject, text, html }) {
  const boundary = 'ma-' + crypto.randomBytes(12).toString('hex');
  const domain = String(from).split('@')[1] || 'localhost';
  return [
    `From: ${hdr(fromName)} <${from}>`,
    `To: <${to}>`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${hdr(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(html)),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

function smtpSend(o, to, message) {
  return new Promise((resolve, reject) => {
    const sock = o.secure ? tls.connect({ host: o.host, port: o.port, servername: o.host }) : net.connect({ host: o.host, port: o.port });
    sock.setEncoding('utf8');
    sock.setTimeout(15000, () => { sock.destroy(); reject(new Error('SMTP: таймаут')); });
    let buf = '', step = 0, done = false;
    const data = message.replace(/\r\n\./g, '\r\n..');
    const steps = [
      [220, () => 'EHLO ' + (os.hostname() || 'localhost')],
      [250, () => 'AUTH LOGIN'],
      [334, () => b64(o.user)],
      [334, () => b64(o.pass)],
      [235, () => `MAIL FROM:<${o.from}>`],
      [250, () => `RCPT TO:<${to}>`],
      [250, () => 'DATA'],
      [354, () => data + '\r\n.'],
      [250, () => 'QUIT'],
      [221, null],
    ];
    const fail = msg => { if (!done) { done = true; sock.destroy(); reject(new Error('SMTP: ' + msg)); } };
    sock.on('error', e => fail(e.message));
    sock.on('data', chunk => {
      buf += chunk;
      while (true) {
        const lines = buf.split('\r\n');
        const endIdx = lines.findIndex(l => /^\d{3} /.test(l));
        if (endIdx < 0) return;                              // ответ ещё не дочитан
        const code = Number(lines[endIdx].slice(0, 3));
        const text = lines.slice(0, endIdx + 1).join(' | ');
        buf = lines.slice(endIdx + 1).join('\r\n');
        const [want, next] = steps[step];
        if (code !== want) return fail(`ожидался ${want}, получен ответ «${text.slice(0, 200)}»`);
        step++;
        if (!next) { done = true; sock.end(); return resolve(); }
        sock.write(next() + '\r\n');
      }
    });
  });
}

function mailer(o) {
  return {
    async send({ to, replyTo, subject, text, html }) {
      if (o.transport === 'log') {
        const line = JSON.stringify({ to, replyTo, subject, text, at: new Date().toISOString() });
        if (o.outbox) fs.appendFileSync(o.outbox, line + '\n'); else console.log('[mail]', line);
        return;
      }
      const message = buildMessage({ from: o.from, fromName: o.fromName, to, replyTo, subject, text, html });
      await smtpSend(o, to, message);
    },
  };
}

module.exports = { mailer, buildMessage, smtpSend };
