# src/procgen/materials — material library

- **Owner**: `p1-materials`.
- **Purpose**: the palette ramps and surface looks of the art bible, built on `createToonMaterial` from
  `src/render/api.ts`: stone, bone, chitin and iridescent thin-film elytra, translucent wax, gold leaf,
  bioluminescent fungus, black water. Looks that need more than a ramp use `hooks` (GLSL) or a custom G-buffer
  `ShaderMaterial` (`TOON_GBUFFER_GLSL` + `registerRamp`), not screen-space tricks.
- **Public API (to build)**: named palettes (`RAMPS.stone`, ..., dark to light) and factories such as
  `stoneMaterial(options)` returning a `ToonMaterial`, shared per look so the ramp atlas (255 rows) is not
  exhausted.
