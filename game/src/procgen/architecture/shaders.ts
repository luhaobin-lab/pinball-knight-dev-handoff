/**
 * GLSL shared by the kit's material hooks and its window-light pass. All patterns are world- or
 * object-anchored (never screen noise), so they stay pixel-stable when the camera moves.
 */

export const NOISE_GLSL = /* glsl */ `
float kitHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float kitNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kitHash(i), kitHash(i + vec2(1.0, 0.0)), u.x), mix(kitHash(i + vec2(0.0, 1.0)), kitHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float kitFbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * kitNoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
float kitSegDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
// Art bible §10 M10: the lub-dub pulse of bioluminescence (0..1.6).
float kitLubDub(float t, float rate, float phase) {
  float phi = fract(t * rate + phase);
  return exp(-pow(phi / 0.05, 2.0)) + 0.6 * exp(-pow((phi - 0.2) / 0.05, 2.0));
}
`;

/**
 * Elytra stained glass (art bible §10 M7). Window-local p in [-1, 1]² (x right, y up).
 * kind 0: lancet, a pair of elytra meeting in a point, each split by slanted transverse leads;
 * kind 1: rose, a compound-eye boss of 7 facets inside a ring of elytra-pair petals (suture down the
 *         middle of each petal) with diamond panes between the petals;
 * kind 2: roundel, six petals around a hub (the glazed knothole).
 * `elytraId` returns a pane id (-1 outside the glass). The lead came is drawn wherever the id changes
 * between neighbouring pixels (`elytraLead`), so it is exactly one pixel wide at any scale.
 */
export const ELYTRA_GLSL = /* glsl */ `
float elytraId(vec2 p, float kind, float petals) {
  if (kind < 0.5) {
    const float ys = -0.3;
    const float c = 0.345;
    const float R = 1.345;
    float d = p.y < ys ? 1.0 - abs(p.x) : min(R - length(p - vec2(-c, ys)), R - length(p - vec2(c, ys)));
    if (min(d, p.y + 1.0) < 0.0) return -1.0;
    float side = p.x < 0.0 ? 0.0 : 1.0;
    float v = (p.y + 1.0) * 2.3 + side * 0.5 - abs(p.x) * 0.7;
    return side * 16.0 + floor(v);
  }
  float r = length(p);
  if (r > 1.0) return -1.0;
  float a = atan(p.y, p.x) / 6.28318 + 0.5;
  if (kind > 1.5) {
    if (r < 0.3) return 0.0;
    return 1.0 + floor(a * 6.0);
  }
  if (r < 0.14) return 0.0;
  if (r < 0.32) return 1.0 + floor(a * 6.0 + 0.5);
  float t = (r - 0.32) / 0.68;
  float sector = a * petals;
  float k = floor(sector);
  float s = fract(sector) - 0.5;
  float hw = 0.46 * pow(sin(3.14159 * clamp(t * 0.96 + 0.02, 0.0, 1.0)), 0.6);
  if (abs(s) < hw) return 16.0 + k * 2.0 + (s < 0.0 ? 0.0 : 1.0) + floor(t * 2.4) * 64.0;
  return 256.0 + k + step(0.5, t) * 64.0;
}
float elytraLead(vec2 p, vec2 dx, vec2 dy, float kind, float petals, out float id) {
  id = elytraId(p, kind, petals);
  float ix = elytraId(p + dx, kind, petals);
  float iy = elytraId(p + dy, kind, petals);
  return (id != ix || id != iy) ? 1.0 : 0.0;
}
`;
