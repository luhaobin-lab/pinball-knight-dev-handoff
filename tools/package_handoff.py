#!/usr/bin/env python3
"""Build a portable snapshot and optional icon-mother overlay; standard Python only."""
from pathlib import Path
import argparse,hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);args=p.parse_args();args.out.mkdir(parents=True,exist_ok=True)
if args.out.resolve().is_relative_to(ROOT):
 raise SystemExit('Choose an output directory outside the project root.')
if len(list((ROOT/'art/icons-v6/mothers').glob('*.png')))!=308:
 raise SystemExit('Complete package requires all 308 mothers. Download icon-mothers.zip from the GitHub release first.')
if len(list((ROOT/'art/icons-v6/pixels').rglob('*.png')))!=616:
 raise SystemExit('Expected 616 production PNGs.')
if len(list((ROOT/'art/ui-v10/交付原图').glob('*.png')))!=12:
 raise SystemExit('Expected 12 selected UI images.')
SKIP={'.git','node_modules','__pycache__','dist','.DS_Store','.env','.venv','.pytest_cache','.ruff_cache','.vite','coverage'}
def included(path):
 r=path.relative_to(ROOT)
 return not any(s in SKIP for s in r.parts) and path.suffix not in {'.pyc','.zip'} and not path.name.startswith('.env.')
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(1024*1024):h.update(b)
 return h.hexdigest()
files=sorted(p for p in ROOT.rglob('*') if p.is_file() and included(p) and p.name not in {'MANIFEST.json','SHA256SUMS.txt'})
entries=[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p),'optionalInGitClone':'art/icons-v6/mothers/' in p.relative_to(ROOT).as_posix()} for p in files]
(ROOT/'MANIFEST.json').write_text(json.dumps({'snapshot':'2026-10-29','description':'All payload files except this manifest and its SHA256 list; mothers are optional only in Git clones.','files':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'SHA256SUMS.txt').write_text(''.join(e['sha256']+'  '+e['path']+'\n' for e in entries),encoding='utf-8')
files += [ROOT/'MANIFEST.json',ROOT/'SHA256SUMS.txt']
products=[]
for name,subset,prefix in [('pinball-knight-complete-handoff.zip',files,'pinball-knight-dev-handoff/'),('icon-mothers.zip',[p for p in files if p.is_relative_to(ROOT/'art/icons-v6/mothers')],'')]:
 dest=args.out/name
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
  for f in subset:z.write(f,prefix+f.relative_to(ROOT).as_posix())
 with zipfile.ZipFile(dest) as z:
  bad=z.testzip()
  if bad:raise RuntimeError('Bad ZIP member: '+bad)
 products.append({'file':name,'bytes':dest.stat().st_size,'sha256':digest(dest),'members':len(subset)})
(args.out/'SHA256SUMS.txt').write_text(''.join(x['sha256']+'  '+x['file']+'\n' for x in products),encoding='utf-8')
(args.out/'release-files.json').write_text(json.dumps(products,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'files':len(entries),'payloadBytes':sum(e['bytes'] for e in entries),'products':products},ensure_ascii=False,indent=2))
