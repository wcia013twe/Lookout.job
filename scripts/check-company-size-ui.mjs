// Fictional demo interactions; no account writes or external submissions.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=process.env.LOOKOUT_UI_ARTIFACTS || join(tmpdir(),'lookout-company-size-ui');
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const writes=[];
 await context.route('**/rest/v1/**',route=>{writes.push(route.request().url());return route.abort();});
 const page=await context.newPage();
 await page.goto((process.env.LOOKOUT_UI_URL||'http://localhost:3094')+'/profile/?demo=1&section=preferences');
 page.setDefaultTimeout(12000);
 const section=page.getByRole('region',{name:'Companies & industries',exact:true});
 await section.getByRole('button',{name:'Edit Companies & industries',exact:true}).click();
 const sizes=section.getByRole('group',{name:'Company size',exact:true});
 assert.equal(await sizes.getByRole('checkbox').count(),9);
 assert.equal(await sizes.getByRole('checkbox',{checked:true}).count(),3);
 await sizes.getByRole('checkbox',{name:'Select all sizes',exact:true}).click();
 assert.equal(await sizes.getByRole('checkbox',{checked:true}).count(),9);
 await sizes.getByRole('checkbox',{name:'Unselect all sizes',exact:true}).click();
 assert.equal(await sizes.getByRole('checkbox',{checked:true}).count(),0);
 await sizes.getByText('1,001–5,000 employees',{exact:true}).click();
 assert(await sizes.getByRole('checkbox',{name:'1,001–5,000 employees',exact:true}).isChecked());
 await sizes.getByRole('checkbox',{name:'1–10 employees',exact:true}).focus();
 await page.keyboard.press('Space');
 assert(await sizes.getByRole('checkbox',{name:'1–10 employees',exact:true}).isChecked());
 await page.keyboard.press('Space');
 await page.waitForTimeout(900);
 await section.getByRole('button',{name:'Finish editing Companies & industries',exact:true}).click();
 await section.getByText('1,001–5,000',{exact:true}).waitFor();
 await section.getByRole('button',{name:'Edit Companies & industries',exact:true}).click();
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
  await page.setViewportSize({width,height});
  await sizes.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await section.screenshot({path:`${dir}/${name}.png`});
 }
 assert.deepEqual(writes,[],'Demo must not write real account data');
 console.log('Passed: eight ranges, selected demo subset, all/none, individual choice, autosave, desktop/mobile, no overflow, no account writes.');
} finally {await browser.close();}
