// Detached, fictional UI checks. No account, employer, password or backend access.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('next-app/out'),dir='/private/tmp/lookout-working-ui';await mkdir(dir,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))return res.writeHead(403).end();
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try {
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/discover/?demo=1');
  const card=page.locator('article').filter({hasText:'Example Query Labs (demo)'});
  await card.getByRole('button',{name:'AI Apply',exact:true}).click();
  await card.getByRole('button',{name:'Queued',exact:true}).waitFor();
  assert.equal(await card.locator('svg.animate-spin').count(),0);
  await card.getByRole('button',{name:'Demo: Muse picks up',exact:true}).click();
  const working=card.getByRole('button',{name:'Working',exact:true});await working.waitFor();
  assert.equal(await working.isDisabled(),true);
  assert.equal(await working.locator('svg.animate-spin').count(),1);
  assert.equal(await working.locator('svg').evaluate(el=>getComputedStyle(el).animationName),'none');
  await card.screenshot({path:`${dir}/${name}-working.png`});
  await page.locator('a[href="/needs-you/"]').first().click();
  const board=page.getByRole('region',{name:'AI Apply',exact:true});await board.waitFor();
  await board.getByRole('status',{name:'AI Apply: Working',exact:true}).waitFor();
  assert.equal(await board.getByText('Needs input',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await board.screenshot({path:`${dir}/${name}-board-working.png`});
  await page.locator('a[data-dashboard-tour="discover"]').first().click();
  await card.getByRole('button',{name:'Demo: save outcome',exact:true}).click();
  await card.getByText('Ready for review',{exact:true}).waitFor();
  assert.equal(await card.locator('svg.animate-spin').count(),0);
  await page.locator('a[href="/needs-you/"]').first().click();
  assert.equal(await page.getByRole('region',{name:'AI Apply',exact:true}).count(),0);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Passed desktop/mobile fictional queue → pickup → outcome, Working spinner, reduced motion, board visibility and terminal cleanup. Screenshots: '+dir);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
