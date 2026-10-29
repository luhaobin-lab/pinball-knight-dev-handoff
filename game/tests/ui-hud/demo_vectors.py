# Hand reference for tests/ui-hud/popups.test.ts, computed from the Demo dump without the TS code:
# UE FRichCurve (cubic, unweighted keys) on 曲线表's 伤害提示曲线 / 恢复提示曲线, GetRotated2D and the FClamp of
# UI_伤害提示 L4027 / UI_治疗提示 L3687, in 1920x1080 units x 0.5.
# Run: python -I tests/ui-hud/demo_vectors.py "D:/TAPTAPGAME_ref/dump/curves/CatapultHero/BP/曲线表.json"
import json, math, sys
sys.stdout.reconfigure(encoding='utf-8')
rows = json.load(open(sys.argv[1], encoding='utf-8'))['curves'][0]['rows']

def bezier(p0, p1, p2, p3, a):
    l = lambda x, y: x + (y - x) * a
    p01, p12, p23 = l(p0, p1), l(p1, p2), l(p2, p3)
    return l(l(p01, p12), l(p12, p23))

def ev(name, t):
    k = rows[name]['Keys']
    if t <= k[0]['Time']: return k[0]['Value']
    if t >= k[-1]['Time']: return k[-1]['Value']
    for a, b in zip(k, k[1:]):
        if a['Time'] <= t < b['Time']:
            d = b['Time'] - a['Time']
            p0, p3 = a['Value'], b['Value']
            p1 = p0 + a['LeaveTangent'] * d / 3
            p2 = p3 - b['ArriveTangent'] * d / 3
            return bezier(p0, p1, p2, p3, (t - a['Time']) / d)

def rot(y, deg):  # GetRotated2D((0, y), deg) = (C*0 - S*y, S*0 + C*y)
    s, c = math.sin(math.radians(deg)), math.cos(math.radians(deg))
    return (-s * y, c * y)

clamp = lambda v, lo, hi: max(lo, min(hi, v))
K = 0.5  # 1920x1080 units -> our 960x540 px

def target(sx, sy, vy, deg, bounds=None):
    rx, ry = rot(vy, deg)
    tx, ty = sx + rx * K, sy + ry * K
    if bounds: tx, ty = clamp(tx, bounds[0], bounds[1]), clamp(ty, bounds[2], bounds[3])
    return tx, ty

B960 = (485 * K, 1792 * K, 128 * K, 952 * K)
top = (768 - 540) // 2
B1366 = (485 * K, 1366 - 128 * K, top + 128 * K, top + 952 * K)
print('bounds 960', B960, 'bounds 1366x768', B1366)
for t in (0.1, 0.25, 0.42, 0.5, 0.8, 1.0, 2.0):
    print('伤害提示曲线', t, repr(ev('伤害提示曲线', t)))
for t in (0.25, 0.5, 0.8, 1.0):
    print('恢复提示曲线', t, repr(ev('恢复提示曲线', t)))

def lerp(s, t, a): return s + (t - s) * a
# A: first number of a 135-tall target (弑神幼虫), stack 0, 旋转 90
tx, ty = target(500, 300, 135 - 48 * 0, 90, B960)
print('A target', tx, ty, 'x@0.5', lerp(500, tx, ev('伤害提示曲线', 0.5)))
# B: stack 3 on the hero (高度 56), 旋转 0
print('B target', target(600, 300, 56 - 48 * 3, 0, B960))
# C: clamps
print('C left', target(250, 150, 56 - 48 * 5, -90, B960), 'bottom', target(500, 450, 135, 0, B960))
# D: wide layer 1366x768
print('D', target(1290, 600, 135, -90, B1366))
# E: heal, stack 3, 旋转 40 (no 高度), 位移计数 = 0.5 t
tx, ty = target(600, 300, -48 * 3, 40, B960)
a = ev('恢复提示曲线', 0.5 * 1.0)
print('E target', tx, ty, 'pos@1s (fan only)', lerp(600, tx, a), lerp(300, ty, a))
# delays Fraction(n * 0.15)
print('delays', [(n, (n * 0.15) % 1) for n in (0, 1, 2, 6, 7, 12)])

# widget lifts (linear tracks of the existing animations, widget px x 0.5)
def track(times, values, t):
    if t <= times[0]: return values[0]
    for i in range(1, len(times)):
        if t <= times[i]:
            u = (t - times[i-1]) / (times[i] - times[i-1]); return values[i-1] + (values[i] - values[i-1]) * u
    return values[-1]
V2 = ([0, 0.05, 0.167, 0.5, 1.5, 2.0], [-0.75, 15, -8.68, -34.19, -36.93, -30.85])
HEALDY = ([0.008, 0.123, 0.267, 1.367, 1.7], [0, 20.49, -1.95, -9.16, 30])
lift = lambda tr, t: track(*tr, t) * K
print('A y@0.5', 300 + lift(V2, 0.5), 'A x@0.1', lerp(500, 432.5, ev('伤害提示曲线', 0.1)), 'A x@0.25', lerp(500, 432.5, ev('伤害提示曲线', 0.25)), 'A x@0.8', lerp(500, 432.5, ev('伤害提示曲线', 0.8)))
print('B y@1.5', 256 + lift(V2, 1.5))
print('C left y@1.0', 150 + lift(V2, 1.0), 'C bottom y@1.5', 476 + lift(V2, 1.5))
print('D y@1.0', 590 + lift(V2, 1.0))
tx, ty = target(600, 300, -48 * 3, 40, B960)
a = ev('恢复提示曲线', 0.5)
print('E y@1.0', lerp(300, ty, a) + lift(HEALDY, 1.0))
# card spread box for potion-a (row 0, size 1): centre (190, 346) units, +-100 across, +-48 along, SIDE x0.375, origin -8
print('card box px', ((190 - 100 - 8) * 0.375, (190 + 100 - 8) * 0.375), ((346 - 48) * 0.375, (346 + 48) * 0.375))
