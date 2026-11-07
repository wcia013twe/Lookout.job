// Isolated demo integration and visual check against the static production export.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {updateField} from '../lib/search-profile.mjs';
const root=process.cwd(), artifacts=join(root,'next-app/.profile-flow-proof/agent-context');
await mkdir(artifacts,{recursive:true});
const probe=createServer();
await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const log=await open(join(artifacts,'server.log'),'w');
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',join(root,'next-app/out')],{stdio:['ignore',log.fd,log.fd]});
let browser;
try {
 const base='http://127.0.0.1:'+port;
 for(let i=0;i<50;i++){try{if((await fetch(base+'/profile/')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 page.setDefaultTimeout(15000);
 const errors=[],writes=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request();
  if(request.url().startsWith(base))return route.continue();
  if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());
  return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.emulateMedia({colorScheme:width===390?'dark':'light'});
  await page.goto(base+'/profile/?demo=1&section=preferences');
  const section=page.locator('#agent-context');
  await section.getByRole('heading',{name:'What your agent knows',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Career goals & tradeoffs',exact:true}).count(),0);
  assert.equal(await page.getByRole('heading',{name:'Profile rules',exact:true}).count(),0);
  for(const label of ['Skills & experience','Compensation','Wellbeing & culture','Location & work setting'])assert.equal(await section.locator('dt').filter({hasText:label}).count(),1);
  assert.equal(await section.getByRole('link',{name:'See fit analysis in Discover'}).getAttribute('href'),'/discover/?demo=1');
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({path:join(artifacts,'read-'+width+'.png')});
  await section.getByRole('button',{name:'Edit What your agent knows',exact:true}).click();
  const notes=section.getByRole('textbox');
  assert.equal(await notes.count(),4);
  const original=await notes.nth(0).inputValue();
  assert.match(original,/query service/);
  await notes.nth(0).fill('Fictional user statement: I want mentorship and SQL systems ownership. Verify team support.');
  await section.getByRole('button',{name:'Finish editing What your agent knows',exact:true}).click();
  await section.getByText('Fictional user statement: I want mentorship and SQL systems ownership. Verify team support.',{exact:true}).waitFor();
  // Wait for the actual existing autosave, then inspect detached demo state.
  await page.waitForFunction(()=>window.JB.store.get('workflow.searchPreferences').profiles[0].instructions.includes('Fictional user statement: I want mentorship'));
  await section.getByRole('button',{name:'Edit What your agent knows',exact:true}).click();
  assert.equal(await section.getByRole('textbox').nth(0).inputValue(),'Fictional user statement: I want mentorship and SQL systems ownership. Verify team support.');
  await section.screenshot({path:join(artifacts,'edit-'+width+'.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow');
  // Exercise missing notes and legacy preservation through the same profile editor.
  await section.getByRole('button',{name:'Finish editing What your agent knows',exact:true}).click();
  const advanced=page.getByRole('region',{name:'Advanced instructions',exact:true});
  await advanced.getByRole('button',{name:'Edit Advanced instructions',exact:true}).click();
  const prompt=advanced.getByRole('textbox');
  const saved=await prompt.inputValue();
  let legacy=updateField(saved,'What your agent knows','Compensation','');
  legacy=updateField(legacy,'Career goals & tradeoffs','Career goals','Fictional legacy goal retained.');
  legacy=updateField(legacy,'Career goals & tradeoffs','Tradeoffs','Fictional timing condition.');
  legacy=updateField(legacy,'Profile evaluation','Rules','Fictional existing exclusions.');
  await prompt.fill(legacy);
  await advanced.getByRole('button',{name:'Finish editing Advanced instructions',exact:true}).click();
  await section.getByText('No context saved yet.',{exact:true}).waitFor();
  await section.getByText('Previous goals & rules',{exact:true}).click();
  await section.getByText('Fictional legacy goal retained.',{exact:true}).waitFor();
  await section.getByText('Fictional existing exclusions.',{exact:true}).waitFor();
 }
 assert.deepEqual(errors,[]);
 assert.deepEqual(writes,[],'Demo must not write to account services');
 console.log('PASS: desktop/mobile reading, four editable notes, autosave/reopen, empty notes, legacy preservation, Discover link, no overflow or account writes.');
}finally{
 await browser?.close(); server.kill('SIGTERM'); await log.close();
}
