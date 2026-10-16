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

function verifyEmail(name, link, code) {
  const hi = name ? `Здравствуйте, ${esc(name)}!` : 'Здравствуйте!';
  const pretty = code.slice(0, 3) + ' ' + code.slice(3);
  return {
    subject: `Код ${pretty} — подтвердите почту в Медицинском атласе`,
    text: `${name ? 'Здравствуйте, ' + name + '!' : 'Здравствуйте!'}\n\nВаш код подтверждения: ${pretty}\nВведите его на странице регистрации или просто откройте ссылку:\n${link}\n\nКод и ссылка действуют 24 часа. Если вы не регистрировались, просто удалите это письмо.`,
    html: layout('Подтвердите почту', `${hi}<br>Введите этот код на странице регистрации:<div style="margin:16px 0 4px;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:bold;letter-spacing:6px;color:#1c1730">${pretty}</div>или нажмите кнопку — почта подтвердится сама.`, 'Подтвердить почту', link, 'Код и ссылка действуют 24 часа. Если вы не регистрировались, просто удалите это письмо.'),
  };
}

function resetEmail(link) {
  return {
    subject: 'Восстановление пароля — Медицинский атлас',
    text: `Здравствуйте!\n\nЧтобы задать новый пароль, откройте ссылку:\n${link}\n\nСсылка действует 1 час. Если вы не запрашивали восстановление, ничего делать не нужно: пароль останется прежним.`,
    html: layout('Новый пароль', 'Здравствуйте!<br>Кто-то, возможно вы, запросил восстановление пароля. Чтобы задать новый пароль, нажмите кнопку.', 'Задать новый пароль', link, 'Ссылка действует 1 час. Если вы не запрашивали восстановление, ничего делать не нужно: пароль останется прежним.'),
  };
}

function leadEmail({ name, contact, role, message, page }) {
  const rows = [['Имя', name], ['Контакт', contact], ['Кто', role || '—'], ['Сообщение', message || '—'], ['Страница', page || '—']];
  return {
    subject: `Заявка преподавателя: ${name}`,
    text: 'Новая заявка с сайта «Медицинский атлас»\n\n' + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nЕсли контакт — почта, просто ответьте на это письмо.',
    html: `<!doctype html><html lang="ru"><body style="font-family:Arial,Helvetica,sans-serif;color:#1c1730"><h2 style="margin:0 0 12px">Заявка преподавателя</h2><table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#6b6480;vertical-align:top">${esc(k)}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table><p style="color:#6b6480">Если контакт — почта, просто ответьте на это письмо.</p></body></html>`,
  };
}

module.exports = { verifyEmail, resetEmail, leadEmail };
