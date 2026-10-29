using System.Text.Json;
using System.Security.Cryptography;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Versions;
using CUE4Parse.UE4.Assets.Exports.Texture;

if(args.Length<3||args.Length>4)throw new ArgumentException("paks usmap out [comma-separated exact texture names] required");
var names=args.Length==4?args[3].Split(','):new[]{"Actor_C01_Skill","Actor_C05_Skill"};
var provider=new DefaultFileProvider(args[0],SearchOption.TopDirectoryOnly,new VersionContainer(EGame.GAME_UE5_7));
provider.MappingsContainer=new FileUsmapTypeMappingsProvider(args[1]);provider.Initialize();provider.Mount();
Directory.CreateDirectory(args[2]);var results=new List<object>();
foreach(var file in provider.Files.Values.Where(f=>names.Any(n=>f.Path.EndsWith("/"+n+".uasset"))).OrderBy(f=>f.Path)){
 var pkg=provider.LoadPackage(file);foreach(var lazy in pkg.ExportsLazy){
  if(lazy.Value is not UTexture2D texture)continue;
  var mip=texture.PlatformData.Mips[0];var bytes=mip.BulkData.Data;
  if(bytes==null||texture.PlatformData.PixelFormat!="PF_B8G8R8A8"||bytes.Length!=mip.SizeX*mip.SizeY*4)throw new Exception("Unsupported source skill texture format");
  var raw=Path.Combine(args[2],texture.Name+".bgra");File.WriteAllBytes(raw,bytes);
  results.Add(new{asset=pkg.Name,name=texture.Name,width=mip.SizeX,height=mip.SizeY,pixelFormat=texture.PlatformData.PixelFormat,sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),raw});
 }
}
if(results.Count!=names.Length)throw new Exception("Expected exact requested source atlases");
File.WriteAllText(Path.Combine(args[2],"manifest.json"),JsonSerializer.Serialize(results,new JsonSerializerOptions{WriteIndented=true}));
Console.WriteLine(JsonSerializer.Serialize(new{textures=results.Count,output=args[2]}));
