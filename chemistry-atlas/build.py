#!/usr/bin/env python3
"""Build public chemistry-atlas (overview + first 2 lessons open) and per-topic protected packages."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
REPO = ROOT.parent
DEMO_IDS = ['lesson-1', 'lesson-2']


def enc_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</script', '<\\/script')


def extract_full_data():
    node_script = r"""
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = process.argv[1];
const ctx = vm.createContext({ window: {}, console });
for (const f of ['content.js', 'supplement.js', 'first-semester.js', 'visuals.js', 'formula-cards.js', 'formula-learning.js', 'formulas.js']) {
  const code = fs.readFileSync(path.join(src, f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}
const out = vm.runInContext(`JSON.stringify({
  DATA,
  EXTRA,
  SCHEMES,
  LESSON_LAB,
  courseSources,
  FORMULA_SECTIONS,
  FORMULA_CARDS,
  FORMULA_INTUITION,
  FORMULA_EXAMPLES
})`, ctx);
process.stdout.write(out);
"""
    res = subprocess.run(['node', '-e', node_script, str(SRC)], check=True, capture_output=True, text=True)
    return json.loads(res.stdout)


def extract_lab_entries(visuals_text):
    entries = {}
    for m in re.finditer(r'^\s*([a-z]+):(\{.*\}),?\s*$', visuals_text, re.M):
        entries[m.group(1)] = m.group(2).rstrip(',')
    return entries


def main():
    full = extract_full_data()
    data = full['DATA']
    extra = full['EXTRA']
    schemes = full['SCHEMES']
    lesson_lab = full['LESSON_LAB']
    course_sources = full['courseSources']
    formula_cards = full['FORMULA_CARDS']
    formula_intuition = full['FORMULA_INTUITION']
    formula_examples = full['FORMULA_EXAMPLES']

    assert len(data) == 15, f'Expected 15 DATA entries (start + 14 lessons), got {len(data)}'

    visuals_src = (SRC / 'visuals.js').read_text(encoding='utf-8')
    lab_entries = extract_lab_entries(visuals_src)
    assert set(['thermo', 'kinetics', 'buffer']).issubset(lab_entries), 'Missing base lab entries'

    # 1. Write topics.json
    topics_list = [{'id': d['id'], 'title': d['title']} for d in data[1:]]
    topics_list.append({'id': 'formulas', 'title': 'Справочник формул'})
    aliases = {f'formula-section-{i}': 'formulas' for i in range(max(len(formula_cards), 11))}
    catalog = {
        'topics': topics_list,
        'aliases': aliases,
        'demo': DEMO_IDS,
        'publicRoutes': ['start'],
    }
    (ROOT / 'topics.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # 2. Write protected server packages to server/content/topics/chemistry/
    server_dest = REPO / 'server/content/topics/chemistry'
    server_dest.mkdir(parents=True, exist_ok=True)
    for old_js in server_dest.glob('*.js'):
        old_js.unlink()

    manifest = {'policy': 'topic-delivery-v1', 'topics': {}}

    for idx in range(1, len(data)):
        d = dict(data[idx])
        d['locked'] = False
        tid = d['id']
        ex = extra.get(tid, {'more': '', 'steps': [], 'quiz': []})
        sch = schemes.get(str(idx), [])
        lab_key = lesson_lab.get(str(idx))
        lab_patch = ''
        if lab_key and lab_key in lab_entries:
            lab_patch = f'if(typeof LABS!=="undefined")LABS[{json.dumps(lab_key)}]={lab_entries[lab_key]};'
        code = (
            '(function(){'
            f'var d={enc_json(d)};'
            'if(typeof DATA!=="undefined"&&Array.isArray(DATA)){'
            'var i=DATA.findIndex(function(x){return x&&x.id===d.id;});'
            'if(i>=0)DATA[i]=d;else DATA.push(d);'
            '}'
            f'if(typeof EXTRA!=="undefined")EXTRA[{json.dumps(tid)}]={enc_json(ex)};'
            f'if(typeof SCHEMES!=="undefined")SCHEMES[{idx}]={enc_json(sch)};'
            + lab_patch +
            '})();\n'
        )
        raw = code.encode('utf-8')
        (server_dest / f'{tid}.js').write_bytes(raw)
        manifest['topics'][tid] = {
            'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw),
        }

    formulas_code = (
        '(function(){'
        'window.CHEM_FORMULAS_UNLOCKED=true;'
        f'FORMULA_CARDS={enc_json(formula_cards)};'
        f'FORMULA_INTUITION={enc_json(formula_intuition)};'
        f'FORMULA_EXAMPLES={enc_json(formula_examples)};'
        '})();\n'
    )
    formulas_bytes = formulas_code.encode('utf-8')
    (server_dest / 'formulas.js').write_bytes(formulas_bytes)
    manifest['topics']['formulas'] = {
        'sha256': hashlib.sha256(formulas_bytes).hexdigest(),
        'bytes': len(formulas_bytes),
    }

    (server_dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    # 3. Write stripped public JS files (start + lesson-1 + lesson-2 open; lessons 3..14 & formulas locked)
    public_data = []
    public_extra = {}
    for idx, d in enumerate(data):
        tid = d['id']
        if idx == 0 or tid in DEMO_IDS:
            entry = dict(d)
            if idx > 0:
                entry['locked'] = False
            public_data.append(entry)
            if tid in extra:
                public_extra[tid] = extra[tid]
        else:
            qcount = len(extra.get(tid, {}).get('quiz', []))
            public_data.append({
                'id': tid,
                'title': d['title'],
                'lead': '',
                'body': '',
                'locked': True,
                'quizCount': qcount,
            })
            public_extra[tid] = {'more': '', 'steps': [], 'quiz': [], 'quizCount': qcount}

    (ROOT / 'content.js').write_text(
        f'var DATA={enc_json(public_data)};\n',
        encoding='utf-8',
    )
    (ROOT / 'supplement.js').write_text(
        f'var EXTRA={enc_json(public_extra)};\nvar courseSources={enc_json(course_sources)};\n',
        encoding='utf-8',
    )
    (ROOT / 'first-semester.js').write_text(
        '// Public build: lessons 1-2 open, lessons 3-14 delivered per-topic via /content-v3/chemistry.\n',
        encoding='utf-8',
    )

    # Public visuals.js: keep dashboard & demo-1/2 models (thermo, kinetics, buffer) + SCHEMES 1-2 only
    public_labs_body = ',\n '.join(f'{k}:{lab_entries[k]}' for k in ('thermo', 'kinetics', 'buffer'))
    public_schemes = {str(k): schemes[str(k)] for k in (1, 2) if str(k) in schemes}
    m_fn_tail = visuals_src.split('function moleculeMarkup()', 1)[1]
    fn_tail = 'function moleculeMarkup()' + m_fn_tail.split('const SCHEMES={', 1)[0]
    after_schemes = visuals_src.split('function generalDiagramMarkup', 1)[1]
    after_schemes = 'function generalDiagramMarkup' + after_schemes
    after_schemes = after_schemes.replace(
        'let items=SCHEMES[i];return',
        'let items=SCHEMES[i]||[];return',
        1,
    )
    public_visuals = (
        '/* Independent, idealized teaching models. All units and assumptions are shown in the interface. */\n'
        f'var LABS={{\n {public_labs_body}\n}};\n'
        f'var LESSON_LAB={enc_json({int(k): v for k, v in lesson_lab.items()})};\n'
        f'{fn_tail}'
        f'var SCHEMES={enc_json(public_schemes)};\n'
        f'{after_schemes}'
    )
    (ROOT / 'visuals.js').write_text(public_visuals, encoding='utf-8')

    (ROOT / 'formula-cards.js').write_text('var FORMULA_CARDS=[];\n', encoding='utf-8')
    (ROOT / 'formula-learning.js').write_text(
        'var FORMULA_INTUITION=[];\nvar FORMULA_EXAMPLES={};\nwindow.CHEM_FORMULAS_UNLOCKED=false;\n',
        encoding='utf-8',
    )

    # Update inline window.MA_TOPICS in chemistry-atlas/index.html if present
    idx_path = ROOT / 'index.html'
    idx_html = idx_path.read_text(encoding='utf-8')
    if 'window.MA_TOPICS=' in idx_html:
        idx_html = re.sub(
            r'<script>window\.MA_TOPICS=.*?;</script>',
            lambda _: f'<script>window.MA_TOPICS={enc_json(catalog)};</script>',
            idx_html,
            count=1,
        )
        idx_path.write_text(idx_html, encoding='utf-8')

    print(f'Chemistry Atlas built: {len(topics_list)} protected packages in {server_dest} (2 open lessons)')


if __name__ == '__main__':
    main()
