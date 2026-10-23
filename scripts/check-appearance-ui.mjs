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
  const market=appearance.getByRole('region',{name:'Marketplace',exact:true});
  await market.getByRole('heading',{name:'Marketplace',exact:true}).waitFor();
  const pack=await appearance.getByRole('heading',{name:'Pack texture',exact:true}).boundingBox();
  const heading=await market.getByRole('heading',{name:'Marketplace',exact:true}).boundingBox();
  assert(heading.y>pack.y,'Marketplace follows the appearance controls');
  const save=market.getByRole('button',{name:'Save for this visit',exact:true});
  if(await save.count())await save.click();
  await market.getByRole('button',{name:/^Saved \(/}).click();
  await market.getByText('1 theme concepts for Dashboard',{exact:true}).waitFor();
  await market.getByRole('button',{name:'Browse',exact:true}).click();
  await market.getByRole('button',{name:'Circles',exact:true}).click();
  await market.getByRole('region',{name:'Circles theme preview',exact:true}).waitFor();
  await market.getByRole('button',{name:'Dashboard',exact:true}).click();
  await market.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await market.screenshot({path:`${dir}/${name}-marketplace.png`});
  await page.getByRole('button',{name:'Open profile navigation'}).click();
  assert.equal(await page.getByRole('link',{name:'Browse Marketplace',exact:true}).count(),0);
  await page.keyboard.press('Escape');
 }
 assert.equal(cloud.length,before,'Preview interactions must not write to the account');
 assert.deepEqual(errors,[]);
 console.log('PASS: Marketplace under Appearance, removed menu shortcut, browse/save/surface previews, desktop/mobile, no overflow or account writes');
}finally{await browser.close();}
