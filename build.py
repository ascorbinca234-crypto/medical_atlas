#!/usr/bin/env python3
"""Build public demos; --full requires all private sources and creates a server manifest."""
import argparse, hashlib, json, os, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent
SUBJECTS = ['farma', 'biochem', 'micro', 'pathophys']
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--full', action='store_true')
a = p.parse_args()
if a.full:
    private = Path(os.environ.get('ATLAS_PRIVATE') or ROOT.parent / 'medical_atlas_private')
    if not all((private / (s + '-atlas')).is_dir() for s in SUBJECTS):
        sys.exit('Full build requires private sources for all four atlases')
for subject in SUBJECTS:
    subprocess.run([sys.executable, str(ROOT / (subject + '-atlas') / 'build.py')] + (['--full'] if a.full else []), check=True)
if a.full:
    content = ROOT / 'server/content'
    hashes = {s: hashlib.sha256((content / 'topics' / s / 'manifest.json').read_bytes()).hexdigest() for s in SUBJECTS}
    (content / 'manifest.json').write_text(json.dumps({'policy': 'subject-subscription-v1', 'sha256': hashes}, indent=2) + '\n')
