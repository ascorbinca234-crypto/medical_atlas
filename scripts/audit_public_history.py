#!/usr/bin/env python3
"""Read-only inventory of historical atlas material; writes a local report, never rewrites refs."""
import json, subprocess, argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--repository',default=str(ROOT));args=parser.parse_args()
def git(*values):return subprocess.check_output(['git','-C',args.repository,*values],text=True).strip()
paths=['farma-atlas/index.html','farma-atlas/src','biochem-atlas/index.html','biochem-atlas/data','biochem-atlas/src/template.html','biochem-atlas/screenshot.png']
refs=git('for-each-ref','--format=%(refname)').splitlines()
report={'head':git('rev-parse','HEAD'),'note':'Candidate paths: old versions contain more than the public demo. This audit does not delete GitHub caches, forks, PR refs or clones.',
        'candidate_paths':paths,'refs':{ref:git('rev-list','--count',ref,'--',*paths) for ref in refs},
        'historical_files':git('log','--all','--format=','--name-only','--',*paths).splitlines()}
report['historical_files']=sorted(set(filter(None,report['historical_files'])))
(ROOT/'outputs').mkdir(exist_ok=True)
(ROOT/'outputs/history-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(len(refs),'local refs inspected; report: outputs/history-audit.json')
