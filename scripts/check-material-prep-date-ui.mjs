import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LOOKOUT_UI_URL||'http://localhost:3107';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const dir='/private/tmp/material-prep-date-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch(),errors=[];
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/\/(rest|functions)\/v1\//.test(request.url()))errors.push('Demo attempted backend access');});
  await page.goto(base+'/career-toolkit/?demo=1&artifact=aaaaaaaa-2222-4000-8000-222222222222');
  const input=page.getByLabel('Prep on',{exact:true});await input.waitFor();
  const original=await input.inputValue();assert(original);
  await input.fill('2026-11-16');await page.getByRole('button',{name:'Save date',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Prep date saved'}).waitFor();assert.equal(await input.inputValue(),'2026-11-16');
  assert(await page.getByRole('button',{name:'Clear date',exact:true}).isEnabled());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'No horizontal overflow');
  await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Clear date',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Prep date cleared'}).waitFor();assert.equal(await input.inputValue(),'');
  assert.equal(await page.getByRole('button',{name:'Clear date',exact:true}).count(),0);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Passed: desktop/mobile date save and clear, read-back, overflow, and detached demo isolation. Screenshots: '+dir);
}finally{await browser.close();}
