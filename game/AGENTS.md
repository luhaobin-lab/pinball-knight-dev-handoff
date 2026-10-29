# 独立战斗场景

This is the editable standalone battle extraction from ../taptapgame-abyss-archive/game at archive commit a183844a62b4835a634c404c66f758cab531fba7.

- The requested entry opens a real composed-core battle with the original HUD, mouse input and monsters.
- Preserve source rules, numbers, rendering and UI unless the user requests changes. Do not replace the battle with the placeholder debug play scene.
- Work in this folder. The adjacent archive and spreadsheet research outputs are separate source artifacts.
- Documents under studio/ and old plan files are historical references; do not execute old schedulers, leases or Windows absolute paths.
- Keep startup configuration in src/game/battle-start.ts and standalone entry/controls in src/battle.ts.
- Validate mouse down/up, preview/contact/movement, enemy turns, UI interaction, restart and offline HTML after relevant changes. Record evidence in artifacts/ and progress.md.
- Single-file export: npm run package:battle. Node 24+ is required.
