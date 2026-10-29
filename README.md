# 弹球骑士 · 开发交接包

2026-10-29 冻结快照。整理已有游戏原型、设计、研究和美术，供另一台电脑接手。

**当前基线：UI 第十版 + ICON v6 + GDD 基础规则及100怪/50附魔扩展。游戏目前仍是可操作的独立单场战斗；这些新设计和新美术尚未接入游戏。**

- [离线总入口](index.html)：下载后双击，查看所有成果。
- [精简开发 ZIP（推荐换电脑）](https://github.com/luhaobin-lab/pinball-knight-dev-handoff/releases/download/handoff-2026-10-29/pinball-knight-development-lite.zip)
- [完整资料 ZIP（含研究证据和制作沿革）](https://github.com/luhaobin-lab/pinball-knight-dev-handoff/releases/download/handoff-2026-10-29/pinball-knight-complete-handoff.zip)
- [AI 接手 prompt](AI接手Prompt.txt)
- [项目进度与下一步](docs/项目进度与下一步.txt)
- [目录与版本权威](docs/目录与版本权威.txt)

## 快速启动

运行游戏使用 Node.js 24 或更高版本；校验/重新打包使用Python 3.10+。图标复产的Pillow依赖见 `art/icons-v6/requirements.txt`。在 `game/` 执行：

```sh
npm ci
npx playwright install chromium
npm run dev
```

Vite 默认使用 `http://127.0.0.1:5190`；若端口被占用，以终端实际地址为准。
也可直接打开 `game/delivery/独立战斗场景.html`，无需安装依赖。

```sh
npm run check
npm run package:battle
node tools/battle-smoke.mjs
```

**验证边界：TypeScript检查通过；全量Vitest存在已知基线失败，详情和复跑结果见下方验证报告。不能将本包称为全量测试全绿。**

下载后可在仓库根运行 `python3 tools/verify_handoff.py` 核对文件完整性；高分辨率原始母图不在任何公开包中。本校验用于冻结交接快照，修改项目后哈希变化是预期行为。

浏览器验证支持 `CHROME_PATH` 环境变量，未设置时优先使用 Playwright 的 Chromium。详细说明及本次实测结果见 `docs/game-validation.txt`。

## 文件导航

| 目录 | 内容与状态 |
|---|---|
| `game/` | 可编辑 Three.js/TypeScript/Vite 战斗代码、测试、单文件HTML；旧UI和旧循环 |
| `design/GDD_基础规则/` | 核心循环、存档、永久成长、商店、锻造、配置与算法 |
| `design/怪物100种设计/` | 80普通+20精英、JSON/CSV/XLSX、生成规则及算法；尚待运行实现 |
| `design/附魔格50种/` | 50种附魔，五档；以正式数据和规则审计为依据 |
| `art/ui-v10/` | 用户保留的12张3200×1440完整画面、提示词、参考、生成记录 |
| `art/icons-v6/` | 175物品+133天赋、透明PNG、图集、清单、提示词与处理脚本 |
| `research/` | 视频提取结果、证据截图、原型数据与来源说明 |
| `archive/` | 旧方向和第九版参考，只供追溯，不能当新任务执行 |
| `docs/` | 制作方法、权威次序、清理记录、验证边界及接手事项 |
| `tools/` | 完整性校验和打包脚本 |

精简ZIP保留开发源码、正式设计、12张最终UI和像素图标，省去旧稿与大批研究截图；完整资料ZIP与Git包含制作沿革。

按用户最新要求，499MB高分辨率图标母图不公开分发。直接复用308张256宽像素PNG作为编辑母版，合计5,776,676字节；两档616张PNG合计7,353,442字节，没有再复制一套母图。原始大母图留在原电脑。2.3GB原始录屏保留在原电脑，未重复公开；已提取的数据、731个资料文件和证据截图在研究目录。详情见清理报告。

公开可读不等于全部材料使用同一许可证。研究参考与生成资产已分开标识，字体保留原许可；见 `THIRD_PARTY_NOTICES.txt`。

重新制作两种交接ZIP：仅在完整资料目录或Git克隆的仓库根执行 `python3 tools/package_release.py --out ../handoff-release`。输出目录必须在项目之外，脚本会同时生成文件清单和ZIP的SHA256校验值。公开包始终排除高分辨率图标原稿。
