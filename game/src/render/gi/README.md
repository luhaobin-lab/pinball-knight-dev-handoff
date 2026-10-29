# src/render/gi — floor-plane global illumination

- **Owner**: `p1-gi-atmos`.
- **Purpose**: 2D radiance-cascades GI on the floor plane: soft coloured bounce light from candles, fungi and
  emissive surfaces, bleeding over the stone and blocked by walls (soft shadows).
- **Public API (to build)**: one installer, e.g. `installGI(renderer, options) → { pass, dispose }`, that
  registers lighting-stage passes. Everything else stays internal to this folder.

## How it plugs in (see ../README.md "Lighting contract")

- Register `renderer.addPass('lighting', { name: 'gi-…', order: < 0, … })`. Passes with a negative order draw
  into `ctx.target` = `targets.irradiance` (RGBA16F, cleared every frame) **before** the resolve. Use additive
  blending. Irradiance is in the same units and colours as point lights: the resolve adds it to the light value
  before picking the ramp band, so it changes both band and tint.
- Inputs available every frame: `ctx.gbuffer` (`emissive` for emitters, `normal` + `depth` to tell floor from
  walls and to reconstruct world positions), `ctx.camera` (snapped, current matrices), `renderer.lights`
  (positions, colours, radii, flicker live in the handles), `ctx.pixelOrigin` for world-locked dithering.
- Own targets at any resolution are fine (allocate them in `setSize`). A top-down orthographic render of the
  room's occluders and emitters into your own targets is the expected source for the cascades.
- The resolve still adds the unshadowed point lights. If GI should take over direct floor lighting (to get
  shadows), request an api change through `needs` (e.g. a light flag the resolve skips) instead of editing the
  resolve.
- Debug: show your buffers when `ctx.debugView === 'irradiance'` (the canvas shows `targets.irradiance`).
- Tests go to `tests/p1-gi-atmos/`; debug scenes to `src/debug/scenes/p1-gi-atmos-*.ts`.
