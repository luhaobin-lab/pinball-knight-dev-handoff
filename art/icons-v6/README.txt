弹球骑士 · 正式 V6 手绘风像素图标交接

308件：175物品、133天赋；616张独立透明PNG；7张256档图集。
直接打开 index.html 可离线搜索、分类、查看两种尺寸与下载单图。
PNG、图集、manifest.json 和 catalog.js 已完成复制；本轮没有重新生成美术。
UI v10 与本图标库尚未接入 game/ 的实际界面。接入状态见项目根说明。

交付布局
  pixels/256/：主图，宽256；按2×1/2×2/2×3占格高128/256/384。天赋高256。
  pixels/128/：兼容档，宽128；高64/128/192。天赋高128。
  atlas/：透明图集和左上原点坐标表；不裁边、不旋转，4px padding。
  manifest.json / catalog.js：完整索引，可脱离母稿独立使用。
  runtime/manifest.json / runtime/icons.d.ts：精简接入清单和类型。
  data/briefs.json：原名称、功能、占格、证据与未知项；不按造型补写机制。
  data/approved-anchor-hashes.json：三件原获认可锚点的冻结哈希。
  prompts/ / references/ / receipts/：逐件提示词、实际参考及来源、生成job与哈希。
  qa/：原制作检查、淘汰稿、接手复制与跨机验证记录。
  scripts/ / requirements.txt：离线导出、索引、图集、校验和打包工具。
  mothers/：308张完整生成透明母稿。完整交接ZIP包含；Git仓库通过独立Release附件提供。

跨机接手、离线重建与修改流程：阅读 制作与接入说明.txt。
GitHub Release：
  https://github.com/luhaobin-lab/pinball-knight-dev-handoff/releases/tag/handoff-2026-10-29
只克隆仓库即可使用已有PNG与索引。需要重建时下载 icon-mothers.zip，
将其中 mothers/ 解压到本目录，使 mothers/I001.png 等路径存在。

本轮保留V5用户认可的I005眼球杖、I047血契战盾、I106生命药剂。
其余305件使用内置image_gen逐件参考生成母稿，再按获认可算法等比缩放、限色、二值透明化。
这是生成式手绘观感和算法像素化，不是逐像素人工绘制。
收录的官方裁图用于追溯视觉参考，不属于本游戏运行时资源。

验证边界
文件哈希、透明、图集及浏览器目录检查不等同于目标引擎导入或玩家辨识测试。
I035名称与其他sourceFlags继续保留原始未核实状态。
