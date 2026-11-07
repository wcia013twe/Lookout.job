// Same-token editor coverage against a static detached demo; no account access.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=process.cwd(),dir='/tmp/lookout-agent-permissions-ui';await mkdir(dir,{recursive:true});
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
  const row=page.locator('#agent-connections > ul > li').filter({has:page.getByText('Laptop agent (demo)',{exact:true})});
  await row.getByRole('button',{name:'Edit permissions',exact:true}).waitFor();
  const original=await page.evaluate(()=>window.JB.store.get('demo.agentConnections').find(c=>c.id==='demo-agent-active'));
  const edit=()=>row.getByRole('button',{name:'Edit permissions',exact:true}).click();
  const form=()=>row.getByRole('form',{name:'Edit permissions for Laptop agent (demo)',exact:true});
  const network=()=>form().getByRole('checkbox',{name:'Edit contacts and outreach drafts',exact:true});
  await edit();assert(await form().getByRole('button',{name:'Save permissions',exact:true}).isDisabled());await network().check();
  await row.screenshot({path:dir+'/editor-'+width+'.png'});
  await form().getByRole('button',{name:'Save permissions',exact:true}).click();
  await row.getByRole('status').filter({hasText:'Permissions updated.'}).waitFor();
  let saved=await page.evaluate(()=>window.JB.store.get('demo.agentConnections').find(c=>c.id==='demo-agent-active'));
  assert.deepEqual({...saved,scopes:original.scopes},original);assert(saved.scopes.includes('network:write'));
  await edit();await network().uncheck();await form().getByRole('button',{name:'Cancel',exact:true}).click();
  await edit();assert(await network().isChecked());await network().uncheck();await form().getByRole('button',{name:'Save permissions',exact:true}).click();await row.getByRole('status').filter({hasText:'Permissions updated.'}).waitFor();
  await edit();for(const c of await form().getByRole('checkbox').all())await c.uncheck();assert(await form().getByRole('button',{name:'Save permissions',exact:true}).isDisabled());await form().getByRole('alert').waitFor();await form().getByRole('button',{name:'Cancel',exact:true}).click();
  await edit();await network().check();
  await page.evaluate(()=>window.JB.store.set('demo.agentConnections',window.JB.store.get('demo.agentConnections').map(c=>c.id==='demo-agent-active'?{...c,scopes:[...c.scopes,'profile:write']}:c)));
  await form().getByRole('button',{name:'Save permissions',exact:true}).click();await row.getByRole('status').filter({hasText:'Permissions changed elsewhere'}).waitFor();
  saved=await page.evaluate(()=>window.JB.store.get('demo.agentConnections').find(c=>c.id==='demo-agent-active'));assert(saved.scopes.includes('profile:write'));assert(!saved.scopes.includes('network:write'));
  await form().getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Refresh connections',exact:true}).click();await edit();assert(await form().getByRole('checkbox',{name:'Update profile facts for your review',exact:true}).isChecked());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  const expired=page.locator('#agent-connections > ul > li').filter({has:page.getByText('Old test (demo)',{exact:true})});assert.equal(await expired.getByRole('button',{name:'Edit permissions',exact:true}).count(),0);
  await page.reload();await row.getByRole('button',{name:'Edit permissions',exact:true}).waitFor();await edit();assert(!(await network().isChecked()));assert(!(await form().getByRole('checkbox',{name:'Update profile facts for your review',exact:true}).isChecked()));
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await context.close();
 }
 console.log('Desktop/mobile permission save, cancel, removal, stale protection, expiry, reset and isolation passed. Screenshots: '+dir);
} finally {await browser?.close();server.kill('SIGTERM');}
