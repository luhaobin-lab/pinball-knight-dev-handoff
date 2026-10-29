# src/render/atmos — atmosphere

- **Owner**: `p1-gi-atmos`.
- **Purpose**: volumetric spore fog, god rays through the elytra windows, drifting dust, all quantized to the
  pixel grid; the boss-room light shafts are the signature shot.
- **Public API (to build)**: e.g. `installAtmosphere(renderer, options) → { settings, dispose }` registering its
  passes. Biome presets (fog colour, density, shaft directions) are plain data in the options.

## How it plugs in (see ../README.md "Passes")

- In-scattering onto the lit image: a `lighting` pass with `0 < order < 1000` (after the resolve, before the
  forward layer) blending into `targets.lit`; read `ctx.gbuffer.depth` for fog distance and `renderer.lights` /
  `ctx.lighting` for the light that scatters.
- Screen-space shafts or glow that should also bloom: a `post` pass with `0 < order < 100` (after outlines,
  before bloom), reading `ctx.input` and writing every pixel of `ctx.target`, or `inPlace: true` to blend on top.
- Keep it pixel-stable: dither with `blueNoiseTexture()` (64×64, `texelFetch(t, (px + origin) & 63, 0).r`)
  offset by `ctx.pixelOrigin`, and march at internal resolution or lower.
- Tests go to `tests/p1-gi-atmos/`; debug scenes to `src/debug/scenes/p1-gi-atmos-*.ts`.
