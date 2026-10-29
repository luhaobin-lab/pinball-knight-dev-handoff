# Source fog recovery

Target: BP_ManeActor's inherited fog material/timeline, the level TA2 fog plane, and 工具.获取鼠标位置迷雾信息.
Geometry/presentation target remains ART_BIBLE. No external texture is shipped.

## Blueprint and asset evidence

All paths below are relative to `D:/TAPTAPGAME_codex/reference/dump`.

- `blueprints-pseudo/CatapultHero/BP/Actor/BP_ManeActor.txt:945`: valid material, living actor, phases `[3,2,8,0]`, previous/current UV, previous-position write, DrawMaterialToRenderTarget.
- Same file L12056/L11413: create dynamic draw material, range0; Player/Friendly/Hostile tags → Delay0.2 → inherited timeline PlayFromStart. L12125 maps imported `展开` track onto `height*.002`; L15 finishes at `height*.002`. Track length1 and exact cubic tangents are already imported.
- `blueprints-pseudo/CatapultHero/函数库/函数库_工具.txt:439,463`: hidden plane bypass; target=`controller.吸附位置`; UV=`(world+1250)/2500`; ReadRenderTargetUV red `<80`.
- `blueprints-pseudo/CatapultHero/BP/Actor/蓝图_动作游戏模式.txt:3144`: begin player fog, clear target black, then place player. Source input `interact(actor)` samples that picked actor centre.
- `raw/Game/CatapultHero/渲染/RT_战争迷雾.json`: 512×512, SRGB=false.
- `raw/Game/CatapultHero/场景/TA2.json` exports35/37: StaticMeshActor tagged迷雾, Plane scale25, worldZ200, sort98, query-only fog channel; no pawn/physics blocking.

## Actual cooked shader

Read-only CUE4Parse extractor and build project:
`D:/TAPTAPGAME_codex/studio/tools/FogMaterialExtract/Program.cs` / `FogMaterialExtract.csproj`.
It sets `ReadShaderMaps=true`, reads material ShaderMap ResourceHash, finds shader in `FIoStoreShaderCodeArchive`,
reads the exact IoHash group from the copied pak, then uses its existing Oodle decompressor.
Material exports, archive/group mapping, compressed/uncompressed groups and DXBC disassembly:
`D:/TAPTAPGAME_codex/studio/logs/parity-room-fog/fog-material-r3/`.

- Drawing ResourceHash `85108E2441B752F93B62FFB47F6DB5AAD7089617`, shaderIndex1407/group120.
  DXBC offset176,10664bytes,SHA256 `55eb8fd1306eb04ebd6da9a3a3639e233114fbf557b99be8ab8776f399c10cd0`.
- Visible fog ResourceHash `770A0C9AE677080A03E16DB665392D598D21D18A`, pixel DXBC offset172,4960bytes,
  SHA256 `758cc781a1084833b25080ee04afa690f22c33bf7c486190715a00d51a5e5713`.
- `disassembly-manifest.json` binds original group bytes to the extracted Microsoft D3DDisassemble output.

Draw uniforms decoded from the actual preshader bytecode: cb2[0].xy=previousUV; zw=currentUV−previousUV;
cb2[1].x=1/dot(delta,delta); y=max(range,1e−5)*feather(.3); z=max(range,1e−5); w=range.
Pixel program computes clamped projection onto the segment, distance, inverted smoothstep(radius,radius*.3),
gates `abs(range)>1e−5 && range>=0`, then max with the prior target red. Stationary segment's saturate(NaN)=0
is the shader instruction's defined behavior, so it reveals a disc. Visible shader uses `(1-saturate(R))^4`
then the source Dither02 texture. This port uses the approved kit Bayer4 stipple; that visual difference is explicit.

Primary references for decoding (not substitutes for original bytes):
- https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/Shader/UE__Shader__EPreshaderOpcode?application_version=5.5
- https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/saturate
- https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/Kismet/UKismetRenderingLibrary/ReadRenderTargetUV?application_version=5.5

## Original executable precision and independent oracle

Executable SHA256 `ccd1db79c2eb3668242c4c10d271234963bc9dc1efa3ec0afddace444d1afcab`.
`tools/reverse/fog-native.py` reads it without modifying or launching the original.
It relocates only the pure leaf's RIP-relative constants into private RW memory, changes to RX, calls its Windows
x64 ABI, frees memory, and checks all15,361binary16 values in[0,1]. No imports or calls exist in that leaf.
Evidence `D:/TAPTAPGAME_codex/studio/logs/parity-room-fog/fog-native-r3/result.json` and named asm files.

- UTextureRenderTarget2D class registration1440ba2c0 → ctor1440a1440; instruction1440a14d0 writes6 at reflected
  offset173 (RTF_RGBA16f), and172 gets forceLinearGamma. Thus storage uses binary16, not an invented R8 mask.
- ReadRenderTargetUV exec143ba1570 clampsUV,[0,1], multiplies by512 and truncates; helper143b46ee0 clamps finalpixel to511.
- ReadRenderTargetPixel143b47100 sends HDR floats through141252850. Native SIMD leaf SHA256
  `a56dd6951be898fdb6a679dcdfd303204ec51b30f1d52de05022b23e6c2ead3a`.
- Native104entry table146b4a4f0 SHA256 `6d069f2793afce3a6169b5bc1cc79faa66e308731028c4010ba794c01c806b92`.
- All red-byte results SHA256 `fea05cf70f60ad4256661541d10530bac897ecec45bbd99cb441eca2290ac5ed`.
  R80 starts at linear binary16 `0.0792236328125`; tests compare all values to the independently executed leaf hash.
- `fog-native-r1/color-table.json` is an early failed low/high-lane decoding diagnostic, superseded by r3; preserved.

## State, boundaries and remaining differences

The whole linear-red mask is canonical state: lossless per-row RLE of its f32 representations of binary16 values.
`FogMask.toArray()` exposes every pixel to the existing digest serializer. Private bitmap is only the equivalent
write cache; a view copies the canonical strings without writing anything. Draw is max-only, with source clear on
every placement. A cache only skips a provably identical stationary/max operation, and is invalidated by clear.
Ticks are weak; only the finite imported reveal timeline and original0.2delay hold the scheduler busy.

Still unproven: original GPU fused MAD/rsq edge rounding and feedback details, exact Dither02 stipple and the
original level sprite/background artwork. This is source formula/native input conversion recovery, not proof of
pixel-identical GPU output or complete original Chaos behavior. No performance/mobile-parity claim.
