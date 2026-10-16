'use strict';
// Тексты писем.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(title, body, button, link, after) {
  return `<!doctype html><html lang="ru"><body style="margin:0;background:#f4f3f8;font-family:Arial,Helvetica,sans-serif;color:#1c1730">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #d8d4e3;border-radius:8px">
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#4a3a8c">Медицинский атлас</td></tr>
<tr><td style="padding:0 28px;font-size:22px;line-height:1.3;font-weight:bold">${esc(title)}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:16px;line-height:1.55;color:#3c3550">${body}</td></tr>
<tr><td style="padding:24px 28px"><a href="${esc(link)}" style="display:inline-block;background:#4a3a8c;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">${esc(button)}</a></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#6b6480">${after}<br><br>Если кнопка не работает, скопируйте ссылку в браузер:<br><span style="word-break:break-all">${esc(link)}</span></td></tr>
</table></td></tr></table></body></html>`;
}

function verifyEmail(name, link) {
  const hi = name ? `Здравствуйте, ${esc(name)}!` : 'Здравствуйте!';
  return {
    subject: 'Подтвердите почту — Медицинский атлас',
    text: `${name ? 'Здравствуйте, ' + name + '!' : 'Здравствуйте!'}\n\nЧтобы закончить регистрацию в Медицинском атласе, откройте ссылку:\n${link}\n\nСсылка действует 24 часа. Если вы не регистрировались, просто удалите это письмо.`,
    html: layout('Подтвердите почту', `${hi}<br>Чтобы закончить регистрацию и открыть все темы атласов, подтвердите адрес почты.`, 'Подтвердить почту', link, 'Ссылка действует 24 часа. Если вы не регистрировались, просто удалите это письмо.'),
  };
}

function resetEmail(link) {
  return {
    subject: 'Восстановление пароля — Медицинский атлас',
    text: `Здравствуйте!\n\nЧтобы задать новый пароль, откройте ссылку:\n${link}\n\nСсылка действует 1 час. Если вы не запрашивали восстановление, ничего делать не нужно: пароль останется прежним.`,
    html: layout('Новый пароль', 'Здравствуйте!<br>Кто-то, возможно вы, запросил восстановление пароля. Чтобы задать новый пароль, нажмите кнопку.', 'Задать новый пароль', link, 'Ссылка действует 1 час. Если вы не запрашивали восстановление, ничего делать не нужно: пароль останется прежним.'),
  };
}

module.exports = { verifyEmail, resetEmail };
