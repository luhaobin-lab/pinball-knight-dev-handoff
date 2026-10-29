"""Read-only, isolated native probability oracle; never load or launch the original game.

The native batch/quantizer are copied into private memory with their relative layout.
Only documented numeric routines execute. CRT log/log1p are resolved from the local CRT;
the native injected random callback is deterministic. No original files are written.
"""
import argparse
import ctypes as c
import hashlib
import json
import struct
import sys
from pathlib import Path

sys.dont_write_bytecode = True

p=argparse.ArgumentParser()
p.add_argument('--exe', required=True)
p.add_argument('--reference-tools', required=True)
p.add_argument('--out', required=True)
p.add_argument('--inspect-only', action='store_true')
a=p.parse_args()
sys.path.insert(0,str(Path(a.reference_tools)/'py'))
sys.path.insert(0,str(Path(a.reference_tools)/'pylib'/'capstone'))
from pe import PE
from capstone import Cs,CS_ARCH_X86,CS_MODE_64
from capstone.x86 import X86_OP_MEM,X86_REG_RIP
pe=PE(a.exe)
expected='ccd1db79c2eb3668242c4c10d271234963bc9dc1efa3ec0afddace444d1afcab'
assert hashlib.sha256(pe.data).hexdigest()==expected,'binary differs from reviewed source'
imports={}
lf=struct.unpack_from('<I',pe.data,0x3c)[0]
opt=lf+24
imp_rva=struct.unpack_from('<I',pe.data,opt+112+8)[0]
addr=pe.image_base+imp_rva
while True:
    original,stamp,chain,name,first=struct.unpack('<IIIII',pe.bytes(addr,20))
    if not any([original,stamp,chain,name,first]):break
    dll=pe.cstr(pe.image_base+name)
    n=0
    while (thunk:=pe.u64(pe.image_base+(original or first)+n*8)):
        imports[pe.image_base+first+n*8]=(dll,pe.cstr(pe.image_base+thunk+2) if thunk>>63==0 else f'ordinal:{thunk&0xffff}')
        n+=1
    addr+=20
md=Cs(CS_ARCH_X86,CS_MODE_64)
info={'binarySha256':expected,'imports':{hex(k):imports.get(k) for k in [0x146aeda68,0x146aedf88,0x146aed980]},'logThunk':[f'{i.address:x}: {i.mnemonic} {i.op_str}' for i in md.disasm(pe.bytes(0x146a3a18a,16),0x146a3a18a)]}
out=Path(a.out)
out.mkdir(parents=True,exist_ok=False)
(out/'imports.json').write_text(json.dumps(info,indent=2),encoding='utf8')
print(json.dumps(info))
if a.inspect_only:sys.exit(0)
assert imports[0x146aeda68][1]=='log1p'
assert imports[0x146aed980][1]=='log'
assert imports[0x146aedf88][1]=='rand'

kernel=c.WinDLL('kernel32',use_last_error=True)
kernel.VirtualAlloc.argtypes=[c.c_void_p,c.c_size_t,c.c_ulong,c.c_ulong]
kernel.VirtualAlloc.restype=c.c_void_p
kernel.VirtualProtect.argtypes=[c.c_void_p,c.c_size_t,c.c_ulong,c.POINTER(c.c_ulong)]
kernel.VirtualFree.argtypes=[c.c_void_p,c.c_size_t,c.c_ulong]
lo,hi=0x1445a0000,0x146fd0000
memory=kernel.VirtualAlloc(None,hi-lo,0x3000,0x04)
assert memory, c.get_last_error()
at=lambda va:memory+va-lo
crt=c.CDLL('ucrtbase')
crt.srand.argtypes=[c.c_uint];crt.srand.restype=None
crt.rand.argtypes=[];crt.rand.restype=c.c_int
crt_vectors=[]
for seed in [0,1,3,516,65535,0xffffffff]:
    crt.srand(seed);state=seed;values=[]
    for _ in range(256):
        state=(state*214013+2531011)&0xffffffff
        actual=crt.rand();assert actual==((state>>16)&32767),(seed,actual,state)
        values.append(actual)
    crt_vectors.append({'seed':seed,'draws':len(values),'first8':values[:8],'last8':values[-8:],'finalState':state})
raw_state={'state':1,'calls':0,'values':None}
@c.CFUNCTYPE(c.c_int)
def raw():
    i=raw_state['calls'];raw_state['calls']+=1
    if raw_state['values'] is not None:return raw_state['values'][i%len(raw_state['values'])]
    raw_state['state']=(raw_state['state']*214013+2531011)&0xffffffff
    return(raw_state['state']>>16)&32767

