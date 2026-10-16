'use strict';
// Создаёт таблицы в YDB Serverless (Document API). Запуск один раз:
//   YDB_DOCAPI_ENDPOINT=... YDB_ACCESS_KEY_ID=... YDB_SECRET_ACCESS_KEY=... node scripts/create-tables.js
const { ydbStore } = require('../src/store/ydb');
const env = process.env;
const s = ydbStore({ endpoint: (env.YDB_DOCAPI_ENDPOINT || '').replace(/\/+$/, ''), accessKeyId: env.YDB_ACCESS_KEY_ID, secretAccessKey: env.YDB_SECRET_ACCESS_KEY, prefix: env.TABLE_PREFIX || 'ma_' });
if (!env.YDB_DOCAPI_ENDPOINT || !env.YDB_ACCESS_KEY_ID || !env.YDB_SECRET_ACCESS_KEY) { console.error('Задайте YDB_DOCAPI_ENDPOINT, YDB_ACCESS_KEY_ID и YDB_SECRET_ACCESS_KEY.'); process.exit(1); }
(async () => {
  for (const [name, key] of [[s.tables.users, 'id'], [s.tables.identities, 'k'], [s.tables.kv, 'k']]) {
    try {
      await s.call('CreateTable', { TableName: name, AttributeDefinitions: [{ AttributeName: key, AttributeType: 'S' }], KeySchema: [{ AttributeName: key, KeyType: 'HASH' }] });
      console.log('создана таблица', name);
    } catch (e) {
      if (/ResourceInUse|already exists/i.test(e.message)) console.log('таблица уже есть', name); else { console.error(e.message); process.exit(1); }
    }
  }
  console.log('Готово.');
})();
