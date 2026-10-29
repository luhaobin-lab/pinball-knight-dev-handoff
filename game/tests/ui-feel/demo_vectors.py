# Hand reference for tests/ui-feel/*.test.ts, computed from the Demo dump without the TS code: UMG widget animation
# channels (FMovieSceneFloatChannel: ticks of 1/60000 s, tangents per tick, weighted handles solved for time by
# bisection) evaluated like UE, at the times the tests sample.
# Run: python -I tests/ui-feel/demo_vectors.py "D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI"
import json, math, os, sys
sys.stdout.reconfigure(encoding='utf-8')
root = sys.argv[1]
TICK = 60000.0

def channel(widget, anim, target, prop):
    d = json.load(open(os.path.join(root, widget + '.json'), encoding='utf-8'))
    a = next(x for x in d['animations'] if x['name'] == anim + '_INST')
    lo = a['playback_range']['Value']['LowerBound']['Value']['Value']
    for b in a['bindings']:
        if b['widget'] != target: continue
        for tr in b['tracks']:
            for sec in tr['sections']:
                c = sec['properties'].get(prop)
                if c and c.get('Times'):
                    keys = []
                    for t, v in zip(c['Times'], c['Values']):
                        tg = v['Tangent']
                        keys.append(dict(t=t['Value'] / TICK, v=v['Value'], im=v['InterpMode'], arr=tg['ArriveTangent'] * TICK, lea=tg['LeaveTangent'] * TICK,
                                         aw=tg['ArriveTangentWeight'], lw=tg['LeaveTangentWeight'], wm=tg['TangentWeightMode']))
                    return lo / TICK, keys
    raise KeyError((widget, anim, target, prop))

def bez(p0, p1, p2, p3, s):
    u = 1 - s
    return u * u * u * p0 + 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s * p3

def ev(keys, t):
    if t <= keys[0]['t']: return keys[0]['v']
    if t >= keys[-1]['t']: return keys[-1]['v']
    for a, b in zip(keys, keys[1:]):
        if a['t'] <= t < b['t']: break
    d = b['t'] - a['t']; al = (t - a['t']) / d
    if a['im'] == 1: return a['v']
    if a['im'] == 0: return a['v'] + (b['v'] - a['v']) * al
    if a['wm'] in (0, 1) and b['wm'] in (0, 2):
        return bez(a['v'], a['v'] + a['lea'] * d / 3, b['v'] - b['arr'] * d / 3, b['v'], al)
    def handle(tan, w, weighted):
        return w if weighted else math.sqrt(d * d + (tan * d) ** 2) / 3
    ang1 = math.atan(a['lea']); w1 = handle(a['lea'], a['lw'], a['wm'] in (2, 3))
    ang2 = math.atan(b['arr']); w2 = handle(b['arr'], b['aw'], b['wm'] in (1, 3))
    x1 = math.cos(ang1) * w1 / d; y1 = a['v'] + math.sin(ang1) * w1
    x2 = (d - math.cos(ang2) * w2) / d; y2 = b['v'] - math.sin(ang2) * w2
    lo, hi = 0.0, 1.0
    for _ in range(100):
        m = (lo + hi) / 2
        if bez(0, x1, x2, 1, m) < al: lo = m
        else: hi = m
    return bez(a['v'], y1, y2, b['v'], (lo + hi) / 2)

def at(spec, elapsed):
    lo, keys = channel(*spec)
    return ev(keys, lo + elapsed)

CASES = {
    '弹出V2 dy': ('UI_伤害提示', '弹出V2', '背景', 'Translation[1]'),
    '弹出V2 scale': ('UI_伤害提示', '弹出V2', '背景', 'Scale'),
    '弹出V2 opacity': ('UI_伤害提示', '弹出V2', '背景', 'FloatCurve'),
    '数值更新 scale': ('UI_伤害提示', '数值更新', 'HorizontalBox_0', 'Scale'),
    '回合统计出现 opacity': ('UI_主界面', '回合统计出现', '回合统计', 'FloatCurve'),
    '回合统计出现 scaleX': ('UI_主界面', '回合统计出现', '回合统计', 'Scale'),
    '回合统计出现 scaleY': ('UI_主界面', '回合统计出现', '回合统计', 'Scale[1]'),
    '回合统计结束 opacity': ('UI_主界面', '回合统计结束', '回合统计', 'FloatCurve'),
    '评级更新 rank dy': ('UI_主界面', '评级更新', '评级图片切换', 'Translation[1]'),
    '评级更新 rank scale': ('UI_主界面', '评级更新', '评级图片切换', 'Scale'),
    '更新闪烁 bar scaleX': ('UI_回合统计词条', '更新闪烁', 'Image_30', 'Scale'),
    '更新闪烁 bar alpha': ('UI_回合统计词条', '更新闪烁', 'Image_30', 'AlphaCurve'),
    '更新闪烁 row scaleY': ('UI_回合统计词条', '更新闪烁', 'HorizontalBox', 'Scale[1]'),
    '拾取 向下弹出 dy': ('UI_拾取提示', '向下弹出', '背景', 'Translation[1]'),
}
TIMES = {
    '弹出V2 dy': [0, 0.025, 0.05, 0.1, 0.125, 0.2, 0.3, 0.5, 1.0, 1.5, 1.8, 2.0],
    '弹出V2 scale': [0, 0.05, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 1.5, 1.75, 2.0],
    '弹出V2 opacity': [0, 0.025, 0.05, 1.6, 1.8, 2.0],
    '数值更新 scale': [0, 0.05, 0.1],
    '回合统计出现 opacity': [0, 0.05, 0.1, 0.25],
    '回合统计出现 scaleX': [0, 0.05, 0.0989, 0.15, 0.25],
    '回合统计出现 scaleY': [0, 0.05, 0.0989, 0.15, 0.25],
    '回合统计结束 opacity': [0, 1.0, 1.5, 2.0, 2.5, 3.0],
    '评级更新 rank dy': [0, 0.1, 0.2],
    '评级更新 rank scale': [0, 0.1, 0.2],
    '更新闪烁 bar scaleX': [0, 0.05, 0.1, 0.3, 0.6, 1.0],
    '更新闪烁 bar alpha': [0, 0.05, 0.1, 0.3, 0.6, 1.0],
    '更新闪烁 row scaleY': [0, 0.1, 0.2, 0.3],
    '拾取 向下弹出 dy': [0, 0.5, 1.0, 1.5],
}
for name, spec in CASES.items():
    print(name, ' '.join('%g:%.6f' % (t, at(spec, t)) for t in TIMES[name]))
