# src/procgen/textures — procedural textures

- **Owner**: `p1-materials`.
- **Purpose**: textures generated at runtime (`THREE.DataTexture`, seeded from `src/core/rng.ts`): stone grain,
  mycelium, gill patterns, wax, chitin, elytra glass, decal masks, noise fields. Never image files.
- **Public API (to build)**: pure generators returning texture data (typed array + size), plus small wrappers
  that create cached `DataTexture`s, so the data side is testable in Node.
