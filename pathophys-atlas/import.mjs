// One-time import: node import.mjs /path/to/PathoAtlas.jsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, DEMO } from './source.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const atlas = analyze(fs.readFileSync(process.argv[2], 'utf8'));
const catalog = atlas.topics.map(t => Object.fromEntries(['id', 'section', 'cluster', 'icon', 'title', 'short'].filter(k => k in t).map(k => [k, t[k]])));
const excluded = new Set(['TOPICS', 'TOPIC_MAP', 'VISUALS', 'EXPERT', 'EXPERT_A', 'EXPERT_B', 'EXPERT_C', ...[...atlas.declarations.keys()].filter(n => /^T_/.test(n) && !['T_DISEASE', 'T_PATHOGEN'].includes(n))]);
const roots = ['CSS', 'VIZ_CSS', 'T_DISEASE', 'T_PATHOGEN', 'Terminal', 'CausalGraph', 'BodyMap', ...[...atlas.declarations].filter(([, d]) => d.node.start >= atlas.declarations.get('VisualTab').node.start).map(([n]) => n)];
const selected = atlas.closure(roots, excluded);
const pre = atlas.imports.join('\n') + '\nimport catalog from "./catalog.json";\n';
const registry = `
const TOPICS = catalog.map(t => ({...t, locked:true, tags:[], definition:'', classification:[], etiology:[], signs:[], flows:[], sanogenesis:[], circles:[], traps:[], quiz:[], tables:[]}));
for(const topic of [T_DISEASE,T_PATHOGEN,window.MA_PATHO_TOPIC?.topic].filter(Boolean)){const i=TOPICS.findIndex(t=>t.id===topic.id);if(i>=0)TOPICS[i]=topic;}
const TOPIC_MAP=Object.fromEntries(TOPICS.map(t=>[t.id,t]));
const EXPERT=${JSON.stringify(Object.fromEntries(DEMO.map(id=>[id,atlas.experts[id]])))};
if(window.MA_PATHO_TOPIC?.expert)EXPERT[window.MA_PATHO_TOPIC.topic.id]=window.MA_PATHO_TOPIC.expert;
const SUBJECT_ACCESS=!!window.MA?.hasAtlasAccess('pathophys');
const VISUALS={disease:[Terminal],pathogenesis:[CausalGraph]};
if(window.MA_PATHO_TOPIC)VISUALS[window.MA_PATHO_TOPIC.topic.id]=window.MA_PATHO_TOPIC.makeVisuals({${atlas.bindings.join(',')}});
`;
// The registry must precede the search and exam indexes, but follow its demo declarations.
const chunks = selected.map(d => {
  if(d.name==='PathoAtlas')return fs.readFileSync(path.join(root,'src/app-shell.jsx'),'utf8');
  let text=d.text;
  if(d.name==='buildTheory')text=text.replace('function buildTheory(topic) {','function buildTheory(topic) {\n  if(topic.locked)return [];');
  if(d.name==='Sidebar')text=text.replace('<TopicIcon name={t.icon} size={16} />', '{t.locked&&!SUBJECT_ACCESS?<Lock size={16} aria-label="По подписке"/>:<TopicIcon name={t.icon} size={16} />}');
  if(d.name==='RunView'){
    text=text.replaceAll('TOPICS.map((t) => t.id)','TOPICS.filter(t=>!t.locked).map((t) => t.id)').replaceAll('sel.size === TOPICS.length','sel.size === TOPICS.filter(t=>!t.locked).length').replaceAll('t.section === sec.id).map','t.section === sec.id && !t.locked).map');
    text=text.replace('onClick={() => toggle(t.id)} aria-pressed={on}','onClick={() => toggle(t.id)} disabled={t.locked} title={t.locked?\"Откройте тему, чтобы загрузить задания\":undefined} aria-pressed={on}');
  }
  text=text.replace('const answer = (good) => {','const answer = (good) => { window.MAP?.card({atlas:\'pathophys\',ok:good});');
  if(d.name==='BlitzTab'){
    text=text.replace('onClick={() => setGrade((g) => ({ ...g, [i]: true }))}',"onClick={() => {window.MAP?.card({atlas:'pathophys',ok:true});setGrade((g) => ({ ...g, [i]: true }));}}");
    text=text.replace('onClick={() => setGrade((g) => ({ ...g, [i]: false }))}',"onClick={() => {window.MAP?.card({atlas:'pathophys',ok:false});setGrade((g) => ({ ...g, [i]: false }));}}");
  }
  return text;
});
const at = selected.findIndex(d => d.name === 'VisualTab');
chunks.splice(at, 0, registry);
fs.writeFileSync(path.join(root, 'src/PathoAtlas.jsx'), pre + chunks.join('\n\n') + '\nexport default PathoAtlas;\n');
fs.writeFileSync(path.join(root, 'src/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'topics.json'), JSON.stringify({ topics: catalog.map(({ id, title }) => ({ id, title })), aliases: {}, demo: DEMO }, null, 2) + '\n');
console.log('Imported two public lessons and title-only catalog:', catalog.length, 'topics');
