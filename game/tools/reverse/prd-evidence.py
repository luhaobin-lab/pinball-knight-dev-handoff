"""Read-only extraction of contiguous native PRD routines, including chained-unwind fragments.

The historical dumper stopped at the first .pdata fragment (only46bytes for RollPRDBatch).
These bounded ranges come from core-math source analysis and end before the next unrelated routine.
This writes evidence only, never changes the binary or the probability implementation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

p = argparse.ArgumentParser()
p.add_argument('--exe', required=True)
p.add_argument('--reference-tools', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
sys.path.insert(0, str(Path(a.reference_tools) / 'pylib' / 'capstone'))
sys.path.insert(0, str(Path(a.reference_tools) / 'py'))
from capstone import Cs, CS_ARCH_X86, CS_MODE_64
from capstone.x86 import X86_OP_MEM, X86_REG_RIP
from pe import PE

pe = PE(a.exe)
out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)
md = Cs(CS_ARCH_X86, CS_MODE_64)
md.detail = True
ranges = [('batch', 0x1445a65e0, 0x1445a68f8), ('c-from-p', 0x1445ac2e0, 0x1445ac784),
          ('quantize', 0x1445b31b0, 0x1445b3542), ('rng-open-interval', 0x1445b3680, 0x1445b36db)]
manifest = {'binary': {'path': a.exe, 'bytes': len(pe.data), 'sha256': hashlib.sha256(pe.data).hexdigest()},
            'method': 'Read-only contiguous x64 ranges; unlike first .pdata fragment, includes forward branch targets. Raw disassembly is evidence, not an assertion of full decompilation.', 'routines': []}
for name, lo, hi in ranges:
    raw = pe.bytes(lo, hi-lo)
    rows = []
    for i in md.disasm(raw, lo):
        notes = []
        for op in i.operands:
            if op.type == X86_OP_MEM and op.mem.base == X86_REG_RIP:
                addr = i.address + i.size + op.mem.disp
                b = pe.bytes(addr, 8)
                if b:
                    notes.append(f'rip={addr:x} f64={struct.unpack("<d", b)[0]!r} f32={struct.unpack("<f", b[:4])[0]!r}')
        rows.append(f'{i.address:x}: {i.mnemonic:<10} {i.op_str}' + (' ; ' + '; '.join(notes) if notes else ''))
    file = out / f'{name}.asm'
    file.write_text('\n'.join(rows)+'\n', encoding='utf-8')
    manifest['routines'].append({'name': name, 'start': hex(lo), 'endExclusive': hex(hi),
      'bytes': len(raw), 'byteSha256': hashlib.sha256(raw).hexdigest(), 'instructions': len(rows),
      'file': str(file), 'textSha256': hashlib.sha256(file.read_bytes()).hexdigest()})
(out/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'routines': len(ranges), 'out': str(out), 'binarySha256': manifest['binary']['sha256']}))
