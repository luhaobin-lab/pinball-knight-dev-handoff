"""Read-only native fog evidence. Pure copied ToFColorSRGB SSE oracle; no original process or DLL is launched.
No writes to the source installation/reference. The 170-byte leaf has no calls/imports; only RIP constants relocate.
Usage: python -B tools/reverse/fog-native.py --out <NEW evidence directory>
"""
import sys
sys.dont_write_bytecode = True
import argparse, ctypes, hashlib, json, pathlib, struct
sys.path[:0] = ['D:/TAPTAPGAME_codex/reference/tools/py', 'D:/TAPTAPGAME_codex/reference/tools/pylib/capstone']
from pe import PE
from capstone import Cs, CS_ARCH_X86, CS_MODE_64, x86_const

p = argparse.ArgumentParser(); p.add_argument('--out', required=True); args = p.parse_args()
out = pathlib.Path(args.out); out.mkdir(parents=True, exist_ok=False)
exe = pathlib.Path('D:/steam/steamapps/common/Ricochet Abyss Demo/CatapultHero/Binaries/Win64/CatapultHero-Win64-Shipping.exe')
pe = PE(exe); cs = Cs(CS_ARCH_X86, CS_MODE_64); cs.detail = True
sha = hashlib.sha256(pe.data).hexdigest()
expected = 'ccd1db79c2eb3668242c4c10d271234963bc9dc1efa3ec0afddace444d1afcab'
assert sha.lower() == expected.lower(), (sha, expected)
start, end, table_va = 0x141252850, 0x1412528fa, 0x146b4a4f0
code = bytearray(pe.bytes(start, end-start)); patches = []; constants = {}
for ins in cs.disasm(bytes(code), start):
    assert ins.mnemonic not in ('call', 'jmp'), 'Unexpected control transfer in pure color leaf'
    for op in ins.operands:
        if op.type != x86_const.X86_OP_MEM or op.mem.base != x86_const.X86_REG_RIP: continue
        va = ins.address + ins.size + op.mem.disp
        if va not in constants:
            while len(code) % 16: code.append(0)
            constants[va] = len(code); code.extend(pe.bytes(va, 104*4 if va == table_va else 16))
        offset = ins.address-start+ins.disp_offset
        code[offset:offset+4] = struct.pack('<i', constants[va]-(ins.address-start+ins.size))
        patches.append({'instruction':hex(ins.address),'source':hex(va),'copyOffset':constants[va]})
kernel = ctypes.WinDLL('kernel32', use_last_error=True)
kernel.VirtualAlloc.argtypes=[ctypes.c_void_p,ctypes.c_size_t,ctypes.c_ulong,ctypes.c_ulong];kernel.VirtualAlloc.restype=ctypes.c_void_p
kernel.VirtualProtect.argtypes=[ctypes.c_void_p,ctypes.c_size_t,ctypes.c_ulong,ctypes.POINTER(ctypes.c_ulong)]
kernel.VirtualFree.argtypes=[ctypes.c_void_p,ctypes.c_size_t,ctypes.c_ulong]
address=kernel.VirtualAlloc(None,len(code),0x3000,0x04);assert address
ctypes.memmove(address,bytes(code),len(code));old=ctypes.c_ulong();assert kernel.VirtualProtect(address,len(code),0x20,ctypes.byref(old))
native=ctypes.WINFUNCTYPE(ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p)(address)
table=struct.unpack('<104I',pe.bytes(table_va,416))
def scalar(value):
    bits=struct.unpack('<I',struct.pack('<f',max(2**-13,min(1-2**-24,value))))[0]
    entry=table[(bits-0x39000000)>>20]
    return ((entry>>16)*512+(entry&65535)*((bits>>12)&255))>>16
vectors=[];all_bytes=bytearray();threshold=[]
try:
    for h in range(0x3c01):
        value=struct.unpack('<e',struct.pack('<H',h))[0]
        color=(ctypes.c_float*4)(value,value,value,1);result=(ctypes.c_ubyte*4)()
        native(color,result);got=result[2];expected=scalar(value);assert got==expected,(h,value,got,expected)
        all_bytes.append(got)
        if h in (0,1,1023,1024,0x3000,0x3800,0x3bff,0x3c00) or got in (79,80) and (not threshold or threshold[-1]['red']!=got):
            vector={'half':h,'linear':value,'red':got};vectors.append(vector)
            if got in (79,80):threshold.append(vector)
finally: kernel.VirtualFree(address,0,0x8000)
for va,size in [(0x1440a1440,215),(0x143ba1570,456),(0x143b47100,192),(0x143b46ee0,538),(start,end-start)]:
    (out/f'{va:x}.asm').write_text('\n'.join(f'{i.address:x}: {i.mnemonic} {i.op_str}' for i in cs.disasm(pe.bytes(va,size),va)))
receipt={'exe':str(exe),'exeSha256':sha,'leaf':hex(start),'leafSha256':hashlib.sha256(pe.bytes(start,end-start)).hexdigest(),
 'table':hex(table_va),'tableSha256':hashlib.sha256(pe.bytes(table_va,416)).hexdigest(),'patches':patches,
 'nativeHalfCases':len(all_bytes),'allRedSha256':hashlib.sha256(all_bytes).hexdigest(),'vectors':vectors,
 'storageEvidence':'1440a14d0 writes RenderTargetFormat@173=6 (RTF_RGBA16f); 172forceLinearGamma bit1',
 'limitations':['GPU half rounding/fused shader MAD and raster feedback have not been compared to original GPU capture.']}
(out/'result.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
