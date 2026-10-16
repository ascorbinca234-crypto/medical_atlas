'use strict';
// Вход через Яндекс ID и VK ID: authorization code + PKCE (S256).
const crypto = require('crypto');
const { b64u } = require('./tokens');

const pkce = () => { const verifier = b64u(crypto.randomBytes(48)); return { verifier, challenge: b64u(crypto.createHash('sha256').update(verifier).digest()) }; };

async function readJson(res, what) {
  const text = await res.text();
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error(`${what}: ответ не JSON (HTTP ${res.status})`); }
  if (!res.ok || j.error) throw new Error(`${what}: ${j.error_description || j.error || 'HTTP ' + res.status}`);
  return j;
}

function providers(cfg, fetchImpl = fetch) {
  const redirect = p => cfg.apiUrl + '/auth/' + p + '/callback';
  return {
    yandex: {
      enabled: !!(cfg.yandex.clientId && cfg.yandex.clientSecret),
      authorizeUrl({ state, challenge }) {
        const q = new URLSearchParams({ response_type: 'code', client_id: cfg.yandex.clientId, redirect_uri: redirect('yandex'), state, code_challenge: challenge, code_challenge_method: 'S256', force_confirm: 'no' });
        return cfg.yandex.authUrl + '?' + q;
      },
      async profile(query, st) {
        if (query.error) throw Object.assign(new Error(query.error), { userCancel: query.error === 'access_denied' });
        const tok = await readJson(await fetchImpl(cfg.yandex.tokenUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code: query.code || '', client_id: cfg.yandex.clientId, client_secret: cfg.yandex.clientSecret, code_verifier: st.v }),
        }), 'Яндекс, обмен кода');
        const info = await readJson(await fetchImpl(cfg.yandex.infoUrl + '?format=json', { headers: { Authorization: 'OAuth ' + tok.access_token } }), 'Яндекс, профиль');
        const name = info.display_name || [info.first_name, info.last_name].filter(Boolean).join(' ') || info.login || '';
        return {
          id: String(info.id), name,
          email: info.default_email ? String(info.default_email).toLowerCase() : null,
          avatar: info.default_avatar_id && !info.is_avatar_empty ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-68` : null,
        };
      },
    },
    vk: {
      enabled: !!cfg.vk.clientId,
      authorizeUrl({ state, challenge }) {
        const q = new URLSearchParams({ response_type: 'code', client_id: cfg.vk.clientId, redirect_uri: redirect('vk'), state, code_challenge: challenge, code_challenge_method: 'S256', scope: 'vkid.personal_info email' });
        return cfg.vk.authUrl + '?' + q;
      },
      async profile(query, st) {
        // VK ID может прислать параметры по отдельности или одним JSON в payload
        let q = Object.assign({}, query);
        if (q.payload) { try { q = Object.assign(q, JSON.parse(q.payload)); } catch (e) { /* оставим как есть */ } }
        if (q.error) throw Object.assign(new Error(q.error), { userCancel: /denied|cancel/i.test(q.error) });
        const tok = await readJson(await fetchImpl(cfg.vk.tokenUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code: q.code || '', code_verifier: st.v, client_id: cfg.vk.clientId, device_id: q.device_id || '', redirect_uri: redirect('vk'), state: q.state || '' }),
        }), 'VK ID, обмен кода');
        const info = await readJson(await fetchImpl(cfg.vk.infoUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: cfg.vk.clientId, access_token: tok.access_token }),
        }), 'VK ID, профиль');
        const u = info.user || {};
        return {
          id: String(u.user_id || tok.user_id), name: [u.first_name, u.last_name].filter(Boolean).join(' '),
          email: u.email ? String(u.email).toLowerCase() : null, avatar: u.avatar || null,
        };
      },
    },
  };
}

module.exports = { providers, pkce };
