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
  const isMissing = e => /ResourceNotFound/.test(e.type || e.message);
  const now = () => Math.floor(Date.now() / 1000);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let ensured = null;
  /** Создаёт недостающие таблицы (при первом запуске) и ждёт, пока они станут доступны. */
  function ensure() {
    if (ensured) return ensured;
    ensured = (async () => {
      for (const [name, key] of [[T.users, 'id'], [T.identities, 'k'], [T.kv, 'k']]) {
        let exists = true;
        try { await call('DescribeTable', { TableName: name }); } catch (e) { if (isMissing(e)) exists = false; else throw e; }
        if (exists) continue;
        try { await call('CreateTable', { TableName: name, AttributeDefinitions: [{ AttributeName: key, AttributeType: 'S' }], KeySchema: [{ AttributeName: key, KeyType: 'HASH' }] }); }
        catch (e) { if (!/ResourceInUse|already exists/i.test(e.message)) throw e; }
        for (let i = 0; i < 40; i++) {
          try { const d = await call('DescribeTable', { TableName: name }); if (!d.Table || !d.Table.TableStatus || d.Table.TableStatus === 'ACTIVE') break; } catch (e) { if (!isMissing(e)) throw e; }
          await sleep(500);
        }
      }
    })();
    ensured.catch(() => { ensured = null; });
    return ensured;
  }
  // Любая операция: если таблиц ещё нет — создаём и повторяем один раз
  const run = async (op, body) => { try { return await call(op, body); } catch (e) { if (!isMissing(e)) throw e; await ensure(); return call(op, body); } };
  return {
    kind: 'ydb', call, tables: T, ensure,
    async getUser(id) {
      const r = await run('GetItem', { TableName: T.users, Key: { id: { S: id } }, ConsistentRead: true });
      return r.Item && r.Item.d ? JSON.parse(r.Item.d.S) : null;
    },
    async putUser(u) { await run('PutItem', { TableName: T.users, Item: { id: { S: u.id }, d: { S: JSON.stringify(u) } } }); },
    async deleteUser(id) { await run('DeleteItem', { TableName: T.users, Key: { id: { S: id } } }); },
    async getIdentity(k) {
      const r = await run('GetItem', { TableName: T.identities, Key: { k: { S: k } }, ConsistentRead: true });
      return r.Item && r.Item.u ? r.Item.u.S : null;
    },
    async createIdentity(k, uid) {
      try {
        await run('PutItem', { TableName: T.identities, Item: { k: { S: k }, u: { S: uid } }, ConditionExpression: 'attribute_not_exists(k)' });
        return true;
      } catch (e) { if (isCond(e)) return false; throw e; }
    },
    async deleteIdentity(k) { await run('DeleteItem', { TableName: T.identities, Key: { k: { S: k } } }); },
    async incr(k, ttl) {
      // счётчик в окне ttl: ключ включает номер окна, поэтому старые счётчики просто перестают использоваться
      const win = Math.floor(now() / ttl);
      const r = await run('UpdateItem', {
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
        await run('PutItem', { TableName: T.kv, Item: { k: { S: k }, n: { N: '1' }, exp: { N: String(now() + ttl) } }, ConditionExpression: 'attribute_not_exists(k)' });
        return true;
      } catch (e) { if (isCond(e)) return false; throw e; }
    },
    // Документы с версией (прогресс, ординаторская) лежат в таблице users под ключом doc:<имя>.
    // putDoc пишет, только если версия в базе равна v (0 — документа ещё нет), и возвращает false при конфликте.
    async getDoc(k) {
      const r = await run('GetItem', { TableName: T.users, Key: { id: { S: 'doc:' + k } }, ConsistentRead: true });
      return r.Item && r.Item.d ? { d: JSON.parse(r.Item.d.S), v: Number(r.Item.v ? r.Item.v.N : 0) } : null;
    },
    async putDoc(k, d, v) {
      const b = { TableName: T.users, Item: { id: { S: 'doc:' + k }, d: { S: JSON.stringify(d) }, v: { N: String(v + 1) } } };
      if (v === 0) b.ConditionExpression = 'attribute_not_exists(id)';
      else Object.assign(b, { ConditionExpression: '#v = :v', ExpressionAttributeNames: { '#v': 'v' }, ExpressionAttributeValues: { ':v': { N: String(v) } } });
      try { await run('PutItem', b); return true; } catch (e) { if (isCond(e)) return false; throw e; }
    },
    async deleteDoc(k) { await run('DeleteItem', { TableName: T.users, Key: { id: { S: 'doc:' + k } } }); },
  };
}

module.exports = { ydbStore };
