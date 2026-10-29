Original prompt: 从已拉取的GitHub游戏项目中提取完整单文件HTML，打开直接进入独立战斗场景，保留完整UI、鼠标瞄准和正确弹射反弹、怪物，用于后续开发。

2026-10-28
- Source: ../taptapgame-abyss-archive/game, archive commit a183844a62b4835a634c404c66f758cab531fba7.
- Copied into this independent development folder. Original archive source is preserved.
- Existing debug play scene uses placeholder combat. This extraction uses composeGame + the real Shell and legitimate boot commands.
- Target: direct combat entry, native HUD and inventory, mouse release launch, wall/enemy contact, enemy turns, offline file opening, restart.
- Completed: real-core startup helper, standalone entry, restart/fullscreen, offline single-file export, source checks and real mouse QA.

Validation checkpoint
- Fixed a pre-existing pause routing omission in the extracted copy only: menu.close is accepted for warning type 0 and dispatched to the existing close handler; type 2 resume decisions stay blocked.
- 256 relevant tests passed; full-project and DOM-free core TypeScript checks passed.
- Chrome file:// at 1920x1080 and 1280x720: direct battle, visible hero/enemies, tooltip/context menu, press/release input, wall and enemy collision paths, HP changes, turn advance, pause/resume, fullscreen, restart, defeat boundary and restart after defeat passed. No page errors or external requests.
- Independent initial-state wall and enemy/wall launches both produced 4 contacts and matched their preview endpoints (delta 0). Later launches may legitimately be interrupted by surviving enemy projectiles; tests reset independent scenarios.
- Develop-web-game client executed with its browser-launch path adapted to installed Chrome. Final screenshot and text state inspected.
- Output: delivery/独立战斗场景.html. Source and validation metadata: SOURCE_AND_VALIDATION.json.

- Independent victory flow passed: 2 real mouse launches cleared 3 enemies, native victory Continue, loot close, standalone battle-complete overlay, and restart restored HP180 / 3 enemies / initial equipment. No browser errors or network requests.
- No outstanding extraction blockers. Future feature work starts in this standalone folder.
