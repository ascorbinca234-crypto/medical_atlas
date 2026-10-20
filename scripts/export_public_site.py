#!/usr/bin/env python3
"""Export a deployable public site with no Git history, API, private sources or private bundles."""
import hashlib, json, zipfile, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
# Public output must be rebuilt and pass leak checks before export.
subprocess.run([sys.executable, str(ROOT/'build.py')], check=True)
subprocess.run(['node', '--test', 'server/test/client-access.test.js', 'server/test/micro.test.js', 'server/test/pathophys.test.js'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
OUT=ROOT/'outputs'
OUT.mkdir(exist_ok=True)
files=[ROOT/'index.html',ROOT/'cabinet/index.html',ROOT/'auth/index.html',ROOT/'auth/auth.js',ROOT/'auth/config.js',ROOT/'progress/progress.js']
files += [ROOT/(a+'-atlas/index.html') for a in ['farma','biochem','micro','pathophys']]
files += [p for directory in ['assets','biochem-atlas/vendor'] for p in (ROOT/directory).rglob('*') if p.is_file() and p.name!='.DS_Store']
assert all(f.is_file() for f in files)
manifest={}
with zipfile.ZipFile(OUT/'medical_atlas_public_site.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted(files):
  rel=f.relative_to(ROOT).as_posix();raw=f.read_bytes();z.writestr(rel,raw);manifest[rel]=hashlib.sha256(raw).hexdigest()
(OUT/'public-site-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Public site:',len(files),'files; no Git history or private bundles')
