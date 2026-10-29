#!/usr/bin/env python3
"""Verify published file bytes against the frozen manifest."""
from pathlib import Path
import argparse, hashlib, json, sys
ROOT = Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();args=p.parse_args()
data=json.loads((ROOT/'MANIFEST.json').read_text(encoding='utf-8'))
errors=[];checked=0;optional_missing=0
for entry in data['files']:
 path=ROOT/entry['path']
 if not path.is_file():
  errors.append({'path':entry['path'],'error':'missing'});continue
 h=hashlib.sha256()
 with path.open('rb') as f:
  while block:=f.read(1024*1024):h.update(block)
 if path.stat().st_size!=entry['bytes'] or h.hexdigest()!=entry['sha256']:
  errors.append({'path':entry['path'],'error':'size or SHA256 mismatch'})
 checked+=1
print(json.dumps({'checked':checked,'errors':errors,'pass':not errors},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
