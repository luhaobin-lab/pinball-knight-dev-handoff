#!/usr/bin/env python3
"""Build full and development-only ZIPs and one combined release checksum list."""
from pathlib import Path
import argparse,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);args=p.parse_args();out=args.out.resolve()
if out.is_relative_to(ROOT):raise SystemExit('Use an output directory outside the project root.')
for script in ['package_handoff.py','build_lite.py']:
 subprocess.run([sys.executable,str(ROOT/'tools'/script),'--out',str(out)],cwd=ROOT,check=True)
products=json.loads((out/'release-files.json').read_text(encoding='utf-8'))
lite=json.loads((out/'lite-release.json').read_text(encoding='utf-8'))
products=[e for e in products if e['file']!=lite['file']]+[lite]
(out/'release-files.json').write_text(json.dumps(products,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(out/'SHA256SUMS.txt').write_text(''.join(e['sha256']+'  '+e['file']+'\n' for e in products),encoding='utf-8')
print(json.dumps({'products':products},ensure_ascii=False,indent=2))
