# src/procgen/architecture — crypt architecture kit

- **Owner**: `p1-architecture`.
- **Purpose**: the gothic necropolis grown from living things: floors with mycelium sigils, walls,
  mushroom-stem arches, chitin and bone rib vaults, elytra stained-glass windows, gill rose windows, stairs and
  doors, one kit per biome. Geometry is merged per material and uses `src/procgen/materials`.
- **Public API (to build)**: builders such as `buildRoom(layout, rng, biome)` returning `{ group, lights:
  PointLightOptions[], bounds }`, where `layout` comes from the core map generator (P2), plus the pieces of the
  north-star room.
