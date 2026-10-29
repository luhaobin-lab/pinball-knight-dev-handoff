# src/procgen/items — item models

- **Owner**: unassigned in P1 (P4 item lanes).
- **Purpose**: a small procedural 3D model for each of the ~190 items in the same toon pipeline; the same models
  feed the icons.
- **Public API (to build)**: `itemModel(itemId, rng)` returning a `THREE.Object3D`, keyed by `src/content` ids.
