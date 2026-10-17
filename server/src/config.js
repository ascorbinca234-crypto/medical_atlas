'use strict';
// Настройки берутся из переменных окружения функции. Полный список — в DEPLOY.md.
const path = require('path');

const trim = s => String(s || '').trim().replace(/\/+$/, '');

function config(e = process.env) {
  const siteUrl = trim(e.SITE_URL);
  const secret = String(e.SECRET || '');
  const c = {
    siteUrl,
    siteOrigin: siteUrl ? new URL(siteUrl).origin : '',
    authPage: siteUrl + '/auth/',
    apiUrl: trim(e.API_URL),
    origins: [siteUrl ? new URL(siteUrl).origin : '', ...String(e.EXTRA_ORIGINS || '').split(',').map(trim)].filter(Boolean),
    secret,
    yandex: {
      clientId: e.YANDEX_CLIENT_ID || '', clientSecret: e.YANDEX_CLIENT_SECRET || '',
      authUrl: e.YANDEX_AUTH_URL || 'https://oauth.yandex.ru/authorize',
      tokenUrl: e.YANDEX_TOKEN_URL || 'https://oauth.yandex.ru/token',
      infoUrl: e.YANDEX_INFO_URL || 'https://login.yandex.ru/info',
    },
    vk: {
      clientId: e.VK_CLIENT_ID || '',
      scope: e.VK_SCOPE || 'vkid.personal_info email',
      authUrl: e.VK_AUTH_URL || 'https://id.vk.ru/authorize',
      tokenUrl: e.VK_TOKEN_URL || 'https://id.vk.ru/oauth2/auth',
      infoUrl: e.VK_INFO_URL || 'https://id.vk.ru/oauth2/user_info',
    },
    store: e.STORE || 'ydb',
    ydb: {
      endpoint: trim(e.YDB_DOCAPI_ENDPOINT),
      accessKeyId: e.YDB_ACCESS_KEY_ID || '',
      secretAccessKey: e.YDB_SECRET_ACCESS_KEY || '',
      prefix: e.TABLE_PREFIX || 'ma_',
    },
    mail: {
      transport: e.MAIL_TRANSPORT || 'smtp',
      host: e.SMTP_HOST || 'smtp.yandex.ru',
      port: Number(e.SMTP_PORT || 465),
      secure: e.SMTP_SECURE !== '0',
      user: e.SMTP_USER || '',
      pass: e.SMTP_PASS || '',
      from: e.MAIL_FROM || e.SMTP_USER || '',
      fromName: e.MAIL_FROM_NAME || 'Медицинский атлас',
      outbox: e.MAIL_OUTBOX || '',
      leadTo: e.LEAD_TO || e.SMTP_USER || '',
    },
    contentDir: e.CONTENT_DIR || path.join(__dirname, '..', 'content'),
    gzip: e.GZIP !== '0',
    accessTtl: Number(e.ACCESS_TTL || 15 * 60),
    refreshTtl: Number(e.REFRESH_TTL || 30 * 24 * 3600),
  };
  const missing = [];
  if (!c.siteUrl) missing.push('SITE_URL');
  if (!c.apiUrl) missing.push('API_URL');
  if (secret.length < 32) missing.push('SECRET (не короче 32 символов)');
  if (c.store === 'ydb' && (!c.ydb.endpoint || !c.ydb.accessKeyId || !c.ydb.secretAccessKey)) missing.push('YDB_DOCAPI_ENDPOINT, YDB_ACCESS_KEY_ID, YDB_SECRET_ACCESS_KEY');
  if (c.mail.transport === 'smtp' && (!c.mail.user || !c.mail.pass)) missing.push('SMTP_USER, SMTP_PASS');
  c.missing = missing;
  return c;
}

module.exports = { config };
