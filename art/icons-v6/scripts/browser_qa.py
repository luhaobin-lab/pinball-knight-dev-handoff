from pathlib import Path
import asyncio,json,hashlib,argparse,os,threading
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Validate via an automatic localhost server and a direct offline file preview.')
parser.add_argument('--url',help='Optional existing catalogue URL; otherwise an ephemeral localhost server is started.')
parser.add_argument('--browser-channel',default=os.environ.get('ICON_BROWSER_CHANNEL',''))
args=parser.parse_args()
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=None
if args.url:
 URL=args.url
else:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 URL=f'http://127.0.0.1:{server.server_address[1]}/index.html'
async def main():
 m=json.loads((ROOT/'manifest.json').read_text());expected=m['counts']['ready'];errors=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(**({'channel':args.browser_channel} if args.browser_channel else {}));page=await browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  response=await page.goto(URL);assert response is None or response.status==200;await page.wait_for_function('window.galleryState');assert await page.locator('.card').count()==expected
  decoded=await page.evaluate('''async()=>{let count=0;for(const row of CATALOG.icons){for(const size of ['128','256']){const im=new Image();im.src=row.files[size];await im.decode();const v=row.variants[size];if(im.naturalWidth!==v.width||im.naturalHeight!==v.height)throw Error(row.id+' '+size);count++}}return count}''');assert decoded==expected*2
  await page.screenshot(path=str(ROOT/'qa/browser-desktop.png'),full_page=False)
  await page.locator('#category').select_option('talent');assert await page.locator('.card').count()==m['counts']['talents'];await page.locator('#category').select_option('all');await page.locator('#search').fill('I156');assert await page.locator('.card').count()==1;title=await page.locator('.card h2').inner_text();assert '灵魂香菇' in title and 'I156' in title
  await page.locator('summary').click();assert await page.locator('details').get_attribute('open') is not None
  async with page.expect_download() as event:await page.get_by_role('link',name='下载 PNG',exact=True).click()
  dl=await event.value;dst=ROOT/'qa/download-check.png';await dl.save_as(str(dst));assert dst.read_bytes()==(ROOT/'pixels/256/I156.png').read_bytes()
  for viewport in [{'width':1440,'height':1100},{'width':390,'height':844}]:
   await page.set_viewport_size(viewport)
   for size in [128,256]:
    await page.locator(f'[data-size="{size}"]').click()
    for zoom in [1,2]:
     await page.locator(f'[data-zoom="{zoom}"]').click();im=page.locator('.stage img');await im.evaluate('im=>im.decode()');dims=await im.evaluate('im=>({w:im.getBoundingClientRect().width,h:im.getBoundingClientRect().height,nw:im.naturalWidth,nh:im.naturalHeight})');assert dims['w']==size*zoom and dims['h']==dims['nh']*zoom;assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await page.locator('[data-zoom="1"]').click()
  mothers_available=(ROOT/'mothers/I156.png').is_file()
  if mothers_available:
   await page.locator('[data-mode="mother"]').click();await page.locator('.stage img').evaluate('im=>im.decode()');assert await page.locator('.stage img').evaluate('im=>im.naturalWidth>256');await page.locator('[data-mode="pixel"]').click()
  for bg in ['light','check','dark']:
   await page.locator(f'[data-bg="{bg}"]').click()
   if bg=='light':await page.screenshot(path=str(ROOT/'qa/browser-mobile-light.png'),full_page=True)
  await page.screenshot(path=str(ROOT/'qa/browser-mobile.png'),full_page=True)
  await page.goto((ROOT/'index.html').as_uri());await page.wait_for_function('window.galleryState');assert await page.locator('.card').count()==expected;await page.locator('.stage img').first.evaluate('im=>im.decode()')
  assert not errors,errors
  result={'status':'pass','iconsInCatalogue':expected,'PNGVariantsDecodedInChrome':decoded,'searchAndCategoryFilters':True,'sourceDetails':True,'downloadBytesMatch':True,'integerScaling1440And390':True,'backgroundControls':True,'motherControlValidated':mothers_available,'motherRequiredForDefaultCatalogue':False,'offlineFilePreview':True,'errors':errors,'boundary':'Browser library validation, not import into the target game.'};(ROOT/'qa/browser-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False));await browser.close()
try:
 asyncio.run(main())
finally:
 if server:server.shutdown();server.server_close()
