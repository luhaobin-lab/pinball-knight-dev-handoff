"""Package the runtime PNGs separately from high-resolution authoring sources."""
from pathlib import Path
import json,hashlib,zipfile
ROOT=Path(__file__).resolve().parents[1]
def main():
 m=json.loads((ROOT/'manifest.json').read_text());assert len(m['icons'])==308 and not m['missingIds'];assert json.loads((ROOT/'qa/release-validation.json').read_text())['status']=='pass';assert json.loads((ROOT/'qa/browser-validation.json').read_text())['iconsInCatalogue']==308
 runtime=ROOT/'runtime';runtime.mkdir(exist_ok=True)
 icons=[{k:v for k,v in r.items() if k not in ['mother','prompt','sourceMetadata','approval']} for r in m['icons']]
 rm={'schemaVersion':m['schemaVersion'],'packageId':m['packageId'],'version':m['version'],'counts':{'items':175,'talents':133,'total':308},'pixelRules':m['pixelRules'],'atlases':m['atlases'],'icons':icons}
 (runtime/'manifest.json').write_text(json.dumps(rm,ensure_ascii=False,indent=2)+'\n')
 readme='''弹球骑士 · V6 手绘风像素图标 / 2026-10-29

175件物品 + 133项天赋，共308件。
pixels/256/ 为主资源；pixels/128/ 为较小尺寸备选，共616个独立透明PNG。
atlas/ 提供同一批256档图标的图集和区域表。独立图与图集是两种接入方式，选需要的一种打包进游戏。

占格与像素尺寸（宽×高）
2×1：256×128 / 128×64
2×2：256×256 / 128×128
2×3：256×384 / 128×192
天赋：256×256 / 128×128，不占装备格。

索引PNG含二值透明，sRGB。使用Nearest/Point、Clamp、关闭mipmap。
保留画布比例与透明留白，展示采用整数倍率；中心锚点(0.5,0.5)。
图集原点左上，未裁边、未旋转，4px透明padding，每边不超过2048px。
通过manifest.json中的ID取 files["256"]、files["128"]，或 atlas.page / atlas.frame。
PNG文件自身已含透明边距，不需要额外裁切主体。

manifest.json保留原始名称、功能、占格证据与未核实标记；I035原始名称继续待核实。
不要根据美术造型回填游戏数值或推断原始游戏规则。

制作方式：内置image_gen逐件参考垫图生成母稿，再等比缩放、限色与二值透明化。
这是具有手绘观感的生成式美术与算法像素化，不是逐像素人工绘制。
高分辨率母稿、提示词、参考图、生成回执及重新导出脚本保存在完整制作目录，未计入本运行时包。

验证：616张PNG尺寸/透明/哈希，308个图集区域逐像素一致；Chrome目录浏览、下载和移动显示检查。
目标游戏引擎导入、实际界面缩放与玩家辨识仍需在接入游戏时验证。
'''
 (runtime/'README.txt').write_text(readme)
 ids=' | '.join('"'+r['id']+'"' for r in icons)
 types='export type IconId = '+ids+';\nexport interface IconRecord { id: IconId; name: string; category: "item" | "talent"; slot: {columns: 2; rows: 1|2|3} | null; files: {"128": string; "256": string}; atlas: {page: string; frame: {x:number;y:number;w:number;h:number}}; description:string; sourceFlags:string[]; }\nexport interface IconManifest { version: string; counts: {items:175;talents:133;total:308}; icons: IconRecord[]; atlases: Array<{id:string;image:string;data:string;width:number;height:number}>; }\n'
 (runtime/'icons.d.ts').write_text(types)
 (ROOT/'dist').mkdir(exist_ok=True)
 dest=ROOT/'dist/pinball-knight-handdrawn-v6-runtime.zip';files=[]
 for size in ['128','256']:
  files.extend((ROOT/r['files'][size],r['files'][size]) for r in icons)
 for a in m['atlases']:
  files.extend((ROOT/a[k],a[k]) for k in ['image','data'])
 files.extend((runtime/n,n) for n in ['manifest.json','README.txt','icons.d.ts'])
 prefix='pinball-knight-handdrawn-v6'
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for path,name in sorted(files,key=lambda f:f[1]):
   info=zipfile.ZipInfo(prefix+'/'+name,(2026,10,29,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,path.read_bytes())
 with zipfile.ZipFile(dest) as z:
  assert z.testzip() is None
  for path,name in files:assert z.read(prefix+'/'+name)==path.read_bytes()
 report={'archive':str(dest.relative_to(ROOT)),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'files':len(files),'icons':308,'independentPNGs':616,'atlasPages':len(m['atlases']),'allArchiveFilesByteMatched':True,'highResolutionSourcesIncluded':False,'sourceFolder':'.'}
 (ROOT/'qa/package-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
