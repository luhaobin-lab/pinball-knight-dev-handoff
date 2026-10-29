"""Decode the exact source BGRA texels for internal reference only. Never shipped as game assets."""
import hashlib,json,pathlib,sys
from PIL import Image
folder=pathlib.Path(sys.argv[1]);rows=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
for row in rows:
    data=pathlib.Path(row['raw']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==row['sha256']
    im=Image.frombytes('RGBA',(row['width'],row['height']),data,'raw','BGRA')
    out=folder/(row['name']+'.png');im.save(out)
    row['png']=str(out);row['pngSha256']=hashlib.sha256(out.read_bytes()).hexdigest()
    im.resize((row['width']*3,row['height']*3),Image.Resampling.NEAREST).save(folder/(row['name']+'-3x.png'))
(folder/'decoded.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
