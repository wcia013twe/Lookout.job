// Functional static-export check using fictional data; no account requests allowed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
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
try{
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),calls=[],errors=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){calls.push(route.request().url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.goto(`http://127.0.0.1:${server.address().port}/needs-you/?demo=1`);
  const uncertain=page.locator('li.action-board-row').filter({has:page.getByRole('heading',{name:'Check whether an application submitted',exact:true})});
  await uncertain.getByRole('button',{name:/Check submission/}).click();
  await uncertain.getByRole('button',{name:'Still unsure',exact:true}).click();
  await uncertain.getByText('Still uncertain. The application stays on the board and retry remains blocked.').waitFor();
  assert.equal(await uncertain.count(),1);
  const no=uncertain.getByRole('button',{name:'It did not submit',exact:true});assert.equal(await no.isDisabled(),true);
  await uncertain.getByLabel('Verification note').fill('Checked fictional employer portal and email; no submission.');
  await no.click();
  await page.getByText('Verified not submitted in the demo. A fresh attempt can be prepared.').waitFor();
  assert.equal(await uncertain.count(),0);
  await page.getByText('Action history · 1',{exact:true}).click();
  await page.getByText('Check whether an application submitted · Resolved in fictional demo',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Reset task preview',exact:true}).click();
  assert.equal(await uncertain.count(),1);assert.equal(await page.getByText('Action history · 1',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(calls,[]);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Passed desktop/mobile: uncertainty retained, verification required, resolved history retained, demo reset, no account requests or page errors.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
