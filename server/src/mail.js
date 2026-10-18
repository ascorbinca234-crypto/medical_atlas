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
    let buf = '', step = 0, done = false;
    const deadline = setTimeout(() => fail('истекло время отправки'), o.timeoutMs || 20000);
    sock.setTimeout(o.idleTimeoutMs || 12000, () => fail('сервер не отвечает'));
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
    const fail = msg => { if (!done) { done = true; clearTimeout(deadline); sock.destroy(); reject(new Error('SMTP: ' + msg)); } };
    sock.on('error', e => fail(e.message));
    sock.on('end', () => fail('соединение закрыто до подтверждения письма'));
    sock.on('close', () => fail('соединение закрыто до подтверждения письма'));
    sock.on('data', chunk => {
      if (done) return;
      buf += chunk;
      if (buf.length > 65536) return fail('слишком большой ответ');
      while (true) {
        const lines = buf.split('\r\n');
        const endIdx = lines.findIndex((l, i) => i < lines.length - 1 && /^\d{3} /.test(l));
        if (endIdx < 0) return;                              // ответ ещё не дочитан
        const code = Number(lines[endIdx].slice(0, 3));
        const text = lines.slice(0, endIdx + 1).join(' | ');
        buf = lines.slice(endIdx + 1).join('\r\n');
        const [want, next] = steps[step];
        if (code !== want) {
          const hint = code === 535 ? 'почта не приняла логин или пароль приложения (SMTP_USER, SMTP_PASS)'
            : /^55\d$/.test(String(code)) ? 'почтовый сервер отклонил письмо' : `ожидался ${want}`;
          return fail(`${hint}; ответ «${text.slice(0, 200)}»`);
        }
        step++;
        // 250 after DATA confirms delivery. QUIT is cleanup, not another delivery acknowledgement.
        if (step === 9) {
          done = true; clearTimeout(deadline);
          // Give the peer time to acknowledge QUIT, but never keep an accepted message pending.
          const cleanup = setTimeout(() => sock.destroy(), 1000);
          sock.once('close', () => clearTimeout(cleanup));
          sock.end('QUIT\r\n'); return resolve();
        }
        if (!next) { done = true; clearTimeout(deadline); sock.end(); return resolve(); }
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
