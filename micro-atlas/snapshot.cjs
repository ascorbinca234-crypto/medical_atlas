'use strict';
// Evaluate author modules without filesystem, network, process or application UI access.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto');
const dir = process.argv[2], manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
if (manifest.version !== 8 || manifest.modules.length < 87) throw new Error('Incomplete v8 source manifest');
for (const name of manifest.modules) {
 if (!/^[a-z0-9_]+\.js$/.test(name)) throw new Error('Invalid source name');
 const raw=fs.readFileSync(path.join(dir,name));
 if (crypto.createHash('sha256').update(raw).digest('hex') !== manifest.module_sha256?.[name]) throw new Error('Source integrity failure: '+name);
}
const ctx = vm.createContext({console:{warn(){}}, window:{}, document:{addEventListener(){}},
  localStorage:{getItem:()=>null}, addEventListener(){}, matchMedia:()=>({matches:true,addEventListener(){}})});
vm.runInContext(`function encode(v){
 if(typeof v==='function'){const s=v.toString();return /^[a-zA-Z_$][\\w$]*\\s*\\(/.test(s)&&!s.startsWith('function')?'function '+s:s;}
 if(Array.isArray(v))return '['+v.map(encode).join(',')+']';
 if(v&&typeof v==='object')return '{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+':'+encode(x)).join(',')+'}';
 return JSON.stringify(v)??'undefined';
}`,ctx);
const modules = manifest.modules.filter(n=>!n.startsWith('pp_')&&! ['app.js','v7_app.js','anim_catalog.js'].includes(n));
for (const name of modules) vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),ctx,{timeout:10000,filename:name});
const snapshot = vm.runInContext(`({topics:TH,pathogens:PG,questions:QS,figures:FIG,photos:PH,clusters:ZS,chapters:ZTX,
 animations:AN_LIST.filter(a=>a.group!=='abxmap').map(a=>({id:a.id,title:a.title,short:a.short,topic:a.topic,replaces:a.replaces,group:a.group,code:'AN('+encode(a)+');'})),drugIndex:ABX_DRUGS.map(d=>({id:d.id,ru:d.ru})),drugs:ABX_DRUGS.length,classes:ABX_CLASSES.length})`,ctx,{timeout:10000});
process.stdout.write(JSON.stringify(snapshot));
