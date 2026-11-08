import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LOOKOUT_UI_URL||'http://localhost:3194';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an isolated local demo.');
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/tmp/discovered-role-widget';await mkdir(dir,{recursive:true});
const browser=await chromium.launch();
try{
 for(const [name,viewport,colorScheme] of [['desktop',{width:1440,height:1000},'light'],['mobile',{width:390,height:844},'dark']]){
  const context=await browser.newContext({viewport,colorScheme,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/(rest|functions)\/v1\//.test(r.url()))errors.push('Fictional widget contacted a private backend');});
  await page.goto(base+'/discover/?demo=1');
  const card=page.locator('[data-discovered-role="demo-discover-good"]');await card.waitFor();
  await card.getByText('Strong fit',{exact:true}).waitFor();
  const consider=page.locator('[data-discovered-role="demo-discover-unknown"] [data-priority="consider"]');
  await consider.getByText('Strong Consider',{exact:true}).waitFor();
  assert.equal(await consider.evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap');
  await consider.screenshot({path:`${dir}/${name}-strong-consider.png`});
  assert.equal(await card.getByRole('list',{name:/Shared application stage/}).count(),0,'Opportunity has no application progress');
  assert(await card.getByRole('button',{name:'AI Apply',exact:true}).isEnabled());
  const summary=card.locator('summary').filter({hasText:'76% job match'});
  await summary.click();assert(await card.getByLabel('75 out of 100',{exact:true}).isVisible());await summary.click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${name}.png`});
  await card.getByRole('button',{name:'Backend Engineer, Query Systems',exact:true}).focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('heading',{name:'About the job',exact:true}).waitFor();
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  await card.getByRole('button',{name:'AI Apply',exact:true}).click();await card.getByRole('button',{name:'Queued',exact:true}).waitFor();
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Compact discovery widget: light desktop/dark mobile, expandable saved match, keyboard preview, queue action, no overflow or private writes. '+dir);
}finally{await browser.close();}
