"""Build review catalogue, padded atlases and technical QA from existing PNGs only."""
from pathlib import Path
import json,hashlib,math
from collections import defaultdict
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from portable import review_font
ROOT=Path(__file__).resolve().parents[1]
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def font(s):return review_font(s)
def main():
 for name in ['atlas','qa']:(ROOT/name).mkdir(exist_ok=True)
 briefs=json.loads((ROOT/'data/briefs.json').read_text());records=[];issues=[];missing=[];hashes=defaultdict(list)
 for b in briefs:
  id=b['id'];paths={str(s):ROOT/'pixels'/str(s)/f'{id}.png' for s in [128,256]}
  if not all(p.exists() for p in paths.values()):missing.append(id);continue
  rec={'id':id,'name':b['name'],'category':b['categoryKey'],'slot':b['slot'],'description':b['description'],'tags':b['tags'],'sourceFlags':b['sourceFlags'],'sizeAuthority':b['sizeAuthority'],'sourceMetadata':b,'files':{},'variants':{},'mother':f'mothers/{id}.png','prompt':f'prompts/{id}.txt','approval':'approved-anchor' if id in ['I005','I047','I106'] else 'production-candidate'}
  for size,p in paths.items():
   im=Image.open(p).convert('RGBA');a=np.array(im);w=int(size);h=w*b['slot']['rows']//2 if b['slot'] else w;bounds=im.getbbox();colors=len(np.unique(a[a[:,:,3]>0,:3],axis=0));alpha=set(np.unique(a[:,:,3]).tolist())
   if im.size!=(w,h):issues.append([id,size,'wrong-size'])
   if alpha!={0,255}:issues.append([id,size,'non-binary-alpha'])
   if not bounds or min(bounds[0],bounds[1],w-bounds[2],h-bounds[3])<w//32:issues.append([id,size,'margin'])
   pixelhash=hashlib.sha256(im.tobytes()).hexdigest()
   if w==256:hashes[pixelhash].append(id)
   rec['files'][size]=str(p.relative_to(ROOT));rec['variants'][size]={'width':w,'height':h,'bytes':p.stat().st_size,'colors':colors,'alphaBounds':bounds,'sha256':sha(p),'pixelSha256':pixelhash}
  records.append(rec)
 duplicate=[ids for ids in hashes.values() if len(ids)>1]
 if duplicate:issues.append(['duplicate-pixels',duplicate])
 # Shelf-pack exact-size sprites with transparent padding. Never trim or rotate.
 groups=defaultdict(list)
 for rec in records:groups['talents' if rec['category']=='talent' else 'items-'+str(rec['slot']['rows'])].append(rec)
 atlases=[]
 for key,group in groups.items():
  pages=[];page=[];x=y=4;rowh=0
  for rec in group:
   v=rec['variants']['256'];w,h=v['width'],v['height']
   if x+w+4>2048:x=4;y+=rowh+8;rowh=0
   if y+h+4>2048:pages.append(page);page=[];x=y=4;rowh=0
   page.append((rec,x,y,w,h));x+=w+8;rowh=max(rowh,h)
  if page:pages.append(page)
  for n,page in enumerate(pages):
   aid=f'{key}-{n+1}';usedw=max(x+w+4 for _,x,y,w,h in page);usedh=max(y+h+4 for _,x,y,w,h in page);aw=2**math.ceil(math.log2(usedw));ah=2**math.ceil(math.log2(usedh));im=Image.new('RGBA',(aw,ah));frames={}
   for rec,x,y,w,h in page:
    sp=Image.open(ROOT/rec['files']['256']).convert('RGBA');im.paste(sp,(x,y));frame={'x':x,'y':y,'w':w,'h':h};frames[rec['id']]={'frame':frame,'rotated':False,'trimmed':False,'sourceSize':{'w':w,'h':h},'pivot':{'x':.5,'y':.5}};rec['atlas']={'page':aid,'frame':frame}
   p=ROOT/'atlas'/f'{aid}.png';im.save(p,optimize=True);dump(ROOT/'atlas'/f'{aid}.json',{'frames':frames,'meta':{'image':p.name,'size':{'w':aw,'h':ah},'scale':1,'padding':4,'origin':'top-left'}})
   atlases.append({'id':aid,'image':str(p.relative_to(ROOT)),'data':f'atlas/{aid}.json','width':aw,'height':ah,'sha256':sha(p)})
 # Review every actual PNG at native 256px, sixteen per board.
 for offset in range(0,len(records),16):
  batch=records[offset:offset+16];board=Image.new('RGB',(1152,48+len(range(0,len(batch),4))*440),(17,15,23));d=ImageDraw.Draw(board);d.text((18,10),f'V6 / {offset+1}–{offset+len(batch)} / 原生256px',font=font(20),fill=(228,214,194))
  for j,rec in enumerate(batch):
   x=12+(j%4)*288;y=48+(j//4)*440;sp=Image.open(ROOT/rec['files']['256']).convert('RGBA');d.rectangle((x,y,x+276,y+428),fill=(26,22,31),outline=(58,44,50));board.paste(sp,(x+10,y+6+(384-sp.height)//2),sp);d.text((x+12,y+392),rec['id']+' '+rec['name'][:12],font=font(15),fill=(229,215,195))
  board.save(ROOT/'qa'/f'contact-{offset//16+1:02d}.png')
 manifest={'schemaVersion':'2.0.0','packageId':'pinball-knight-handdrawn-icons','version':'6.0.0','status':'complete-assets' if not missing and not issues else 'in-production','counts':{'expected':308,'ready':len(records),'missing':len(missing),'items':sum(r['category']=='item' for r in records),'talents':sum(r['category']=='talent' for r in records)},'pixelRules':{'primaryWidth':256,'alternateWidth':128,'alpha':'binary','filter':'nearest','mipmaps':False,'colorSpace':'sRGB','wrap':'clamp','origin':'top-left','trimmed':False,'rotated':False,'atlasPadding':4},'icons':records,'atlases':atlases,'missingIds':missing,'boundary':'Generated reference-conditioned mothers, algorithmically pixelized. Technical validation is not target-engine or user aesthetic acceptance.'}
 dump(ROOT/'manifest.json',manifest);(ROOT/'catalog.js').write_text('window.CATALOG='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
 qa={'ready':len(records),'missing':missing,'issues':issues,'exactDuplicateGroups':duplicate,'status':'pass-complete' if not missing and not issues else ('pass-partial' if not issues else 'fail')};dump(ROOT/'qa/technical-validation.json',qa)
 print(json.dumps({'ready':len(records),'missing':len(missing),'issues':issues,'atlases':len(atlases)},ensure_ascii=False))
if __name__=='__main__':main()
