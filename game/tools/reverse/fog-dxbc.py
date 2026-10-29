"""Disassemble extracted fog groups with the local Microsoft shader compiler; preserve input and old outputs.
Usage: python -B tools/reverse/fog-dxbc.py --input <fog-material-r3> --out <NEW directory>
Upstream extraction recipe/project is in studio/tools/FogMaterialExtract and room/FOG-SOURCE.md.
"""
import sys
sys.dont_write_bytecode=True
import argparse,ctypes,hashlib,json,pathlib,struct
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--out',required=True);a=p.parse_args()
out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=False)
d3d=ctypes.WinDLL('d3dcompiler_47.dll');d3d.D3DDisassemble.argtypes=[ctypes.c_void_p,ctypes.c_size_t,ctypes.c_uint,ctypes.c_char_p,ctypes.POINTER(ctypes.c_void_p)];d3d.D3DDisassemble.restype=ctypes.c_long
manifest=[]
for f in pathlib.Path(a.input).glob('*-SF_Pixel.uncompressed'):
 data=f.read_bytes();start=data.find(b'DXBC');assert start>=0
 size=struct.unpack_from('<I',data,start+24)[0];dxbc=data[start:start+size];assert len(dxbc)==size
 blob=ctypes.c_void_p();raw=ctypes.create_string_buffer(dxbc);assert d3d.D3DDisassemble(raw,len(dxbc),0,None,ctypes.byref(blob))==0
 vtable=ctypes.cast(blob,ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
 ptr=ctypes.WINFUNCTYPE(ctypes.c_void_p,ctypes.c_void_p)(vtable[3])(blob)
 length=ctypes.WINFUNCTYPE(ctypes.c_size_t,ctypes.c_void_p)(vtable[4])(blob)
 assembly=ctypes.string_at(ptr,length).rstrip(b'\0').decode('utf8')
 ctypes.WINFUNCTYPE(ctypes.c_ulong,ctypes.c_void_p)(vtable[2])(blob)
 (out/(f.stem+'.dxbc')).write_bytes(dxbc);(out/(f.stem+'.asm.txt')).write_text(assembly)
 manifest.append({'input':str(f.resolve()),'inputSha256':hashlib.sha256(data).hexdigest(),'offset':start,'bytes':size,'sha256':hashlib.sha256(dxbc).hexdigest()})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest))