ranges=[('batch',0x1445a65e0,0x1445a68f8),('quantize',0x1445b31b0,0x1445b3542),('open',0x1445b3680,0x1445b36db),('log-thunk',0x146a3a18a,0x146a3a190)]
md.detail=True
try:
    for name,start,end in ranges:
        code=pe.bytes(start,end-start);c.memmove(at(start),code,len(code))
        for ins in md.disasm(code,start):
            for op in ins.operands:
                if op.type==X86_OP_MEM and op.mem.base==X86_REG_RIP:
                    va=ins.address+ins.size+op.mem.disp
                    assert lo<=va and va+8<=hi,hex(va)
                    c.memmove(at(va),pe.bytes(va,8),8)
    for slot,fn in [(0x146aeda68,crt.log1p),(0x146aed980,crt.log),(0x146aedf88,raw)]:
        pointer=c.c_void_p(c.cast(fn,c.c_void_p).value)
        c.memmove(at(slot),c.byref(pointer),8)
    old=c.c_ulong();assert kernel.VirtualProtect(memory,hi-lo,0x20,c.byref(old)),c.get_last_error()
    class Result(c.Structure):
        _fields_=[('success',c.c_int32),('next',c.c_int32),('candidates',c.c_int64)]
    batch=c.CFUNCTYPE(c.c_void_p,c.POINTER(Result),c.c_double,c.c_int32,c.c_int32,c.c_void_p)(at(0x1445a65e0))
    quantize=c.CFUNCTYPE(c.c_double,c.c_double,c.c_int64)(at(0x1445b31b0))
    uniform=c.CFUNCTYPE(c.c_double)(at(0x1445b3680))
    vectors=[]
    for coefficient in [0,.00001,.005,.1189422607421875,.30210113525390625,.5,1,1.1]:
        for counter in [-3,0,1,2,7,2147483645]:
            for attempts in [0,1,2,9,41]:
                for seed in [1,3,516,65535]:
                    raw_state.update(state=seed,calls=0,values=None)
                    result=Result();batch(c.byref(result),coefficient,counter,attempts,at(0x1445b3680))
                    vectors.append({'C':coefficient,'counter':counter,'attempts':attempts,'seed':seed,'success':result.success,'next':result.next,'candidates':result.candidates,'draws':raw_state['calls'],'rngState':raw_state['state']})
    uniform_vectors=[]
    for seq in [[0,0,0],[32767,32767,32767],[1,2,1],[32767,0,0],[0,32767,1]]:
        raw_state.update(state=1,calls=0,values=seq)
        uniform_vectors.append({'raw':seq,'value':uniform(),'draws':raw_state['calls']})
    boundary_vectors=[]
    for coefficient,counter,attempts in [(.5,1,9),(.00001,1,50),(1,1,3),(.30210113525390625,2,41)]:
        for seq in [[0,0,0],[32767,32767,32767],[0,32767,1],[32767,0,0]]:
            raw_state.update(state=1,calls=0,values=seq)
            result=Result();batch(c.byref(result),coefficient,counter,attempts,at(0x1445b3680))
            boundary_vectors.append({'C':coefficient,'counter':counter,'attempts':attempts,'raw':seq,'success':result.success,'next':result.next,'candidates':result.candidates,'draws':raw_state['calls']})
    quantize_vectors=[{'C':coefficient,'counter':n,'value':quantize(coefficient,n)}for coefficient in [0,.00001,.1189422607421875,.30210113525390625,.5,1]for n in [0,1,2,3,7,500000]]
    report={**info,'method':'Execute only copied numeric batch/quantizer/open-interval routines in isolated private memory; original relative layout, UCRT log/log1p imports, deterministic raw callback. CfromP and global stream initialization are outside this oracle.','ranges':[{'name':name,'start':hex(start),'end':hex(end),'sha256':hashlib.sha256(pe.bytes(start,end-start)).hexdigest()}for name,start,end in ranges],'vectors':vectors,'boundaryVectors':boundary_vectors,'uniformVectors':uniform_vectors,'quantizeVectors':quantize_vectors,'ucrtRandVectors':crt_vectors}
    (out/'vectors.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps({'vectors':len(vectors),'boundaryVectors':len(boundary_vectors),'uniformVectors':len(uniform_vectors),'quantizeVectors':len(quantize_vectors),'out':str(out)}))
finally:
    assert kernel.VirtualFree(memory,0,0x8000),c.get_last_error()
