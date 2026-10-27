import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';
import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { analyze, DEMO } from './source.mjs';
const root = path.dirname(fileURLToPath(import.meta.url)), repo = path.dirname(root);
const enc = x => JSON.stringify(x).replaceAll('<', '\\u003c');
const source = fs.readFileSync(path.join(root, 'src/PathoAtlas.jsx'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/catalog.json')));
let classSource = '';
if (process.argv.includes('--full')) {
  const privateRoot = process.env.ATLAS_PRIVATE || path.join(repo, '..', 'medical_atlas_private');
  const original = fs.readFileSync(path.join(privateRoot, 'pathophys-atlas/PathoAtlas.jsx'), 'utf8');
  const atlas = analyze(original), publicAtlas = analyze(source, false);
  if (atlas.topics.length !== 28 || new Set(atlas.topics.map(t => t.id)).size !== 28) throw new Error('Expected 28 unique topics');
  if (JSON.stringify(atlas.topics.map(t => t.id)) !== JSON.stringify(catalog.map(t => t.id))) throw new Error('Private/public catalog mismatch');
  for (const id of DEMO) {
    const actual = publicAtlas.topics.find(t => t.id === id), expected = atlas.topics.find(t => t.id === id);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Demo differs from private source: ' + id);
  }
  const dest = path.join(repo, 'server/content/topics/pathophys'); fs.mkdirSync(dest, { recursive: true });
  const manifest = { policy: 'topic-delivery-v1', topics: {} };
  for (const topic of atlas.topics) {
    const visual = atlas.visuals.get(topic.id);
    const helpers = atlas.closure([...visual.names]);
    if (helpers.some(d => /^T_|^TOPIC/.test(d.name))) throw new Error('Visual depends on other lesson data');
    const code = `window.MA_PATHO_TOPIC={topic:${enc(topic)},expert:${enc(atlas.experts[topic.id] || null)},makeVisuals(runtime){const {${atlas.bindings.join(',')}}=runtime;\n${helpers.map(d => d.text).join('\n')}\nreturn ${visual.text};}};`;
    const compiled = (await transform(code, { loader: 'jsx', minify: true, target: 'es2020', charset: 'utf8' })).code;
    fs.writeFileSync(path.join(dest, topic.id + '.js'), compiled);
    manifest.topics[topic.id] = { sha256: crypto.createHash('sha256').update(compiled).digest('hex'), bytes: Buffer.byteLength(compiled) };
  }
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  // Store only class names from private diagrams; their labels/data never enter the public files.
  classSource += '\n' + [...original.matchAll(/className="([^"]*)"/g)].map(m => m[1]).join(' ');
}
const result = await build({ entryPoints: [path.join(root, 'src/main.jsx')], bundle: true, write: false, minify: true, target: 'es2020', charset: 'utf8', define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'inline' });
// A committed safelist keeps public and full builds identical.
const safelistPath = path.join(root, 'src/classes.txt');
if (process.argv.includes('--full')) fs.writeFileSync(safelistPath, [...new Set(classSource.split(/[\s"'`<>=]+/).filter(t => t && t.length < 150))].sort().join('\n') + '\n');
const require = createRequire(import.meta.url);
const twDir = path.resolve(path.dirname(require.resolve('tailwindcss')), '..');
const loadStylesheet = async (id, base) => {
  const file = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id);
  return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
};
const compiler = await compile('@import "tailwindcss";', { base: root, loadStylesheet });
const candidates = [...new Set((source + '\n' + fs.readFileSync(safelistPath, 'utf8')).split(/[\s"'`<>=]+/).filter(t => t && t.length < 150))];
const css = compiler.build(candidates);
const template = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.writeFileSync(path.join(root, 'index.html'), template.replace('/*CATALOG*/', () => enc(JSON.parse(fs.readFileSync(path.join(root, 'topics.json'))))).replace('/*CSS*/', () => css).replace('/*APP*/', () => js));
console.log('Pathophysiology: 28 topics, two public lessons' + (process.argv.includes('--full') ? ', 28 protected packages' : ''));
