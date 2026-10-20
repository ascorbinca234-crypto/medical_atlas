#!/usr/bin/env python3
"""Build the React atlas; --full requires the original private JSX source."""
from pathlib import Path
import subprocess, sys
subprocess.run(['node', str(Path(__file__).with_suffix('.mjs')), *sys.argv[1:]], check=True)
