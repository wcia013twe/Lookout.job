// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
const {chromium} = await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE || '../runner/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-appearance-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 await context.route('**/rest/v1/**',route=>{cloud.push(route.request().url());return route.abort();});
 await context.route('**/functions/v1/**',route=>{cloud.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LOOKOUT_UI_URL || 'http://localhost:3075') + '/profile/?demo=1');
 await page.getByRole('navigation',{name:'Profile sections'}).waitFor();

 const before=cloud.length;
 for(const [name,width,height,colorScheme] of [['desktop',1440,1000,'dark'],['mobile',390,844,'light']]) {
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme});
  if(name==='desktop')await page.getByRole('button',{name:'Appearance',exact:true}).click();
  else await page.getByRole('combobox',{name:'Profile section',exact:true}).selectOption('appearance');
  const appearance=page.getByRole('region',{name:'Appearance',exact:true});
  assert.equal(await appearance.getByRole('region',{name:'Marketplace',exact:true}).count(),0);
  assert.equal(await appearance.getByRole('heading',{name:'Marketplace',exact:true}).count(),0);
  await appearance.getByRole('heading',{name:'Pack texture',exact:true}).waitFor();
  await appearance.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await appearance.screenshot({path:`${dir}/${name}-appearance.png`});
  await page.getByRole('button',{name:'Open profile navigation'}).click();
  assert.equal(await page.getByRole('link',{name:'Browse Marketplace',exact:true}).count(),0);
  assert.equal(await page.getByRole('navigation',{name:'Profile navigation'}).getByRole('link',{name:'Appearance',exact:true}).count(),0);
  await page.keyboard.press('Escape');
 }
 assert.equal(cloud.length,before,'Preview interactions must not write to the account');
 assert.deepEqual(errors,[]);
 console.log('PASS: Marketplace hidden in Appearance, removed menu shortcut, desktop/mobile, no overflow or account writes');
}finally{await browser.close();}
