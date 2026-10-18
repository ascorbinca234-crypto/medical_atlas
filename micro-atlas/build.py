#!/usr/bin/env python3
"""Build the public two-topic demo; --full also validates and packages private sources."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import topic_build
import subprocess

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
PRIVATE = Path(os.environ.get('ATLAS_PRIVATE') or ROOT.parent.parent / 'medical_atlas_private') / 'micro-atlas' / 'src'
DEMO = ['g1', 'g2']
DEMO_FILES = ['g01_morph.js', 'g02_phys.js']


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


def read_data(files):
    source = (SRC / 'core.js').read_text() + '\n' + '\n'.join(f.read_text() for f in files)
    source += '\nconsole.log(JSON.stringify({topics:TH,pathogens:PG,questions:QS}));'
    r = subprocess.run(['node', '-'], input=source, text=True, capture_output=True, timeout=30)
    if r.returncode:
        raise SystemExit(r.stderr)
    data = json.loads(r.stdout)
    topics, pathogens = data['topics'], data['pathogens']
    tids, pids = {t['id'] for t in topics}, {p['id'] for p in pathogens}
    if len(tids) != len(topics) or len(pids) != len(pathogens):
        raise SystemExit('Повторяющиеся ID тем или возбудителей')
    for t in topics:
        for block in t.get('blocks', []):
            if block['t'] == 'pg' and not set(block.get('ids', [])) <= pids:
                raise SystemExit('Нет досье, указанного в теме ' + t['id'])
    for q in data['questions']:
        if not set(q['th']) <= tids or not set(q['pg']) <= pids:
            raise SystemExit('Битая ссылка в вопросе ' + str(q['no']))
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full', action='store_true', help='Require private sources and build server/content/micro.js')
    args = parser.parse_args()
    if args.full:
        files = sorted(PRIVATE.glob('g[0-9]*.js')) + sorted(PRIVATE.glob('p[0-9]*.js')) + sorted(PRIVATE.glob('pathogens_*.js')) + [PRIVATE / 'questions.js']
        if len(files) != 29 or not all(f.is_file() for f in files):
            raise SystemExit('Нужны полные закрытые исходники: 22 темы, 6 файлов досье и вопросы')
        data = read_data(files)
        if len(data['topics']) != 22 or not set(DEMO) <= {t['id'] for t in data['topics']}:
            raise SystemExit('Ожидались 22 темы, включая обе пробные')
        for name in DEMO_FILES:
            if (PRIVATE / name).read_bytes() != (SRC / name).read_bytes():
                raise SystemExit('Пробный конспект расходится с оригиналом: ' + name)
        catalog = {'demo': DEMO, 'topics': [{k: t[k] for k in ('id', 'blk', 'no', 'title', 'short')} for t in data['topics']],
                   'pathogens': len(data['pathogens']), 'questions': len(data['questions'])}
        (SRC / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
        locked = 'TH.length=0; PG.length=0; QS.length=0;\n' + '\n'.join(f.read_text() for f in files)
        locked += '\nwindow.MICRO_FULL = true;\n'
        out = ROOT.parent / 'server' / 'content' / 'micro.js'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(locked)
        topic_build.micro(data)
        print(f'Закрытая часть: {len(data["topics"])} тем, {catalog["pathogens"]} досье, {catalog["questions"]} вопросов; SHA256 {hashlib.sha256(locked.encode()).hexdigest()}')
    catalog = json.loads((SRC / 'catalog.json').read_text())
    if catalog['demo'] != DEMO or len({t['id'] for t in catalog['topics']}) != len(catalog['topics']):
        raise SystemExit('Некорректный каталог пробных конспектов')
    code = (SRC / 'core.js').read_text() + '\n' + '\n'.join((SRC / f).read_text() for f in DEMO_FILES)
    check = code + '\nif(JSON.stringify(TH.map(t=>t.id))!==JSON.stringify(["g1","g2"])||PG.length||QS.length) process.exit(1);'
    subprocess.run(['node', '-'], input=check, text=True, check=True, timeout=30)
    code += '\nconst MICRO_CATALOG = ' + encode(catalog) + ';\n'
    code += 'MICRO_CATALOG.topics.filter(t=>!MICRO_CATALOG.demo.includes(t.id)).forEach(t=>T({...t,locked:true,blocks:[]}));\n'
    slots = {'/*CSS*/': (SRC / 'style.css').read_text(), '/*DATA*/': code,
             '/*APP*/': (SRC / 'app.js').read_text(), '/*BOOT*/': (SRC / 'boot.js').read_text()}
    html = (SRC / 'template.html').read_text()
    for marker, value in slots.items():
        if marker != '/*CSS*/' and '</script' in value.lower():
            raise SystemExit('Недопустимый закрывающий тег в ' + marker)
        if html.count(marker) != 1:
            raise SystemExit('Не найден слот ' + marker)
        html = html.replace(marker, value)
    html = html.replace('<script src="../auth/config.js"></script>', '<script>window.MA_TOPICS=' + encode(json.loads((ROOT / 'topics.json').read_text())) + ';</script>\n<script src="../auth/config.js"></script>')
    (ROOT / 'index.html').write_text(html)
    print(f'Публичная страница: ровно два конспекта, {len(catalog["topics"])-2} заголовков закрытых тем; {len(html.encode())//1024} КБ')


if __name__ == '__main__':
    main()
