// Fictional demo only: external requests are blocked and no account is loaded.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('next-app/out');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))return res.writeHead(403).end();
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
const artifacts='/Volumes/External SSD/Lookout/tmp/discover-apply-ui';await mkdir(artifacts,{recursive:true});
try{
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'}),privateCalls=[],errors=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'){if(!url.pathname.startsWith('/storage/v1/object/public/company-logos/')&&!['image','font'].includes(route.request().resourceType()))privateCalls.push(url.pathname);return route.abort();}return route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/discover/?demo=1`);
  const card=page.locator('article').filter({hasText:'Example Query Labs (demo)'}).first();
  await card.getByRole('button',{name:'AI Apply',exact:true}).waitFor();
  const initial=await page.locator('article').count();
  await card.getByRole('link',{name:'Open Application',exact:true}).click();
  assert.equal(await card.getByRole('button',{name:'AI Apply',exact:true}).isEnabled(),true);
  assert.equal(await page.locator('article').count(),initial,'Opening leaves Discover unchanged');
  await card.getByRole('button',{name:'AI Apply',exact:true}).click();
  await card.getByRole('button',{name:'Queued',exact:true}).waitFor();
  assert.equal(await card.getByRole('button',{name:'Queued',exact:true}).isDisabled(),true);
  assert.equal(await page.locator('article').count(),initial,'Queueing does not hide the posting');
  await card.locator('h3 button').click();
  const panel=page.getByRole('dialog');await panel.getByRole('button',{name:'Queued',exact:true}).waitFor();
  assert.equal(await panel.getByRole('link',{name:'Open Application',exact:true}).count(),1);
  assert.equal(await panel.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await page.keyboard.press('Escape');
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:`${artifacts}/${viewport.width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(privateCalls,[]);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Passed desktop/mobile: Open Application is read-only; AI Apply creates Queued; queued card and preview stay visible; duplicate action disabled; no private requests/errors/overflow.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
