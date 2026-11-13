"""Import an author's standalone pharmacology HTML without publishing private data."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
import topic_build

BODY = '/* ===== Организм:'
LEARN = '/* ===== Учить:'
FX = '/* ===== Анимации и «фишки»'
APP = '/* ===== Рендер атласа ===== */'


def integrate(code):
    # Keep the author's learning algorithm; report its results to the existing cabinet.
    marker = 'LST.days[t]=(LST.days[t]||0)+1; lSave();'
    assert code.count(marker) == 1
    code = code.replace(marker, marker + "\n  try{if(window.MAP){window.MAP.card({atlas:'farma',ok:g>=3});lPublish();}}catch(e){}")
    marker = 'LDECK=items; return items;'
    assert code.count(marker) == 1
    code = code.replace(marker, 'LDECK=items; lPublish(); return items;')
    bridge = """
let lPubT=0;
function lPublish(){clearTimeout(lPubT);lPubT=setTimeout(lPublishNow,400);}
function lPublishNow(){try{
 if(!window.MAP||!LDECK)return;
 const by={};LDECK.forEach(it=>{const s=by[it.p]||(by[it.p]={total:0,learned:0,seen:0});s.total++;const r=lRec(it.id);if(lSeen(r))s.seen++;if(lSeen(r)&&r[0]>=4)s.learned++;});
 window.MAP.sections('farma',KP.map(p=>Object.assign({id:p.id,n:p.title,sub:p.lec||p.roman||'',locked:!!p.locked},by[p.id]||{total:0,learned:0,seen:0})));
}catch(e){}}
"""
    code = code.replace('function lDueCount(', bridge + '\nfunction lDueCount(', 1)
    marker = "  if(typeof FX!=='undefined') FX.page(kind);"
    assert code.count(marker) == 1
    return code.replace(marker, "  if(kind==='plate'&&p&&!p.locked&&window.MAP)window.MAP.last({atlas:'farma',title:p.title,sub:p.lec||p.roman||'',url:location.href});\n" + marker)


def build(html_path, root):
    html = html_path.read_text()
    scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script\s*>', html, re.I)
    assert len(scripts) == 1, 'Expected one standalone application'
    original = scripts[0]
    subprocess.run(['node', '--check'], input=original, text=True, check=True, capture_output=True)
    data_code = original[:original.index(BODY)]
    body = original[original.index(BODY):original.index(LEARN)]
    data = topic_build.jsdata(data_code, '{P,KP,MODULES,KALIAS,KLEG,RXD,RXAL,RPD,DRUGS,ANTIDOTES}')
    data.update(DRUGS_ORDER=list(data['DRUGS']), VIT_LOCKED={}, VIT_ORDER=[])
    code = integrate(original)
    learn = code[code.index(LEARN):code.index(FX)]
    app = code[code.index(APP):]
    src = root / 'src'
    # The original registry can be evaluated without DOM initialization.
    registry = app[:app.index('/* ---------- карточка ---------- */')]
    probe = data_code + body + learn + registry
    probe += '\nglobalThis.result={drugs:UNI.length,lectures:KP.length,cards:lDeck({kSame,key,kFindDrug,uFind,rpAll:()=>[]}).length};})();\n'
    probe += 'console.log(JSON.stringify(globalThis.result));'
    result = subprocess.run(['node', '-'], input='const window={};const localStorage={getItem:()=>null};const setTimeout=()=>0;const clearTimeout=()=>{};\n'+probe, text=True, capture_output=True)
    if result.returncode: raise ValueError(result.stderr)
    summary = json.loads(result.stdout)
    (src / 'overview.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    topic_build.farma(data, body, learn)
    (src / 'body.js').write_text((src / 'body.js').read_text().rstrip()+'\n')
    topic_build.add_package('farma', 'atlas', 'Атлас фармакологии', '(function(){\n'+code+'\nwindow.MA_FARMA_FULL=true;})();\n')
    catalog_path = root / 'topics.json'
    catalog = json.loads(catalog_path.read_text()); catalog['fullAtlas'] = 'atlas'
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')
    enc = topic_build.enc
    demo_ids = {'k-gen','k-aff'}
    demos = [p for p in data['KP'] if p['id'] in demo_ids]
    # Generate only the same two free lessons and their drug entries.
    (src / 'data.js').write_text('const P=[];const MODULES='+enc(data['MODULES'])+';const ANTIDOTES=[];\n')
    public = {'KP':[], 'KALIAS':{}, 'KLEG':data['KLEG'], 'RXD':{}, 'RXAL':[], 'RPD':{}}
    (src / 'k0.js').write_text('\n'.join('const '+k+' = '+enc(v)+';' for k,v in public.items())+'\nconst EXTRA={routes:{},home:[],nav:[]};\n')
    for pid,filename in [('k-gen','k_00_gen.js'),('k-aff','k_01_aff.js')]:
        (src / filename).write_text('KP.push('+enc(next(p for p in demos if p['id']==pid))+');\n')
    stubs=[]
    for kind in ['KP','P']:
        for p in data[kind]:
            if p['id'] in demo_ids: continue
            stub={k:p[k] for k in ['id','roman','lec','title','sum','mod'] if k in p}
            stub.update(locked=True,blocks=[],rel=[])
            stubs.append(kind+'.push('+enc(stub)+');')
    (src / 'locked_stubs.js').write_text('\n'.join(stubs)+'\n')
    (src / 'drugs.js').write_text('const DRUGS='+enc({})+';\n')
    (src / 'learn.js').write_text(learn.rstrip()+'\n')
    (src / 'fx.js').write_text(code[code.index(FX):code.index(APP)].rstrip()+'\n')
    # Reuse the existing access notice in the author's updated public interface.
    old = (src / 'app.js').read_text()
    locks = old[old.index('/* ---------- закрытые темы ---------- */'):old.index('const ICO =')]
    app = app.replace('const ICO =', locks+'const ICO =', 1)
    app = app.replace('function renderPlate(p){', 'function renderPlate(p){\n  if(p.locked){renderLockedPlate(p);return;}')
    app = app.replace('data-count="${UNI.length}">${UNI.length}', 'data-count="${window.MA_FARMA_OVERVIEW.drugs}">${window.MA_FARMA_OVERVIEW.drugs}')
    app = app.replace('<h1>Атлас <em>фармакологии</em></h1>', '<h1>Атлас <em>фармакологии</em></h1>${lockBanner()}')
    start = app.index('/* ===== Тренажёры: данные ===== */'); end = app.index('/* ===== Тренажёры: суффиксы',start)
    app = app[:start]+'const TR_STEMS=[],TR_ANTI=[],TR_CAUSE=[],TR_COMBO=[];\n'+app[end:]
    app = app.replace('EXTRA.routes.train=function(A0,arg){', "EXTRA.routes.train=function(A0,arg){renderLockedPlate({mod:'kon',roman:'',title:'Тренажёры'});return;")
    # Empty reference data stays protected, while all application logic is current.
    (src / 'app.js').write_text(app.rstrip()+'\n')
    styles = re.findall(r'<style[^>]*>([\s\S]*?)</style>', html, re.I)
    lock_css = (src / 'access.css').read_text()
    (src / 'style.css').write_text('\n'.join(styles)+'\n'+lock_css)
    (src / 'source-version.json').write_text(json.dumps({'file':html_path.name,'sha256':hashlib.sha256(html.encode()).hexdigest(),**summary},ensure_ascii=False,indent=2)+'\n')
    print('Imported standalone pharmacology:', summary)
