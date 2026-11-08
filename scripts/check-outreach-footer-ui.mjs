// Detached fictional UI only: no real account, approval or external message.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3067';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local demo only');
const dir='/private/tmp/lookout-outreach-footer';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:width===390?'light':'dark',serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.goto(base+'/referrals/?demo=1');await page.getByRole('list',{name:'Saved people',exact:true}).waitFor();
  await page.evaluate(()=>window.JB.store.set('network.referrals',window.JB.store.get('network.referrals').map(p=>p.id==='demo-new-connection'?{...p,subject:'Fictional query-engine chat'}:p)));
  await page.getByRole('list',{name:'Saved people',exact:true}).getByRole('button',{name:/Morgan \(fictional\)/}).click();
  const detail=page.getByRole('region',{name:'Person details for Morgan (fictional)',exact:true});
  const ready=detail.getByRole('button',{name:'Mark ready',exact:true}),reviewed=detail.getByRole('checkbox',{name:'Reviewed',exact:true});
  await ready.waitFor();assert(await ready.isDisabled());assert.equal(await reviewed.isChecked(),false);
  assert.equal(await detail.getByRole('button',{name:'I reviewed this exact message',exact:true}).count(),0);
  assert.equal(await detail.getByText('Review this version before accepting.',{exact:true}).count(),0);
  await detail.getByRole('button',{name:'Copy subject',exact:true}).click();await detail.getByText('Subject copied.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Fictional query-engine chat');
  assert(await ready.isDisabled(),'Copying is not review');
  await reviewed.check();await ready.waitFor({state:'visible'});await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Mark ready'&&!b.disabled));
  await detail.getByRole('button',{name:'Copy message',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:dir+'/footer-'+width+'.png'});
  const draft=detail.getByRole('textbox',{name:'Message for Morgan (fictional)',exact:true}),original=await draft.inputValue();
  await draft.fill(original+' A changed draft.');
  assert.equal(await ready.count(),0,'A different body cannot use the old review receipt');
  await draft.fill(original);await ready.waitFor();assert(!(await ready.isDisabled()));
  await ready.click();await detail.getByText('Ready for you to send. Nothing was sent.',{exact:true}).waitFor();
  const saved=await page.evaluate(()=>window.JB.store.get('network.referrals').find(p=>p.id==='demo-new-connection'));
  assert.equal(saved.status,'Not asked');assert.equal(saved.message,original);assert.equal(saved.notes,undefined);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Desktop/mobile footer: exact-version review gate, stale draft protection, copy and readiness without sending passed. Screenshots: '+dir);
}finally{await browser.close();}
