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
  await page.goto(`http://127.0.0.1:${server.address().port}/discover/?demo=1`);
  await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();
  const nav=page.getByRole('navigation',{name:'Workspace pages'});
  for(const label of ['Discover','Applications','Network','Career Toolkit'])assert.equal(await nav.getByRole('link',{name:label,exact:true}).count(),1,label);
  assert.equal(await nav.getByRole('link',{name:/^Action board/}).count(),1);
  assert.equal(await nav.getByRole('link',{name:'Community',exact:true}).count(),0);
  assert.equal(await page.locator('#agent-panel-packs').count(),0);
  assert.equal(await page.getByText(/XP ·/).count(),0);
  await page.screenshot({path:`/private/tmp/lookout-scope-discover-${viewport.width}.png`});
  await page.goto(`http://127.0.0.1:${server.address().port}/profile/?demo=1&section=agent`);
  await page.getByRole('heading',{name:'My Profile',exact:true}).waitFor();
  if(viewport.width<640)await page.locator('select').filter({has:page.locator('option[value="agent"]')}).selectOption('agent');
  else await page.getByRole('button',{name:'My Agent',exact:true}).click();
  assert.equal(await page.getByRole('combobox',{name:'Application profile',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'New profile',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Duplicate profile',exact:true}).count(),0);
  assert.equal(await page.getByRole('combobox',{name:'Company tier list',exact:true}).count(),0);
  assert.equal(await page.getByRole('combobox',{name:'Review threshold',exact:true}).count(),0);
  const auto=page.getByRole('checkbox',{name:'Auto-apply with verified facts',exact:true});
  await auto.waitFor();
  await auto.uncheck();
  await page.getByRole('button',{name:'Save submission mode',exact:true}).click();
  await page.getByText('Review each application before submission.',{exact:false}).waitFor();
  await auto.check();
  await page.getByRole('button',{name:'Save submission mode',exact:true}).click();
  await page.getByText('Auto-apply uses verified facts and permitted saved answers.',{exact:false}).waitFor();
  assert.equal(await page.locator('#agent-panel-packs').count(),0);
  assert.equal(await page.getByRole('button',{name:'Appearance',exact:true}).count(),0);
  assert.equal(await page.getByRole('heading',{name:/Circle/}).count(),0);
  await page.screenshot({path:`/private/tmp/lookout-scope-profile-${viewport.width}.png`});
  if(viewport.width<640)await page.locator('select').filter({has:page.locator('option[value="preferences"]')}).selectOption('preferences');
  else await page.getByRole('button',{name:'Job preferences',exact:true}).click();
  await page.getByRole('button',{name:'Edit Search preferences',exact:true}).click();
  await page.getByRole('textbox',{name:'Roles',exact:true}).fill('Backend Engineer');
  await page.getByRole('combobox',{name:'Job type',exact:true}).selectOption('Full-time');
  await page.getByRole('textbox',{name:'Locations',exact:true}).fill('New York');
  assert.equal(await page.getByRole('combobox',{name:/priority$/}).count(),0);
  assert.equal(await page.getByRole('heading',{name:'Company priorities',exact:true}).count(),0);
  await page.getByRole('button',{name:'Finish editing Search preferences',exact:true}).click();
  await page.getByText('Backend Engineer',{exact:true}).waitFor();
  await page.screenshot({path:`/private/tmp/lookout-simple-preferences-${viewport.width}.png`});
  if(viewport.width<640)await page.locator('select').filter({has:page.locator('option[value="about"]')}).selectOption('about');
  else await page.getByRole('button',{name:'About me',exact:true}).click();
  await page.getByRole('button',{name:'Edit Selected résumé',exact:true}).click();
  const resume=page.getByRole('combobox',{name:'Selected résumé',exact:true});
  const resumeId=await resume.locator('option').evaluateAll(options=>options.find(option=>option.value)?.value);
  assert(resumeId,'fictional resume available');
  await resume.selectOption(resumeId);
  await page.getByRole('button',{name:'Finish editing Selected résumé',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Assign roles',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Add resume',exact:true}).count(),0);
  await page.screenshot({path:`/private/tmp/lookout-simple-resume-${viewport.width}.png`});
  for(const route of ['circles','themes','progress']){
   await page.goto(`http://127.0.0.1:${server.address().port}/${route}/?demo=1`);
   await page.getByRole('heading',{name:'This feature is paused'}).waitFor();
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(calls,[]);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Passed desktop/mobile: core navigation, single profile/resume, simple preferences, submission mode toggle, no tiers/packs/appearance/XP/Circles settings, paused direct routes, no external requests or page errors.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
