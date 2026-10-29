# src/procgen/props — props and set dressing

- **Owner**: `p1-architecture`.
- **Purpose**: candles and candelabra, reliquaries, coffins, urns, funeral flowers and ribbons, bones, cobwebs,
  hanging roots, fungus clusters, and the breakable combat props that `spec/` defines.
- **Public API (to build)**: `makeProp(kind, rng, options)` returning `{ object, lights: PointLightOptions[],
  update?(dt) }`. Glowing parts use the toon `emissive` and, if they light the room, a point light.
