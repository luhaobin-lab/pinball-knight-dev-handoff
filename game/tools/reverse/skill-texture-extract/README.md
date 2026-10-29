Internal source reference extraction only; none of these pixels are shipped.

Build with `D:/TAPTAPGAME_codex/reference/tools/dotnet/dotnet.exe build SkillTextureExtract.csproj -c Release -o D:/TAPTAPGAME_codex/studio/tools/SkillTextureExtract/bin`.
Copy the existing RoomMaskExtract `bin/*.dll` runtime dependencies to that output directory (exclude RoomMaskExtract.dll).
Run the compiled DLL through the same dotnet host, with arguments:

1. `D:/TAPTAPGAME_codex/reference/tools/work/paks`
2. `D:/TAPTAPGAME_codex/reference/tools/work/CatapultHero.usmap`
3. `D:/TAPTAPGAME_codex/studio/reference-session-20261027/skill-poses`

`python -I decode.py <output-directory>` converts the verified BGRA bytes to PNG and records their hashes.
The exact C01/C05 Skill atlases are640x64 BGRA8. Their source Flipbooks use columns1..9, each one frame at10fps.
`decoded.json` records source raw and PNG hashes. The 3x images are nearest-neighbour inspection copies.
