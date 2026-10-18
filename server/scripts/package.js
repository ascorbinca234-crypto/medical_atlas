'use strict';
// Собирает dist/function.zip для загрузки в Cloud Functions: код + закрытые части атласов из content/.
// Перед этим соберите атласы (python3 build.py в папках атласов), чтобы content/ был свежим.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const { execFileSync } = require('child_process');
// Rebuild everything: never package a partial or stale content directory.
execFileSync('python3', [path.join(root, '..', 'build.py'), '--full'], { stdio: 'inherit' });
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function files() {
  const out = ['index.js', 'package.json'];
  const walk = d => fs.readdirSync(path.join(root, d)).forEach(f => { const p = d + '/' + f; fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : out.push(p); });
  walk('src');
  for (const atlas of ['farma', 'biochem', 'micro']) {
    const dir = 'content/topics/' + atlas, mp = dir + '/manifest.json';
    const manifest = JSON.parse(fs.readFileSync(path.join(root, mp), 'utf8'));
    if (manifest.policy !== 'topic-delivery-v1' || !Object.keys(manifest.topics || {}).length) throw new Error('Invalid topic manifest: ' + atlas);
    out.push(mp);
    for (const [topic, meta] of Object.entries(manifest.topics)) {
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(topic)) throw new Error('Invalid topic id');
      const file = dir + '/' + topic + '.js';
      const raw = fs.readFileSync(path.join(root, file));
      if (crypto.createHash('sha256').update(raw).digest('hex') !== meta.sha256) throw new Error('Topic hash mismatch: ' + file);
      out.push(file);
    }
  }
  return out;
}
const list = files();
for (const id of ['farma','biochem','micro']) { if (!list.includes('content/topics/' + id + '/manifest.json')) throw new Error('Missing content: ' + id); }
const parts = [], central = [];
let offset = 0;
for (const name of list) {
  const data = fs.readFileSync(path.join(root, name)), comp = zlib.deflateRawSync(data, { level: 9 }), nb = Buffer.from(name);
  const crc = crc32(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nb.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nb.length, 28); cen.writeUInt32LE(offset, 42);
  parts.push(local, nb, comp); central.push(cen, nb);
  offset += 30 + nb.length + comp.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(list.length, 8); end.writeUInt16LE(list.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const zip = Buffer.concat([...parts, cd, end]);
fs.writeFileSync(path.join(root, 'dist', 'function.zip'), zip);
console.log('dist/function.zip', Math.round(zip.length / 1024), 'КБ,', list.length, 'файлов');
