"""Extract authored background child collision from read-only cooked components, preserving SCS ancestry."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
sys.dont_write_bytecode = True

parser=argparse.ArgumentParser()
parser.add_argument('--reference',required=True)
parser.add_argument('--out',required=True)
parser.add_argument('--typescript',required=True)
args=parser.parse_args()
root=Path(args.reference)/'dump/raw/Game'
base='CatapultHero/BP/环境/'
assets=[base+'首领房/蓝图_装饰品_首领背景A',base+'新手关/蓝图_装饰品_新手关02背景']
loaded={}
def read(asset):
    if asset not in loaded: loaded[asset]=json.loads((root/(asset+'.json')).read_text(encoding='utf-8'))
    return loaded[asset]
def idx(ref): return int(ref['ObjectPath'].rsplit('.',1)[1])
def xyz(v,default=0): return [v.get(k,default) for k in ['X','Y','Z']]
def identity():return [[1,0,0],[0,1,0],[0,0,1]]
def mul(a,b):return [[sum(a[i][k]*b[k][j] for k in range(3)) for j in range(3)]for i in range(3)]
def apply(a,v):return [sum(a[i][j]*v[j]for j in range(3))for i in range(3)]
def transform(p):
    r=p.get('RelativeRotation',{});pitch,yaw,roll=[math.radians(r.get(k,0))for k in ['Pitch','Yaw','Roll']]
    cp,sp,cy,sy,cr,sr=math.cos(pitch),math.sin(pitch),math.cos(yaw),math.sin(yaw),math.cos(roll),math.sin(roll)
    # UE FRotationMatrix basis columns: X forward,Y right,Z up (left-handed Rotator conventions).
    a=[[cp*cy,sr*sp*cy-cr*sy,-(cr*sp*cy+sr*sy)],
       [cp*sy,sr*sp*sy+cr*cy,cy*sr-cr*sp*sy],[sp,-sr*cp,cr*cp]]
    scale=xyz(p.get('RelativeScale3D',{}),1)
    return [[a[i][j]*scale[j]for j in range(3)]for i in range(3)],xyz(p.get('RelativeLocation',{}))
def compose(parent,local):
    a,p=parent;b,q=local;v=apply(a,q);return mul(a,b),[p[i]+v[i]for i in range(3)]

base_raw=read(base+'装饰品/蓝图_装饰品')
base_sprite=next(x['Properties']for x in base_raw if x['Type']=='PaperSpriteComponent')
air_raw=read(base+'蓝图_空气墙')
air_box=next(x['Properties']for x in air_raw if x['Type']=='BoxComponent')
results={}
for asset in assets:
    raw=read(asset);nodes={i:o['Properties']for i,o in enumerate(raw)if o['Type']=='SCS_Node'}
    named={p['InternalVariableName']:i for i,p in nodes.items()}
    parents={idx(c):i for i,p in nodes.items()for c in p.get('ChildNodes',[])}
    own_sprite=next((x['Properties']for x in raw if x['Type']=='PaperSpriteComponent'),{})
    sprite={**base_sprite,**own_sprite}
    def chain(i):
        p=nodes[i];component=raw[idx(p['ComponentTemplate'])];local=transform(component.get('Properties',{}))
        if i in parents:return compose(chain(parents[i]),local)
        name=p.get('ParentComponentOrVariableName')
        if name=='PaperSprite':return compose(transform(sprite),local)
        if name and name in named and named[name]!=i:return compose(chain(named[name]),local)
        return local
    children=[]
    for i,p in nodes.items():
        component=raw[idx(p['ComponentTemplate'])]
        if component['Type']!='ChildActorComponent':continue
        q=component['Properties'];cls=q['ChildActorClass']['ObjectPath'].split('.',1)[0].removeprefix('/Game/')
        matrix,position=chain(i)
        entry={'name':p['InternalVariableName'],'class':cls,'position':position,'matrix':matrix,'componentIndex':idx(p['ComponentTemplate']),'nodeIndex':i}
        if cls==base+'蓝图_空气墙':
            matrix,position=compose((matrix,position),transform(air_box));half=xyz(air_box['BoxExtent'])
            basis=[[matrix[i][j]for i in range(3)]for j in range(3)]
            extent=[math.sqrt(sum(v*v for v in b))*h for b,h in zip(basis,half)]
            units=[[v/math.sqrt(sum(x*x for x in b))for v in b]for b in basis]
            vertical=[j for j,b in enumerate(units)if abs(abs(b[2])-1)<1e-9];assert len(vertical)==1,(asset,entry)
            horizontal=[j for j in range(3)if j not in vertical];assert all(abs(units[j][2])<1e-9 for j in horizontal)
            j,k=horizontal;entry.update(position=position,half=[extent[j],extent[k]],angle=math.atan2(units[j][1],units[j][0]),zHalf=extent[vertical[0]],profile=air_box['BodyInstance'])
        children.append(entry)
    results[asset]={'children':children}

out=Path(args.out);out.mkdir(parents=True,exist_ok=False)
manifest={'method':'Cooked SCS parent chain, inherited PaperSprite transform, exact sourceBox100 extents; no AABB substitution','sources':[{ 'path':str(root/(a+'.json')),'sha256':hashlib.sha256((root/(a+'.json')).read_bytes()).hexdigest()}for a in loaded],'assets':results}
(out/'authored-components.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
ts=Path(args.typescript);assert not ts.exists(),'preserve old extraction';ts.parent.mkdir(parents=True,exist_ok=True)
ts.write_text('// Generated from read-only cooked SCS components by tools/reverse/room-components.py.\nexport const AUTHORED_COMPONENTS = '+json.dumps(results,ensure_ascii=False,indent=2)+' as const;\n',encoding='utf-8')
print(json.dumps({a:len(v['children'])for a,v in results.items()},ensure_ascii=False))
