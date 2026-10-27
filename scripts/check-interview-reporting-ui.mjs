// Functional static-export test, fictional demo only. No account/network writes.
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
  await page.goto(`http://127.0.0.1:${server.address().port}/applications/?demo=1`);
  await page.getByRole('button',{name:'Open Backend Engineer at Cedar Systems (demo)',exact:true}).click();
  const panel=page.getByRole('dialog');await panel.getByRole('button',{name:'Interview',exact:true}).click();
  const brief=panel.getByRole('region',{name:'Interview brief',exact:true});
  await brief.getByText('Technical round 1',{exact:true}).waitFor();
  const notes=panel.getByRole('region',{name:'Interview notes',exact:true});
  await notes.getByText(/Candidate report \(fictional, saved by Muse\)/).waitFor();
  await notes.getByRole('button',{name:'Add note',exact:true}).click();
  assert.equal(await notes.getByRole('textbox').count(),1);
  await notes.getByLabel('Private interview note',{exact:true}).fill('Fictional conversation: retry explanation needs practice.');
  await notes.getByRole('button',{name:'Save note',exact:true}).click();
  const entry=notes.locator('article').filter({hasText:'Fictional conversation: retry explanation needs practice.'});
  await entry.getByRole('button',{name:'Edit note',exact:true}).click();
  await notes.getByLabel('Private interview note',{exact:true}).fill('Fictional corrected note: practice retry safety and backpressure.');
  await notes.getByRole('button',{name:'Save note',exact:true}).click();
  await notes.getByText('Fictional corrected note: practice retry safety and backpressure.',{exact:true}).waitFor();
  assert.equal(await notes.getByRole('button',{name:'Share to Circle',exact:true}).count(),0);
  await panel.getByRole('button',{name:'Add round',exact:true}).click();
  await panel.getByLabel('Round type').selectOption('technical_round');
  await panel.getByLabel('Name this round',{exact:true}).fill('Technical round moved');
  await panel.locator('.interview-round-editor').getByLabel('Progress').selectOption('scheduled');
  await panel.getByLabel('Confirmed date & time (optional)',{exact:true}).fill(new Date(Date.now()+3*86400000).toISOString().slice(0,16));
  await panel.getByLabel('Replaces an earlier update (optional)').selectOption('demo-interview-technical-round-1');
  await panel.getByRole('button',{name:'Save round update',exact:true}).click();
  await panel.getByText('Timeline update recorded.',{exact:true}).waitFor();
  await brief.getByText('Technical round moved',{exact:true}).waitFor();
  assert.equal(await brief.getByText('Technical round 1',{exact:true}).count(),0);
  assert.equal(await panel.getByText(/Replaced by a later update/).count(),2,'Original and rescheduled history retained');
  assert.equal(await panel.getByLabel('Replaces an earlier update (optional)').locator('option[value="demo-interview-technical-round-1"]').count(),0);
  assert.equal(await panel.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await page.keyboard.press('Escape');assert.equal(await panel.count(),0);
  assert.deepEqual(calls.filter(value=>{const url=new URL(value);return !(url.pathname.startsWith('/storage/v1/object/public/company-logos/')||url.hostname==='robinhood.com'&&url.pathname==='/us/en/rh_favicon_152.png');}),[]);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Passed desktop/mobile: one-field private note create/edit, rescheduled current brief, retained history, stale target excluded, no account requests/errors.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
