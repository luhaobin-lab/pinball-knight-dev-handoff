using System.Text.Json;
using System.Security.Cryptography;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Versions;
using CUE4Parse.UE4.Assets.Exports.Texture;

if (args.Length != 3) throw new ArgumentException("paks usmap out required");
var provider = new DefaultFileProvider(args[0], SearchOption.TopDirectoryOnly, new VersionContainer(EGame.GAME_UE5_7));
provider.MappingsContainer = new FileUsmapTypeMappingsProvider(args[1]);
provider.Initialize(); provider.Mount();
Directory.CreateDirectory(args[2]);
var results = new List<object>();
foreach(var file in provider.Files.Values.Where(f => f.Path.Contains("手动房间图") && f.Path.EndsWith(".uasset")).OrderBy(f=>f.Path)) {
  var pkg=provider.LoadPackage(file);
  foreach(var lazy in pkg.ExportsLazy) {
    if(lazy.Value is not UTexture2D texture) continue;
    var mip=texture.PlatformData.Mips[0]; var bytes=mip.BulkData.Data;
    if(bytes==null || bytes.Length!=mip.SizeX*mip.SizeY*4 || texture.PlatformData.PixelFormat!="PF_B8G8R8A8") throw new Exception("Unsupported mask format");
    var pixels=new List<object>(); var blue=new List<int[]>();
    for(var y=0;y<mip.SizeY;y++){var row=new int[mip.SizeX];for(var x=0;x<mip.SizeX;x++){var i=(y*mip.SizeX+x)*4;row[x]=bytes[i];pixels.Add(new{x,y,b=bytes[i],g=bytes[i+1],r=bytes[i+2],a=bytes[i+3]});}blue.Add(row);}
    var raw=Path.Combine(args[2],texture.Name+".bgra"); File.WriteAllBytes(raw,bytes);
    var result=new{asset=pkg.Name,name=texture.Name,width=mip.SizeX,height=mip.SizeY,pixelFormat=texture.PlatformData.PixelFormat,bytes=bytes.Length,sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),blueRows=blue,pixels,raw};
    File.WriteAllText(Path.Combine(args[2],texture.Name+".json"),JsonSerializer.Serialize(result,new JsonSerializerOptions{WriteIndented=true}));results.Add(result);
  }
}
if(results.Count!=2)throw new Exception("Expected two original room masks");
File.WriteAllText(Path.Combine(args[2],"manifest.json"),JsonSerializer.Serialize(results,new JsonSerializerOptions{WriteIndented=true}));
Console.WriteLine(JsonSerializer.Serialize(new{textures=results.Count,output=args[2]}));
