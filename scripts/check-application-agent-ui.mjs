// Same-token editor coverage against a static detached demo; no account access.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=process.cwd(),dir='/tmp/lookout-application-agent-ui';await mkdir(dir,{recursive:true});
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/next-app/out'],{stdio:'ignore'});
let browser;
try {
 const base='http://127.0.0.1:'+port;
 for(let i=0;i<50;i++){try{if((await fetch(base+'/profile/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',colorScheme:width===390?'dark':'light'});
  const page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const r=route.request();if(r.url().startsWith(base))return route.continue();if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
  await page.goto(base+'/profile/?demo=1&section=agent#agent-connections');
  const row=page.locator('#agent-connections > ul > li').filter({has:page.getByText('Application agent (demo)',{exact:true})});
  await row.getByRole('button',{name:'Use for AI Apply',exact:true}).click();
  await row.getByText('AI Apply agent',{exact:true}).waitFor();
  const selected=await page.evaluate(()=>window.JB.store.get('demo.applicationAgent'));
  assert.equal(selected.connectionId,'88888888-8888-4888-8888-888888888888');assert.equal(selected.version,1);
  await page.getByRole('button',{name:'Refresh connections',exact:true}).click();await row.getByText('AI Apply agent',{exact:true}).waitFor();
  await row.screenshot({path:dir+'/selected-'+width+'.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.evaluate(()=>window.JB.store.set('demo.agentConnections',window.JB.store.get('demo.agentConnections').map(c=>c.id==='88888888-8888-4888-8888-888888888888'?{...c,expires_at:'2000-01-01T00:00:00Z'}:c)));
  await page.getByRole('button',{name:'Refresh connections',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Your AI Apply agent is unavailable.'}).waitFor();
  assert.equal(await row.getByRole('button',{name:'Use for AI Apply',exact:true}).count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await context.close();
 }
 console.log('Desktop/mobile routing selection, refresh, unavailable-agent warning and isolation passed. Screenshots: '+dir);
} finally {await browser?.close();server.kill('SIGTERM');}
