"""V5-approved pixel conversion shared by V6 scripts.

The source is a generated painting. This is algorithmic pixelization, not a
claim of hand-authored pixels. Run rebuild_pngs.py to export this V6 package.
"""
import numpy as np
from PIL import Image, ImageFilter

def fit_premultiplied(im,canvas,margin):
 a=np.array(im.convert('RGBA'),dtype=np.float32)/255
 box=Image.fromarray(np.uint8(a[:,:,3]>=.5)*255).getbbox()
 if not box:raise ValueError('No foreground alpha')
 l,t,r,b=box;l=max(0,l-2);t=max(0,t-2);r=min(im.width,r+2);b=min(im.height,b+2);a=a[t:b,l:r]
 available=(canvas[0]-2*margin,canvas[1]-2*margin);scale=min(available[0]/a.shape[1],available[1]/a.shape[0]);size=(max(1,round(a.shape[1]*scale)),max(1,round(a.shape[0]*scale)))
 alpha=Image.fromarray(a[:,:,3]).resize(size,Image.Resampling.LANCZOS);al=np.clip(np.array(alpha),0,1)
 channels=[]
 for c in range(3):
  pre=Image.fromarray(a[:,:,c]*a[:,:,3]).resize(size,Image.Resampling.LANCZOS);channels.append(np.clip(np.array(pre)/np.maximum(al,.00001),0,1))
 rgba=np.dstack(channels+[al]);small=Image.fromarray(np.uint8(np.round(rgba*255)))
 result=Image.new('RGBA',canvas);pos=((canvas[0]-size[0])//2,(canvas[1]-size[1])//2);result.paste(small,pos)
 return result,{'sourceAlphaBounds':[l,t,r,b],'fitSize':list(size),'position':list(pos),'scale':scale}

def quantize(im,colors):
 a=np.array(im);mask=a[:,:,3]>=128
 # Small directional contours survive reduction; no dithering or invented linework.
 rgb=Image.fromarray(a[:,:,:3]).filter(ImageFilter.UnsharpMask(radius=.55,percent=65,threshold=3))
 pixels=np.array(rgb)[mask]
 swatch=Image.fromarray(pixels.reshape(1,len(pixels),3)).quantize(colors=colors,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
 q=np.array(rgb.quantize(palette=swatch,dither=Image.Dither.NONE))
 used=sorted(set(q[mask].tolist()));src_palette=swatch.getpalette();palette=[[0,0,0,0]]+[[*src_palette[k*3:k*3+3],255] for k in used]
 remap=np.zeros(256,dtype=np.uint8)
 for j,k in enumerate(used,1):remap[k]=j
 indices=remap[q];indices[~mask]=0
 indexed=Image.fromarray(indices,'P');indexed.putpalette([c for color in palette for c in color[:3]]);indexed.info['transparency']=0
 rgba=Image.fromarray(np.asarray(palette,dtype=np.uint8)[indices],'RGBA')
 return indexed,rgba,palette,indices


if __name__ == "__main__":
    raise SystemExit("Use python3 -B scripts/rebuild_pngs.py --verify-only or --write; this file is the conversion module.")
