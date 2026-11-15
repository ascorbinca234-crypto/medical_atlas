#!/usr/bin/env python3
"""Export a deployable public site with no Git history, API, private sources or private bundles."""
import hashlib, json, zipfile, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node', '--test', 'server/test/client-access.test.js', 'server/test/security-drm.test.js'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
OUT=ROOT/'outputs'
OUT.mkdir(exist_ok=True)
files=[
  ROOT/'index.html',
  ROOT/'privacy.html',
  ROOT/'landing/styles.css',
  ROOT/'admin/index.html',
  ROOT/'cabinet/index.html',
  ROOT/'auth/index.html',
  ROOT/'auth/auth.js',
  ROOT/'auth/config.js',
  ROOT/'progress/progress.js',
]
files += [ROOT/(a+'-atlas/index.html') for a in ['farma','biochem','micro','pathophys','patan','chemistry']]
for chem_file in ['app.js','content.js','design.css','first-semester.js','formula-cards.js','formula-learning.js','formulas.js','style.css','supplement.js','topics.json','visuals.js']:
  p = ROOT/'chemistry-atlas'/chem_file
  if p.is_file():
    files.append(p)
files += [p for directory in ['assets','biochem-atlas/vendor','patan-atlas/topics'] for p in (ROOT/directory).rglob('*') if p.is_file() and p.name!='.DS_Store' and not p.is_relative_to(ROOT/'assets/team')]
files = sorted(set(files))
assert all(f.is_file() for f in files)
manifest={}
with zipfile.ZipFile(OUT/'medical_atlas_public_site.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in files:
  rel=f.relative_to(ROOT).as_posix();raw=f.read_bytes();z.writestr(rel,raw);manifest[rel]=hashlib.sha256(raw).hexdigest()
(OUT/'public-site-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Public site:',len(files),'files; no Git history or private bundles')

