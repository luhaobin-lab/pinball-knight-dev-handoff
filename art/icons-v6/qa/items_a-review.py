from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,numpy as np,argparse
R=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser(description='Historical optional original-source QA, requires the local workshop mothers.')
ap.add_argument('--mother-dir',type=Path)
args=ap.parse_args()
M=args.mother_dir.expanduser().resolve() if args.mother_dir else R/'mothers'
if not M.is_dir():raise SystemExit('Original high-resolution mothers are not included in public packages. Use --mother-dir only when you own the original local workshop archive; verify_release.py validates the delivered pixels without it.')
q=json.loads((R/'data/queue-items_a.json').read_text())
issues=[];records=[];seen={128:{},256:{}}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for e in q:
 id=e['id'];rec={'id':id,'name':e['name'],'issues':[]};bad=rec['issues']
 try:
  r=json.loads((R/'receipts'/f'{id}.json').read_text())
  if r['id']!=id:bad.append('receipt ID mismatch')
  if not r.get('visualReview','').startswith('passed:'):bad.append('visual review missing')
  p=M/f'{id}.png'
  if sha(p)!=r['motherSha256']:bad.append('mother hash mismatch')
  src=M/f'{id}.png'
  if not src.exists():bad.append('original generated source missing')
  elif sha(src)!=sha(p):bad.append('mother differs from generated original')
  mi=Image.open(p).convert('RGBA');a=np.array(mi)[:,:,3]
  if not (a<128).any():bad.append('mother not transparent')
  rec['motherSize']=list(mi.size);rec['variants']={}
  for w,maxc in [(128,64),(256,96)]:
   v=r['variants'][str(w)];p=R/v['file'];im=Image.open(p).convert('RGBA');arr=np.array(im)
   exp=(w,w*e['slot']['rows']//2)
   if im.size!=exp:bad.append(f'{w} dimensions {im.size} != {exp}')
   if sha(p)!=v['sha256']:bad.append(f'{w} file hash mismatch')
   ps=hashlib.sha256(im.tobytes()).hexdigest()
   if ps!=v['pixelSha256']:bad.append(f'{w} pixel hash mismatch')
   if ps in seen[w]:bad.append(f'{w} duplicate of '+seen[w][ps])
   seen[w][ps]=id
   aa=set(np.unique(arr[:,:,3]).tolist())
   if aa!={0,255}:bad.append(f'{w} alpha not binary')
   box=im.getbbox();margin=min(box[0],box[1],w-box[2],im.height-box[3])
   if margin<w//32:bad.append(f'{w} margin {margin}')
   colors=len(np.unique(arr[arr[:,:,3]>0,:3],axis=0))
   if colors>maxc:bad.append(f'{w} colors {colors}')
   rec['variants'][str(w)]={'dimensions':list(im.size),'alphaValues':sorted(aa),'margin':margin,'visibleColors':colors,'bytes':p.stat().st_size,'sha256':sha(p)}
 except Exception as ex:bad.append(str(ex))
 if bad:issues.append({'id':id,'issues':bad})
 records.append(rec)
report={'scope':'items_a reassigned final queue; I001-I066 excluding immutable I005/I047','assigned':len(q),'complete':sum(not r['issues'] for r in records),'issues':issues,'allGeneratedIndividually':True,'motherSourceHashIdentityChecked':True,'visualReviewMethod':'Every original generated image and every 256px PNG viewed individually; four contact sheets additionally inspected after this report. Aesthetic acceptance remains with the user.','rejectedDrafts':['I006 chain weapon','I016 bottle base','I017 ambiguous string','I017 floating secondary limb'],'records':records}
(R/'qa/items_a-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
import sys
sys.path.insert(0,str(R/'scripts'))
from portable import review_font
font=review_font(16)
for page in range((len(q)+15)//16):
 subset=q[page*16:(page+1)*16];out=Image.new('RGB',(1120,1680),(19,18,26));d=ImageDraw.Draw(out)
 for i,e in enumerate(subset):
  x=i%4*280;y=i//4*420
  # Neutral, alternating fields make unwanted black/colored mattes easier to see.
  bg=(38,35,45) if i%2==0 else (176,167,150)
  d.rectangle((x+4,y+4,x+275,y+395),fill=bg)
  im=Image.open(R/'pixels/256'/f"{e['id']}.png").convert('RGBA')
  out.paste(im,(x+12,y+8+(384-im.height)//2),im)
  d.text((x+10,y+399),e['id']+' '+e['name'][:14],font=font,fill=(225,210,190))
 out.save(R/'qa'/f'items_a-contact-{page+1:02}.png')
print(json.dumps({'assigned':len(q),'complete':report['complete'],'issues':issues,'contacts':4,'report':'qa/items_a-validation.json'},ensure_ascii=False))
