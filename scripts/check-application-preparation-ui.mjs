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
try {
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/discover/?demo=1`);
  const buttons=page.getByRole('button',{name:'Preview Job',exact:true});
  await buttons.first().waitFor();
  let unchecked=false,partial=false;
  for(let i=0;i<Math.min(await buttons.count(),8);i++) {
   await buttons.nth(i).click();
   const dialog=page.getByRole('dialog');await dialog.waitFor();
   await dialog.getByRole('heading',{name:'Application answers',exact:true}).waitFor();
   const text=await dialog.innerText();
   assert(!text.includes('No answers needed from you right now.'));
   unchecked ||= text.includes('Application questions haven’t been checked yet.');
   partial ||= text.includes('Application questions are only partially checked.');
   await dialog.getByText(/Application questions (haven’t|are only)/).scrollIntoViewIfNeeded();
   await page.screenshot({path:`/private/tmp/application-preparation-${width}.png`});
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   if(unchecked&&partial)break;
  }
  assert(unchecked,'Demo includes an unchecked employer form');assert(partial,'Demo includes partial preparation');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.close();
 }
 console.log('Desktop/mobile: unchecked and partial form disclosures, no premature reassurance, no page overflow.');
} finally {await browser?.close();await new Promise(done=>server.close(done));}
