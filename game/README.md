# 独立战斗场景

打开 `delivery/独立战斗场景.html` 即可进入可操作的战斗。代码、字体、界面和程序化场景已打包进一个 HTML，无需启动服务器或联网。已在本机 Chrome 验证。

## 操作

- 移动鼠标瞄准，左键按下后松开发射；碰撞由原项目的真实战斗核心计算。
- 悬停装备查看说明，右键打开物品菜单。
- Esc 打开或关闭暂停窗口。
- 点击右下角“重开本场”或按 R，恢复同一个房间与初始配置。
- 点击“全屏”或按 F 切换全屏。

默认使用种子 1：幽冥骑士进入第 4 层普通战斗房，面对 3 只齐刘海，带有凝血毒剂、灵魂香菇、淬毒利刃。启动程序通过原游戏的合法操作完成前置选人、开箱和选房；出现战斗画面后由玩家控制。退出该房间后显示本场结束，可重新开始。

## 继续开发

需要 Node.js 24 或更高版本。在此目录执行：

```sh
npm ci
npm run dev
```

修改源码后重新导出单文件：

```sh
npm run package:battle
```

输出会更新 `delivery/独立战斗场景.html`。

| 路径 | 作用 |
| --- | --- |
| `src/main.ts` | 默认进入独立战斗的入口 |
| `src/battle.ts` | 完整 Shell 启动、重开、全屏、单场结束处理 |
| `src/game/battle-start.ts` | 通过原游戏合法操作准备初始战斗 |
| `src/game/loop.ts` | 原项目的输入、UI、场景与动画连接 |
| `src/core/` | 战斗、弹射、怪物回合、数值和物品逻辑 |
| `src/ui/` | 原项目 UI 和提示框 |
| `src/render/`、`src/procgen/` | 渲染与程序化美术 |
| `artifacts/battle-smoke/` | 实际鼠标操作验证记录与截图 |

运行启动和暂停回归检查：

```sh
npm exec vitest -- run tests/battle-start.test.ts tests/battle-pause.test.ts --maxWorkers=4
```

`tools/battle-smoke.mjs` 打开导出的 HTML，通过真实鼠标操作检查 UI、发射、碰撞、回合、重开及窗口尺寸。浏览器默认使用 Playwright Chromium；首次使用可执行 `npx playwright install chromium`。如需已有浏览器，设置 `CHROME_PATH` 或兼容变量 `BATTLE_CHROME_PATH`；也可用 `BATTLE_BROWSER_CHANNEL=chrome` 选择已安装 Chrome。工具不再写死某台 Mac 的浏览器路径。`tools/skill-web-game-client.mjs` 使用同一选择规则。

交接包的当前验证见 [game-validation.txt](../docs/game-validation.txt)。独立战斗相关定点检查和鼠标 smoke 已完成；全量 `npm run check` 仍有来源基线失败与外部伪码依赖，不能视为全绿。不要运行依赖旧提取目录的 `data:import`。

本次工具迁移没有修改 `src/`。运行时仍为原有独立战斗 UI；`art/ui-v10` 的新版 UI 图片是设计参考，尚未集成到游戏。

## 来源与修改

来源为 `FilthyFrost/taptapgame-abyss-archive` 的 `game/`，仓库提交 `a183844a62b4835a634c404c66f758cab531fba7`。这是该仓库原型的独立战斗提取版。

保留原项目的战斗、怪物、装备和 UI。新增独立入口及场景控制；另修复原项目普通暂停窗口漏接 `menu.close` 的问题，使 Esc 与关闭按钮可恢复战斗。普通冒险存档不参与此场景。

`studio/`、旧方案和历史测试说明用于来源追溯，其中的 Windows 路径、自动化任务和旧验收状态不代表当前工作环境。当前入口不使用带占位伤害的 `scene=play` 展示场景。
