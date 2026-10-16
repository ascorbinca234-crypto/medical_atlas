'use strict';
const test = require('node:test'), assert = require('node:assert');
const { sign } = require('../src/sigv4');
const KEY = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', date: new Date('2015-08-30T12:36:00Z') };
const sig = h => h.Authorization.split('Signature=')[1];

test('пример IAM ListUsers из документации AWS', () => {
  const h = sign({ method: 'GET', url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }, body: '' },
    Object.assign({ region: 'us-east-1', service: 'iam' }, KEY));
  assert.strictEqual(sig(h), '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
});
test('get-vanilla из набора тестов SigV4', () => {
  const h = sign({ method: 'GET', url: 'https://example.amazonaws.com/', headers: {}, body: '' }, Object.assign({ region: 'us-east-1', service: 'service' }, KEY));
  assert.strictEqual(sig(h), '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
});
