// Isolated fictional Circle entry check; never writes to a real account.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-circle-entry';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const [name,width,height,colorScheme] of [['desktop',1440,1000,'dark'],['mobile',390,844,'light']]) {
  const context=await browser.newContext({viewport:{width,height},colorScheme,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],writes=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/rest/v1/**',route=>{writes.push(route.request().url());return route.abort();});
  await context.route('**/functions/v1/**',route=>{writes.push(route.request().url());return route.abort();});
  await page.goto((process.env.LOOKOUT_UI_URL||'http://localhost:3074')+'/circles/preview/');
  await page.getByText('Join or create a Circle',{exact:true}).click();
  const entry=page.getByRole('region',{name:'Join a Circle',exact:true});
  await entry.getByLabel('Your name',{exact:true}).fill('Taylor (demo)');
  await entry.getByRole('button',{name:'Create a Circle',exact:true}).click();
  const create=page.getByRole('region',{name:'Create a Circle',exact:true});
  assert.equal(await create.getByLabel('Your name',{exact:true}).inputValue(),'Taylor (demo)');
  assert.equal(await create.getByLabel('Invite code').count(),0);
  await create.getByRole('button',{name:'Join a Circle',exact:true}).click();
  await entry.getByLabel('Invite code').fill('demo-invite');
  await entry.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
  await entry.getByRole('button',{name:'Join Circle',exact:true}).click();
  await page.getByRole('button',{name:'Back to your circles',exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to your circles',exact:true}).click();
  await page.getByText('Join or create a Circle',{exact:true}).click();
  await page.getByRole('button',{name:'Create a Circle',exact:true}).click();
  const form=page.getByRole('region',{name:'Create a Circle',exact:true});
  await form.getByLabel('Circle name').fill('Small steps (demo)');
  await form.getByLabel('Your name',{exact:true}).fill('Taylor (demo)');
  await form.getByRole('button',{name:'Create private Circle',exact:true}).click();
  await page.getByRole('button',{name:'Back to your circles',exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log(`${name}: single form, mode switch, name retention, join/create, no overflow or account writes passed`);
  await context.close();
 }
} finally {await browser.close();}
