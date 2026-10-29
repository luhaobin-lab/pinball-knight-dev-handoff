import json, sys
sys.stdout.reconfigure(encoding='utf-8')

def litval(v):
    if not isinstance(v, dict): return v
    t = v.get('Type','')
    t = t.split('::')[-1]
    if t == 'Float': return v.get('AsFloat')
    if t == 'Integer': return v.get('AsInteger')
    if t == 'Boolean': return v.get('AsBoolean')
    if t == 'String': return v.get('AsString')
    if t in ('UObject','UObjectArray'):
        return [o.get('ObjectName') if isinstance(o, dict) else o for o in v.get('AsUObject', [])]
    if t.endswith('Array'):
        return {k: v[k] for k in v if k.startswith('As') and v[k]}
    return {k: v[k] for k in v if k.startswith('As') and v[k]} or t

def dump(path):
    d = json.load(open(path, encoding='utf-8'))
    e = d[0]
    p = e['Properties']
    doc = p['RootMetasoundDocument']
    rg = doc.get('RootGraph', {})
    print('####', path, '| Duration', p.get('Duration'), '| MaxDistance', p.get('MaxDistance'), '| Concurrency', [c.get('ObjectName') for c in p.get('ConcurrencySet', [])], '| Atten', (p.get('AttenuationSettings') or {}).get('ObjectName'))
    deps = {}
    for dep in doc.get('Dependencies', []):
        meta = dep.get('Metadata', {})
        cn = meta.get('ClassName', {})
        deps[dep.get('ID')] = '%s.%s.%s' % (cn.get('Namespace'), cn.get('Name'), cn.get('Variant'))
    graph = rg.get('Graph') or {}
    if not graph:
        pgs = rg.get('PagedGraphs') or []
        if pgs: graph = pgs[0]
    nodes = graph.get('Nodes', [])
    vname = {}   # vertex id -> (nodename, vertexname)
    nname = {}
    for n in nodes:
        nid = n.get('ID')
        nm = n.get('Name')
        nname[nid] = '%s#%s' % (nm, str(nid)[:4])
        itf = n.get('Interface', {}) or {}
        for i in itf.get('Inputs', []) or []:
            vname[(nid, i.get('VertexID'))] = (nm, i.get('Name'))
        for o in itf.get('Outputs', []) or []:
            vname[(nid, o.get('VertexID'))] = (nm, o.get('Name'))
    # graph inputs with defaults
    iface = rg.get('Interface', {})
    for inp in iface.get('Inputs', []):
        dl = inp.get('Defaults') or inp.get('DefaultLiteral')
        if isinstance(dl, list) and dl: dl = dl[0].get('Literal')
        print('  IN', inp.get('Name'), inp.get('TypeName'), litval(dl))
    for n in nodes:
        cls = deps.get(n.get('ClassID'), '?')
        if cls.startswith('Input.') or cls.startswith('Output.'): continue
        lits = []
        for vi in n.get('InputLiterals', []) or []:
            vn = vname.get((n.get('ID'), vi.get('VertexID')), ('?','?'))[1]
            lits.append('%s=%s' % (vn, litval(vi.get('Value'))))
        print('  NODE [%s] %s :: %s' % (nname[n.get('ID')], cls, '; '.join(lits)))
    for ed in graph.get('Edges', []):
        a = vname.get((ed.get('FromNodeID'), ed.get('FromVertexID')), (None, '?'))
        b = vname.get((ed.get('ToNodeID'), ed.get('ToVertexID')), (None, '?'))
        print('  EDGE %s.%s -> %s.%s' % (nname.get(ed.get('FromNodeID')), a[1], nname.get(ed.get('ToNodeID')), b[1]))

for p in sys.argv[1:]:
    dump(p)
