#!/usr/bin/env python3
"""Build the public v7 demo; --full validates private sources and builds protected packages."""
import argparse, os
from pathlib import Path
import v7_build
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--full',action='store_true')
args=parser.parse_args()
if args.full:
    private=Path(os.environ.get('ATLAS_PRIVATE') or ROOT.parent.parent/'medical_atlas_private')/'micro-atlas/v7'
    if not (private/'manifest.json').is_file(): raise SystemExit('Missing private micro v7 sources; run micro-atlas/import.py with the author HTML')
    v7_build.build(private)
v7_build.public()
