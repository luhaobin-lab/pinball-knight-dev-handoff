# src/anim — animation timelines

- **Owner**: the `creatures` lane.
- **Purpose**: animation data and small helpers that take time explicitly and never read clocks, so fixed-time
  stills (`?t=`) reproduce.
- `curve.ts`: `evalCurve(keys, t)` for the Demo's keyed curves (UE FRichCurve keys without tangent weights and
  MovieScene channels: cubic Hermite with the keys' tangents, linear, constant), `mapRangeClamped`, `flipbookFrame`.
- `reactions.ts`: the Demo's timelines with their dump sources: 可控反弹动画 (`recoilTrack`, `recoilUu`), 反弹动画2
  (`squashWidth`, `squashHeight`), 闪烁 (`FLASH_SECONDS`, `blinkOn`), 角色死亡 (`deathFrame`, `SPLAT_AT`,
  `corpseTint`, `DEATH_SECONDS`), 回旋斩 (`slashFrame`). Ages are game seconds: the hit-stop slows them when the
  caller advances them with the dilated game dt.
