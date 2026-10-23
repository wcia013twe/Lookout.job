// Fictional demo only. Never reads a real file, account, or backend.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3057',dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-simplify-ui';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),calls=[],errors=[];
  await context.route('https://*.supabase.co/**',r=>{if(!r.request().url().includes('/storage/v1/object/public/company-logos/'))calls.push(r.request().url());return r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(`${base}/applications/?demo=1`);await page.getByRole('heading',{name:'Your Job Tracker'}).waitFor();
  await page.getByText('Import from Simplify',{exact:true}).click();
  await page.getByRole('button',{name:'Preview fictional Simplify CSV'}).click();
  await page.getByText('4 rows reviewed',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Import 3 jobs into demo',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`${dir}/${name}-preview.png`,fullPage:true});
  await page.getByRole('button',{name:'Import 3 jobs into demo',exact:true}).click();
  await page.getByText('3 jobs imported. 0 existing jobs preserved. 1 repeated rows combined.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Saved jobs',exact:true}).click();
  const saved=page.locator('li').filter({hasText:'Example Compute (demo)'}).filter({hasText:'Simplify import'}).first();
  await saved.locator('summary').first().click();
  await saved.getByText('No job link was included in this export.',{exact:true}).waitFor();
  assert(await saved.locator('.tracker-role strong').evaluate(e=>e.getBoundingClientRect().width>150 && e.getBoundingClientRect().height<90),'Imported job title must remain readable');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`${dir}/${name}-saved.png`,fullPage:true});
  await page.getByRole('button',{name:'Closed',exact:true}).click();
  await page.getByText('Example Archive (demo)',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Active',exact:true}).click();
  const applied=page.locator('li').filter({hasText:'Example Systems (demo)'}).filter({hasText:'Simplify import'}).first();
  await applied.locator('summary').first().click();
  await applied.getByText('Applied date: 2026-10-20. User-reported from Simplify.',{exact:true}).waitFor();
  await applied.getByText('Original reports (2)',{exact:true}).click();
  await applied.getByText('Earlier fictional report',{exact:true}).last().waitFor();
  await page.getByRole('button',{name:'Preview fictional Simplify CSV'}).click();
  await page.getByText('4 rows reviewed',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Import 0 jobs into demo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.reload();await page.getByRole('heading',{name:'Your Job Tracker'}).waitFor();
  assert.equal(await page.getByText('Simplify import',{exact:true}).count(),0,'Demo reload clears imported history');
  assert.deepEqual(errors,[]);assert.deepEqual(calls,[],'Demo must not call account services');
  await context.close();
 }
 console.log('PASS: desktop/mobile preview, import, saved and archived history, dates, repeated source rows, reimport, reset, no overflow, no account traffic');
}finally{await browser.close();}
