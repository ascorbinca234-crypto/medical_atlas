'use strict';
// Хранилище в YDB Serverless через Document API (протокол DynamoDB). Данные лежат в России, в Яндекс Облаке.
// Таблицы: <prefix>users (id), <prefix>identities (k), <prefix>kv (k). Создаются scripts/create-tables.js.
const { sign } = require('../sigv4');

function ydbStore(o, fetchImpl = fetch) {
  const T = { users: o.prefix + 'users', identities: o.prefix + 'identities', kv: o.prefix + 'kv' };
  async function call(op, body) {
    const payload = JSON.stringify(body);
    const headers = sign({ method: 'POST', url: o.endpoint, headers: { 'Content-Type': 'application/x-amz-json-1.0', 'X-Amz-Target': 'DynamoDB_20120810.' + op }, body: payload },
      { accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey, region: 'ru-central1', service: 'dynamodb' });
    const res = await fetchImpl(o.endpoint, { method: 'POST', headers, body: payload });
    const text = await res.text();
    let j = {};
    try { j = text ? JSON.parse(text) : {}; } catch (e) { j = { message: text }; }
    if (!res.ok) {
      const type = String(j.__type || '').split('#').pop() || 'HTTP' + res.status;
      const err = new Error(`YDB ${op}: ${type}: ${j.message || j.Message || text}`.slice(0, 500));
      err.type = type;
      throw err;
    }
    return j;
  }
  const isCond = e => /ConditionalCheckFailed/.test(e.type || e.message);
  const now = () => Math.floor(Date.now() / 1000);
  return {
    kind: 'ydb', call, tables: T,
    async getUser(id) {
      const r = await call('GetItem', { TableName: T.users, Key: { id: { S: id } }, ConsistentRead: true });
      return r.Item && r.Item.d ? JSON.parse(r.Item.d.S) : null;
    },
    async putUser(u) { await call('PutItem', { TableName: T.users, Item: { id: { S: u.id }, d: { S: JSON.stringify(u) } } }); },
    async deleteUser(id) { await call('DeleteItem', { TableName: T.users, Key: { id: { S: id } } }); },
    async getIdentity(k) {
      const r = await call('GetItem', { TableName: T.identities, Key: { k: { S: k } }, ConsistentRead: true });
      return r.Item && r.Item.u ? r.Item.u.S : null;
    },
    async createIdentity(k, uid) {
      try {
        await call('PutItem', { TableName: T.identities, Item: { k: { S: k }, u: { S: uid } }, ConditionExpression: 'attribute_not_exists(k)' });
        return true;
      } catch (e) { if (isCond(e)) return false; throw e; }
    },
    async deleteIdentity(k) { await call('DeleteItem', { TableName: T.identities, Key: { k: { S: k } } }); },
    async incr(k, ttl) {
      // счётчик в окне ttl: ключ включает номер окна, поэтому старые счётчики просто перестают использоваться
      const win = Math.floor(now() / ttl);
      const r = await call('UpdateItem', {
        TableName: T.kv, Key: { k: { S: k + '#' + win } },
        UpdateExpression: 'ADD #n :one SET #e = :e',
        ExpressionAttributeNames: { '#n': 'n', '#e': 'exp' },
        ExpressionAttributeValues: { ':one': { N: '1' }, ':e': { N: String((win + 1) * ttl) } },
        ReturnValues: 'ALL_NEW',
      });
      return Number(r.Attributes && r.Attributes.n ? r.Attributes.n.N : 1);
    },
    async once(k, ttl) {
      try {
        await call('PutItem', { TableName: T.kv, Item: { k: { S: k }, n: { N: '1' }, exp: { N: String(now() + ttl) } }, ConditionExpression: 'attribute_not_exists(k)' });
        return true;
      } catch (e) { if (isCond(e)) return false; throw e; }
    },
  };
}

module.exports = { ydbStore };
