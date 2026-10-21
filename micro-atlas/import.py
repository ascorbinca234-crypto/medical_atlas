#!/usr/bin/env python3
"""Import an author's self-contained v7 HTML into the private source directory."""
import argparse, hashlib, json, os, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('html', type=Path)
args = parser.parse_args()
raw = args.html.read_bytes()
html = raw.decode('utf-8')
dest = Path(os.environ.get('ATLAS_PRIVATE') or ROOT.parent.parent / 'medical_atlas_private') / 'micro-atlas/v7'
dest.mkdir(parents=True, exist_ok=True)
script = re.search(r'<script>\s*([\s\S]*?)</script>', html).group(1)
markers = list(re.finditer(r'/\* ---- ([a-z0-9_]+\.js) ---- \*/\n', script))
modules = {}
for i, m in enumerate(markers):
    modules[m[1]] = script[m.end():markers[i+1].start() if i+1 < len(markers) else len(script)]
assert len(modules) >= 70 and 'app.js' in modules and 'v7_app.js' in modules
for name, code in modules.items():
    (dest / name).write_text(code)
(dest / 'style.css').write_text(re.findall(r'<style>([\s\S]*?)</style>', html)[-1])
markup = html[html.index('<div class="app">'):html.index('<script>')]
(dest / 'markup.html').write_text(markup)
(dest / 'manifest.json').write_text(json.dumps({'version': 7, 'sha256': hashlib.sha256(raw).hexdigest(), 'modules': list(modules)}, indent=2)+'\n')
print(f'Imported {len(modules)} modules into private sources; SHA256 {hashlib.sha256(raw).hexdigest()}')
