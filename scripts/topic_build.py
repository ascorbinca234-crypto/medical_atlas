"""Compile private source data into independent, integrity-checked topic packages."""
import hashlib, json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
POLICY = 'topic-delivery-v1'
def enc(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
def jsdata(source, expression):
    code = 'const window={};const localStorage={getItem:()=>null};\n' + source + '\nconsole.log(JSON.stringify(' + expression + '));'
    r = subprocess.run(['node', '-'], input=code, text=True, capture_output=True, timeout=30)
    if r.returncode: raise ValueError(r.stderr)
    return json.loads(r.stdout)
def emit(atlas, packages, titles, aliases=None):
    dest = ROOT / 'server/content/topics' / atlas
    dest.mkdir(parents=True, exist_ok=True)
    # Only generated .js files in this subject's dedicated output directory.
    for f in dest.glob('*.js'): f.unlink()
    manifest = {'policy': POLICY, 'topics': {}}
    for tid, code in packages.items():
        assert re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', tid), tid
        raw = code.encode()
        (dest / (tid + '.js')).write_bytes(raw)
        manifest['topics'][tid] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    catalog = {'topics': [{'id': k, 'title': titles[k]} for k in packages], 'aliases': aliases or {}}
    (ROOT / (atlas + '-atlas') / 'topics.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')
    print(atlas + ':', len(packages), 'independent topic packages; largest', max(v['bytes'] for v in manifest['topics'].values()), 'bytes')

def add_package(atlas, tid, title, code):
    dest = ROOT / 'server/content/topics' / atlas
    raw = code.encode()
    (dest / (tid + '.js')).write_bytes(raw)
    mp = dest / 'manifest.json'
    manifest = json.loads(mp.read_text())
    manifest['topics'][tid] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    mp.write_text(json.dumps(manifest, indent=2) + '\n')
    cp = ROOT / (atlas + '-atlas') / 'topics.json'
    catalog = json.loads(cp.read_text())
    catalog['topics'].append({'id': tid, 'title': title})
    cp.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')

def farma(data, body, learn):
    full = jsdata('const VIT_LOCKED='+enc(data['VIT_LOCKED'])+';const VIT_ORDER='+enc(data['VIT_ORDER'])+';\n'+body[:body.index('const VCAT =')], 'VIT')
    # Strip the old embedded all-drug model, including its merge of locked entries.
    bstart, bend = body.index('const VIT ='), body.index('const VCAT =')
    body_template = body[:bstart] + 'const VIT = __TOPIC_VIT__;\n' + body[bend:]
    public_body = body_template.replace('__TOPIC_VIT__', enc(full))
    (ROOT / 'farma-atlas/src/body.js').write_text(public_body)
    packages, titles, aliases = {}, {}, {}
    for item in data['KP'] + data['P']:
        tid = item['id']; titles[tid] = item['title']
        hay = enc(item).lower()
        names = {k for k,d in data['DRUGS'].items() if d.get('p') == tid or any(str(n).lower() in hay for n in [k]+d.get('al',[]) if len(n)>3)}
        # Include prototype dossiers needed to render the selected topic correctly.
        for _ in range(10):
            old = set(names)
            names |= {data['DRUGS'][n]['like'] for n in sorted(names) if data['DRUGS'][n].get('like') in data['DRUGS']}
            if names == old: break
        rxnames = names | {k for k in data['RXD'] if len(k)>3 and k.lower() in hay}
        code = []
        for key in ['P','KP']:
            if any(t['id']==tid for t in data[key]):
                code.append('{const i='+key+'.findIndex(t=>t.id==='+enc(tid)+');if(i>=0)'+key+'[i]='+enc(item)+';}')
        values = {'DRUGS':{n:data['DRUGS'][n] for n in sorted(names)}, 'RXD':{n:data['RXD'][n] for n in sorted(rxnames) if n in data['RXD']},
                  'KALIAS':{k:v for k,v in data['KALIAS'].items() if v in names or v in rxnames}}
        code += ['Object.assign('+k+','+enc(v)+');' for k,v in values.items()]
        code += ['RXAL.push(...'+enc([x for x in data['RXAL'] if x[1] in rxnames])+');']
        code += ['ANTIDOTES.push(...'+enc([x for x in data['ANTIDOTES'] if any(n in enc(x) for n in names)])+');']
        code += ['const DRUGS_ORDER='+enc([n for n in data['DRUGS_ORDER'] if n in names])+';']
        packages[tid] = '\n'.join(code)
    emit('farma', packages, titles, aliases)
    catalog_path = ROOT / 'farma-atlas/topics.json'
    catalog = json.loads(catalog_path.read_text())
    catalog.update(demo=['k-gen', 'k-aff'], publicRoutes=['body', 'drugs'])
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')

def micro(data):
    packages, titles, aliases = {}, {}, {}
    def code(t, ps, qs):
        return ('{const i=TH.findIndex(t=>t.id==='+enc(t['id'])+');if(i>=0)TH[i]='+enc(t)+';}\n' if t else '') + 'PG.push(...'+enc(ps)+');QS.push(...'+enc(qs)+');window.MICRO_FULL=true;'
    for t in data['topics']:
        qs = [q for q in data['questions'] if t['id'] in q['th']]
        ids = {pid for b in t['blocks'] if b['t']=='pg' for pid in b.get('ids',[])} | {pid for q in qs for pid in q['pg']}
        ps = [p for p in data['pathogens'] if p['id'] in ids]
        packages[t['id']] = code(t, ps, qs); titles[t['id']] = t['title']
        aliases['questions/'+t['id']] = t['id']
    for p in data['pathogens']:
        tid = 'pg-'+p['id']; packages[tid] = code(None,[p],[]); titles[tid] = p['n']
        aliases['pathogens/'+p['id']] = tid
    # Any questions not assigned to a topic get their own package, never disappear.
    for q in data['questions']:
        if not q['th']:
            tid='question-'+str(q['no']); packages[tid]=code(None,[p for p in data['pathogens'] if p['id'] in q['pg']],[q]); titles[tid]=q.get('q','Вопрос '+str(q['no']))
    emit('micro', packages, titles, aliases)

def biochem(data, style, markup, app, locked):
    secs = jsdata(app[app.index('const SECS ='):app.index('const SEC =')], 'SECS')
    paths = jsdata(locked[:locked.index('function mountKin')]+app[app.index('const PATHS ='):app.index('function pathIds')], 'PATHS')
    # A function declaration ends with a brace at column zero in these curated sources.
    def fn(source, name):
        match = re.search(r'^function '+name+r'\([^\n]*\{[\s\S]*?^\}', source, re.M)
        if not match: raise ValueError('Missing function '+name)
        return match.group()
    animnames={'etc':'mountETC','kin':'mountKin','hb':'mountHb','box':'mountBox','camp':'mountCamp'}
    animblock=app[app.index('const ANIMS ='):app.index('let anCur =')]
    animations=jsdata('const lnk=(id,n)=>n;'+''.join('function '+name+'(){}\n' for name in animnames.values())+animblock,'ANIMS')
    core=app[:app.index('const PATHS =')]+'const PATHS=__PATHS__;\n'+app[app.index('function pathIds'):]
    core=core.replace(fn(core,'mountETC'),'__ANIM_FUNCTION__')
    core=core[:core.index('const ANIMS =')]+'const ANIMS=__ANIMS__;\n'+core[core.index('let anCur ='):]
    core=core.replace('function setSec(id) { secFilter = id; applyFilter(); }','function setSec(id) { if(id && window.MA_TOPIC!=="sec-"+id){location.hash="topic/sec-"+id;return;} secFilter=id;applyFilter(); }')
    core=core.replace('function renderPath(id, hl) {','function renderPath(id, hl) {\n  if(window.MA_TOPIC!=="path-"+id){location.hash="topic/path-"+id;return;}')
    core=core.replace('function anOpen(id) {','function anOpen(id) {\n  if(window.MA_TOPIC!=="anim-"+id){location.hash="topic/anim-"+id;return;}')
    core=core.replace('renderPath("tca")','renderPath(window.MA_TOPIC.startsWith("path-")?window.MA_TOPIC.slice(5):"tca")')
    allsub=data['substances.json']; byid={s['id']:s for s in allsub}
    packages,titles,aliases={},{},{}
    definitions=[('sec-'+s['id'],s['n'],'sec',s) for s in secs]+[('path-'+p['id'],p['name'],'path',p) for p in paths]+[('anim-'+a['id'],a['name'],'anim',a) for a in animations]
    for tid,title,kind,item in definitions:
        primary={s['id'] for s in allsub if kind=='sec' and s['s']==item['id']}
        if kind=='path':
            p=item
            primary |= {v for r in p.get('flow',[]) for v in r.get('nodes',[])}
            primary |= {n[0] if isinstance(n,list) else n.get('id') for n in p.get('nodes',[])}
            primary |= {n['id'] for n in p.get('ext',[])}
        if kind=='anim':
            primary |= {'nad','succ','atp','bpg23','palm','camp','glc','acoa','fad'} & set(byid)
        primary.discard(None)
        reactions=[r for r in data['reactions.json'] if any(t[1] in primary for t in r['s']+r['p'])] if kind=='sec' else []
        ids=primary | {t[1] for r in reactions for t in r['s']+r['p'] if t[1]} | {i for r in reactions for i in r['x']}
        pack={'substances':[s for s in allsub if s['id'] in ids], 'reactions':reactions,
              'formulas':{k:v for k,v in data['formulas.json'].items() if k in ids},
              'mnemonics':{k:v for k,v in data['mnemonics.json'].items() if k in ids},
              'pairs':[p for p in data['pairs.json'] if p[0] in ids and p[1] in ids], 'locked':None}
        ch=data['cheatsheets.json']
        pack['cheatsheets']={'aa':[[n,[i for i in group if i in ids]] for n,group in ch['aa']],
                            'vit':[r for r in ch['vit'] if r[1] in ids], 'dis':[r for r in ch['dis'] if r[1] in ids]}
        # Keep title-only navigation to other paths/animations; their material is absent.
        ps=[p if kind=='path' and p['id']==item['id'] else {k:p[k] for k in ['id','name','sec']}|{'locked':True} for p in paths]
        anns=[]
        for a in animations:
            value={k:v for k,v in a.items() if k!='desc' or kind=='anim' and a['id']==item['id']}
            text=enc(value)[:-1]+',"mount":'+(animnames[a['id']] if kind=='anim' and a['id']==item['id'] else 'null')+'}'
            anns.append(text)
        func=fn(app if item['id']=='etc' else locked,animnames[item['id']]) if kind=='anim' else ''
        code=core.replace('__PATHS__',enc(ps)).replace('__ANIMS__','['+','.join(anns)+']').replace('__ANIM_FUNCTION__',func)
        if kind=='anim': code=code.replace('let anCur = "etc"','let anCur = '+enc(item['id']))
        end=''
        if kind=='path': end='setView("paths");renderPath('+enc(item['id'])+');'
        if kind=='anim': end='setView("anim");'
        if kind=='sec': end='secFilter='+enc(item['id'])+';applyFilter();'
        pre='document.getElementById("biochem-demo-style")?.remove();document.body.innerHTML='+enc(markup)+';const bxStyle=document.createElement("style");bxStyle.textContent='+enc(style)+';document.head.appendChild(bxStyle);\nconst BX='+enc(pack)+';\n'
        packages[tid]=pre+code+'\n'+end+'\nwindow.MA.mount(document.querySelectorAll("[data-ma-acct]"));'
        titles[tid]=title
    for s in allsub: aliases['s='+s['id']]='sec-'+s['s']
    emit('biochem',packages,titles,aliases)
