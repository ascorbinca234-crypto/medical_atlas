"""Compile the v8 atlas into a public demo and separately authorized materials."""
import json, re, subprocess
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import topic_build

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
DEMO = ['g1', 'g2']
PAGE_SIZE = 12
enc = topic_build.enc

def build(private):
    r = subprocess.run(['node', str(ROOT/'snapshot.cjs'), str(private)], capture_output=True, text=True, timeout=60)
    if r.returncode: raise SystemExit(r.stderr)
    data = json.loads(r.stdout)
    topics, pathogens, questions = data['topics'], data['pathogens'], data['questions']
    tids = {t['id'] for t in topics}; pids = {p['id'] for p in pathogens}
    if len(tids) != len(topics) or len(pids) != len(pathogens): raise ValueError('Duplicate source IDs')
    if len(topics) != 29 or len(data['clusters']) != 7 or len(questions) != 440: raise ValueError('Incomplete v8 source')
    qids = {(q['src'], q['blk'], q['no']) for q in questions}
    if len(qids) != len(questions): raise ValueError('Duplicate question IDs')
    for q in questions:
        if not set(q['th']) <= tids or not set(q['pg']) <= pids: raise ValueError('Broken question reference')
    for z in data['clusters']:
        if not set(z['topics']) <= tids: raise ValueError('Broken cluster reference')
    byid = {t['id']: t for t in topics}
    order = [tid for z in data['clusters'] for tid in z['topics']]
    if len(order) != len(set(order)) or set(order) != tids: raise ValueError('Incomplete cluster order')
    for i, tid in enumerate(order): byid[tid]['no'] = i+1
    animations = {a['id']: a for a in data['animations']}

    # Drawing helpers have no registrations or teaching text. Scene definitions stay in their own packages.
    helpers = '\n'.join((private/n).read_text().split('\nAN({',1)[0] for n in ['anims_gen4.js','anims_vir.js'])
    runtime = '\n'.join((private/n).read_text() for n in ['figs_lib.js','anim_core.js','anim_lib.js']) + '\n' + helpers + '\n'
    runtime += '\n'.join((private/n).read_text() for n in ['anim_catalog.js','v7_app.js'])
    runtime=runtime.replace('const nA = AN_LIST.filter(a => !a.hidden).length;', 'const nA = MICRO_CATALOG.animations.length+15;')
    runtime=runtime.replace("const nD = typeof ABX_DRUGS !== 'undefined' ? ABX_DRUGS.length : 0;", 'const nD = MICRO_CATALOG.drugs;')
    runtime=runtime.replace("const nC = typeof ABX_CLASSES !== 'undefined' ? ABX_CLASSES.length : 0;", 'const nC = MICRO_CATALOG.classes;')
    runtime += '\n' + (SRC/'prep-shell.js').read_text()
    (SRC/'runtime.js').write_text(runtime.rstrip()+'\n')
    (SRC/'core.js').write_text((private/'core.js').read_text().rstrip()+'\n')
    style=(private/'style.css').read_text()
    # Author's .ap-big selector was shared by an expand button and the full-size player.
    for suffix in ['{',' svg',':hover',':focus-visible']:
        style=style.replace('.ap-big'+suffix,'button.ap-big'+suffix)
    (SRC/'style.css').write_text(style.rstrip()+'\n')

    def refs(items):
        figures, photos, ps = set(), set(), set()
        def visit(x):
            if isinstance(x, list):
                for v in x: visit(v)
            elif isinstance(x, dict):
                kind = x.get('t')
                if kind == 'fig': figures.add(x['id'])
                if kind == 'figs': figures.update(x.get('ids',[]))
                if kind == 'photos': photos.update(x.get('ids',[]))
                if kind == 'pg': ps.update(x.get('ids',[]))
                for v in x.values():
                    if isinstance(v,(dict,list)): visit(v)
        visit(items)
        if not figures <= data['figures'].keys(): raise ValueError('Missing figure: '+str(figures-data['figures'].keys()))
        if not photos <= {p['id'] for p in data['photos']}: raise ValueError('Missing photograph')
        if not ps <= pids: raise ValueError('Missing pathogen')
        return figures, photos, ps

    def payload(ts=(), chapters=None, ps=(), qs=(), figures=(), photos=(), anims=(), full=True, dossiers=True, pictures=True, dossier_photos=False):
        chapters = chapters or {}
        fs, phs, pat = refs(list(ts)+list(chapters.values()))
        fs.update(figures); phs.update(photos); pat.update(ps)
        if qs: pat.update(pid for q in qs for pid in q['pg'])
        if not dossiers: pat.clear()
        # Pictures attached to dossiers are included, with their original author/source/license captions.
        if pictures and dossier_photos: phs.update(p['id'] for p in data['photos'] if set(p.get('pg',[])) & pat)
        if not pictures: phs.clear()
        selected_anims = set(anims) | {a['id'] for a in animations.values() if set(([a['replaces']] if isinstance(a.get('replaces'),str) else a.get('replaces') or [])) & fs}
        code = ['PH.length=0;'] if full else []
        for t in ts: code.append('{const i=TH.findIndex(t=>t.id==='+enc(t['id'])+');if(i>=0)TH[i]='+enc(t)+';else TH.push('+enc(t)+');}')
        code += ['Object.assign(ZTX,'+enc(chapters)+');', 'Object.assign(FIG,'+enc({k:data['figures'][k] for k in sorted(fs)})+');',
                 'PG.push(...'+enc([p for p in pathogens if p['id'] in pat])+');',
                 'PH.push(...'+enc([p for p in data['photos'] if p['id'] in phs])+');', 'QS.push(...'+enc(qs)+');']
        code += [animations[k]['code'] for k in sorted(selected_anims)]
        if full: code.append('window.MICRO_FULL=true;')
        return '\n'.join(code)

    # Demo chapters, figures and photos are limited to the two public lessons.
    demo = [byid[k] for k in DEMO]
    demo_chapters = {k:v for k,v in data['chapters'].items() if k in DEMO}
    demo_code = payload(demo,demo_chapters,full=False,dossiers=False)
    (SRC/'demo.js').write_text(demo_code)
    for tid,name in [('g1','g01_morph.js'),('g2','g02_phys.js')]: (SRC/name).write_text('T('+enc(byid[tid])+');\n')
    catalog = {'version':8,'demo':DEMO,'topics':[{k:t[k] for k in ['id','blk','no','title','short']} for t in topics],
               'clusters':data['clusters'], 'pathogens':len(pathogens),'questions':len(questions),'photos':len(data['photos']),
               'figures':len(data['figures']),'drugs':data['drugs'],'classes':data['classes'],
               'drugIndex':data['drugIndex'], 'questionCounts':{s:sum(q['src']==s for q in questions) for s in ['dent','spb']},
               'completePathogens':sum(all(p.get(k) for k in ['morph','phys','cult','eco','epi','vir','dis','dx','rx']) for p in pathogens),
               'animations':[{k:v for k,v in a.items() if k!='code'} for a in animations.values()],
               'pathogenIndex':[{k:p[k] for k in ['id','n','ru','grp','gr','tags','sum'] if k in p} for p in pathogens],
               'photoPages':(len(data['photos'])+PAGE_SIZE-1)//PAGE_SIZE}
    (SRC/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
    packages, titles, aliases = {}, {}, {}
    for t in topics:
        qs = [q for q in questions if t['id'] in q['th']]
        packages[t['id']] = payload([t],{t['id']:data['chapters'][t['id']]} if t['id'] in data['chapters'] else {},qs=qs)
        titles[t['id']] = t['title']; aliases['questions/'+t['id']] = 'questions'
    for z in data['clusters']:
        chapters={tid:data['chapters'][tid] for tid in z['topics'] if tid in data['chapters']}
        qs=[q for q in questions if set(q['th']) & set(z['topics'])]
        packages[z['id']] = payload(chapters=chapters, qs=qs)
        titles[z['id']] = 'Зачёт '+str(z['no'])+'. '+z['title']; aliases['questions/'+z['id']] = 'questions'
        for tid in z['topics']: aliases[z['id']+'/'+tid] = z['id']
    for p in pathogens:
        tid='pg-'+p['id']; packages[tid]=payload(ps=[p['id']],dossier_photos=True); titles[tid]=p['n']; aliases['pathogens/'+p['id']]=tid
    packages['questions']=payload(qs=questions,pictures=False); titles['questions']='Вопросы экзамена · оба набора'
    # Questions/flashcards need dossiers but no full photograph collection.
    packages['learn-pg']=payload(ps=pids,pictures=False); titles['learn-pg']='Тренажёр возбудителей'; aliases['learn']='learn-pg'; aliases['learn/pg']='learn-pg'
    for page,start in enumerate(range(0,len(data['photos']),PAGE_SIZE),1):
        pics=data['photos'][start:start+PAGE_SIZE]
        # Keep only this page's pictures, including dossiers necessary for its training answers.
        code=payload(ps={pid for p in pics for pid in p.get('pg',[])},pictures=False)
        code += '\nPH.push(...'+enc(pics)+');'
        tid='gallery-'+str(page); packages[tid]=code; titles[tid]='Микропрепараты · страница '+str(page)
        aliases['gallery/'+str(page)]=tid; aliases['learn/ph/'+str(page)]=tid
    aliases['gallery']='gallery-1'; aliases['learn/ph']='gallery-1'
    for a in animations.values():
        tid='anim-'+a['id']; figures=[f for f in ([a['replaces']] if isinstance(a.get('replaces'),str) else a.get('replaces') or []) if f in data['figures']]
        packages[tid]=payload(figures=figures,anims=[a['id']]); titles[tid]=a['title']; aliases['anim/'+a['id']]=tid
    abx='\n'.join((private/n).read_text() for n in ['abx_res.js','abx_data.js','abx_data2.js','abx_scene.js','abx_kits.js','abx_kits2.js','abx_anim.js','abx_ui.js'])
    packages['abx']=abx+'\nwindow.MICRO_FULL=true;'; titles['abx']='Интерактивная карта антибиотиков'
    aliases.update({'abx/'+d['id']:'abx' for d in data['drugIndex']})
    # The animation catalogue includes the original fifteen antibiotic examples.
    aliases.update({'anim/abx-'+tid:'abx' for tid in ['ceftriaxone','vancomycin','fosfomycin','colistin','daptomycin','gentamicin','doxycycline','azithromycin','linezolid','ciprofloxacin','rifampicin','cotrimoxazole','metronidazole','isoniazid','bedaquiline']})
    # Study needs a course-wide exercise registry. Image bytes remain independent
    # authorized resources; lecture routes retain their original per-topic delivery.
    placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="260"%3E%3Crect width="100%25" height="100%25" fill="%23e8e6f0"/%3E%3C/svg%3E#micro-photo-'
    study_photos = [p | {'file': placeholder+p['id']} for p in data['photos']]
    study = ['TH.length=0;PG.length=0;QS.length=0;PH.length=0;',
             'TH.push(...'+enc(topics)+');', 'PG.push(...'+enc(pathogens)+');',
             'QS.push(...'+enc(questions)+');', 'PH.push(...'+enc(study_photos)+');',
             'Object.assign(ZTX,'+enc(data['chapters'])+');']
    study += [a['code'] for a in animations.values()]
    study += [abx, (private/'pp_core.js').read_text().replace('const PREP = {};','PREP = {};')]
    study += [(private/n).read_text().replace('Сервер не нужен, всё работает без сети.', 'Для загрузки материалов и снимков нужны подключение к сети и подписка.') for n in ['pp_cmp.js','pp_items.js','pp_model.js','pp_tasks.js','pp_session.js','pp_pages.js','pp_pages2.js','pp_app.js']]
    study += [(SRC/'prep-media.js').read_text(), 'window.MICRO_FULL=true;']
    packages['prep']='\n'.join(study); titles['prep']='Подготовка к экзамену'
    # Every supported subroute, query and item in #learn stays in this package.
    aliases['learn']='prep'; aliases['learn/pg']='prep'; aliases['learn/ph']='prep'
    for p in data['photos']:
        packages['photo-'+p['id']]='window.MICRO_PHOTO='+enc({'id':p['id'],'file':p['file']})+';'
        titles['photo-'+p['id']]='Снимок: '+p['t']
    topic_build.emit('micro',packages,titles,aliases)
    path=ROOT/'topics.json'; nav=json.loads(path.read_text())
    for t in nav['topics']:
        tid=t['id']; t['route']='learn' if tid=='prep' else 'gallery/'+tid[8:] if tid.startswith('gallery-') else 'anim/'+tid[5:] if tid.startswith('anim-') else 'learn/pg' if tid=='learn-pg' else 'pathogens/'+tid[3:] if tid.startswith('pg-') else tid
    nav['topics']=[t for t in nav['topics'] if not t['id'].startswith('photo-') and t['id']!='learn-pg']
    nav.update(demo=DEMO+['anim-'+a for a in re.findall(r'AN\(\{"id":"([^"]+)"',demo_code)],publicRoutes=[])
    path.write_text(json.dumps(nav,ensure_ascii=False,indent=2)+'\n')
    print('v8:', len(topics),'topics,',len(pathogens),'dossiers,',len(questions),'questions,',len(data['photos']),'photos,',len(animations)+15,'animations,',data['drugs'],'antibiotics')

def public():
    catalog=json.loads((SRC/'catalog.json').read_text())
    code=(SRC/'core.js').read_text()+'\nconst MICRO_CATALOG = '+enc(catalog)+';\n'
    code+='MICRO_CATALOG.topics.forEach(t=>T({...t,locked:true,blocks:[]}));\nMICRO_CATALOG.clusters.forEach(z=>Z(z));\n'
    code+=(SRC/'runtime.js').read_text()+'\n'+(SRC/'demo.js').read_text()
    html=(SRC/'template.html').read_text()
    values={'/*CSS*/':(SRC/'style.css').read_text(),'/*DATA*/':code,'/*APP*/':(SRC/'app.js').read_text(),'/*BOOT*/':(SRC/'boot.js').read_text()}
    for marker,value in values.items():
        if marker!='/*CSS*/' and '</script' in value.lower(): raise ValueError('Unexpected script closing tag')
        assert html.count(marker)==1
        html=html.replace(marker,value)
    html=html.replace('<script src="../auth/config.js"></script>','<script>window.MA_TOPICS='+enc(json.loads((ROOT/'topics.json').read_text()))+';</script>\n<script src="../auth/config.js"></script>')
    (ROOT/'index.html').write_text(html)
    print('Public v8 demo:',len(html.encode())//1024,'KiB; exactly two lessons')
