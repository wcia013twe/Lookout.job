// Resettable detached-demo coverage. No real account or backend writes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const base=process.env.LOOKOUT_UI_URL||'http://localhost:3077';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-agent-schedule';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const [scenario,width,height,scheme] of [['missing',1440,1000,'dark'],['empty',390,844,'light'],['custom',1440,1000,'dark']]) {
  const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,serviceWorkers:'block'});
  const calls=[],errors=[];
  await context.route('**/rest/v1/**',route=>{calls.push(route.request().url());return route.abort();});
  await context.route('**/functions/v1/**',route=>{calls.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/profile/?demo=1');await page.getByRole('heading',{name:'My Profile',exact:true}).waitFor();
  await page.evaluate(scenario=>window.JB.store.update('workflow.searchPreferences',previous=>{
   const next={...previous};
   if(scenario==='missing')delete next.schedule;
   else next.schedule={enabled:false,timezone:'America/New_York',configVersion:2,routines:scenario==='custom'?[{id:'custom',title:'My existing task',description:'Keep these instructions.',enabled:false,mode:'manual',time:'',sourceIds:[],connectionIds:[]}]:[]};
   return next;
  }),scenario);
  if(width<600)await page.getByRole('combobox',{name:'Profile section',exact:true}).selectOption('agent');
  else await page.getByRole('navigation',{name:'Profile sections',exact:true}).getByRole('button',{name:'My Agent',exact:true}).click();
  await page.getByRole('navigation',{name:'Agent settings',exact:true}).getByRole('button',{name:'Search',exact:true}).click();
  const tasks=page.getByRole('list',{name:'My Agent automation tasks',exact:true});await tasks.waitFor();
  const section=tasks.locator('xpath=ancestor::section[1]');
  if(scenario==='custom') {
   assert.equal(await tasks.locator(':scope > li').count(),1);
   await tasks.getByText('My existing task',{exact:true}).waitFor();
   assert.equal(await section.getByRole('button',{name:'Use default schedule',exact:true}).count(),0);
  } else {
   if(scenario==='empty'){
    assert.equal(await tasks.locator(':scope > li').count(),0);
    await section.getByRole('button',{name:'Use default schedule',exact:true}).click();
   }
   assert.equal(await tasks.locator(':scope > li').count(),4);
   const text=await tasks.innerText();for(const time of ['08:00','12:00','15:00','20:00'])assert(text.includes(time));
   for(const title of ['Morning sweep','Midday check-in','Afternoon focus','Evening networking'])await tasks.getByText(title,{exact:true}).waitFor();
   assert.equal(await section.getByRole('button',{name:'Save tasks',exact:true}).isEnabled(),true);
   await section.getByRole('button',{name:'Save tasks',exact:true}).click();
   await section.getByText('Demo tasks saved. Changes stay in this preview.',{exact:true}).waitFor();
  }
  const info=section.getByRole('button',{name:'About My Agent tasks',exact:true});
  await info.focus();await page.keyboard.press('Enter');
  const panel=page.locator('[popover]:popover-open');await panel.waitFor();
  assert.match(await panel.innerText(),/does not create a running automation/);
  const rect=await panel.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width+1);
  await page.keyboard.press('Escape');assert.equal(await panel.count(),0);
  await section.scrollIntoViewIfNeeded();await section.screenshot({path:`${dir}/${scenario}-tasks.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(calls,[]);assert.deepEqual(errors,[]);console.log(scenario+': defaults, saved-state preservation, help keyboard/overflow, demo isolation passed');
  await context.close();
 }
}finally{await browser.close();}
