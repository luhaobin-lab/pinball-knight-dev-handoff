#!/usr/bin/env python3
"""Verify file bytes against the frozen manifest. Optional mothers may be absent in Git clones."""
from pathlib import Path
import argparse, hashlib, json, sys
ROOT = Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--require-mothers',action='store_true');args=p.parse_args()
data=json.loads((ROOT/'MANIFEST.json').read_text(encoding='utf-8'))
errors=[];checked=0;optional_missing=0
for entry in data['files']:
 path=ROOT/entry['path']
 if not path.is_file():
  if entry.get('optionalInGitClone') and not args.require_mothers:optional_missing+=1;continue
  errors.append({'path':entry['path'],'error':'missing'});continue
 h=hashlib.sha256()
 with path.open('rb') as f:
  while block:=f.read(1024*1024):h.update(block)
 if path.stat().st_size!=entry['bytes'] or h.hexdigest()!=entry['sha256']:
  errors.append({'path':entry['path'],'error':'size or SHA256 mismatch'})
 checked+=1
print(json.dumps({'checked':checked,'optionalMothersMissing':optional_missing,'errors':errors,'pass':not errors},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
