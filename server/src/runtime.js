'use strict';
// Сборка приложения из настроек окружения.
const { config } = require('./config');
const { createApp } = require('./app');
const { memoryStore } = require('./store/memory');
const { ydbStore } = require('./store/ydb');
const { mailer } = require('./mail');

function fromEnv(env = process.env) {
  const cfg = config(env);
  if (cfg.store !== 'ydb' && cfg.store !== 'memory' && !cfg.store.startsWith('file:')) throw new Error('Unknown STORE');
  const store = cfg.store === 'ydb' ? ydbStore(cfg.ydb) : memoryStore(cfg.store.startsWith('file:') ? cfg.store.slice(5) : null);
  return createApp({ cfg, store, mail: mailer(cfg.mail) });
}

module.exports = { fromEnv };
