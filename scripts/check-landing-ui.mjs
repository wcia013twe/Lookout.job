const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE || '../runner/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const base=process.env.LOOKOUT_UI_URL || 'http://127.0.0.1:3059';
const dir=process.env.LOOKOUT_UI_ARTIFACTS || '/private/tmp/lookout-landing-review';await mkdir(dir,{recursive:true});
const errors=[];
try {
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 await context.route('https://*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/`);
 await page.getByRole('heading',{name:'Your next move is in the cards.'}).waitFor();
 await page.waitForTimeout(900);
 await page.getByRole('button',{name:'Pause motion',exact:true}).click();
 assert.equal(await page.locator('[data-paused]').count(),1);
 assert.equal(await page.locator('[data-paused] span').first().evaluate(el => getComputedStyle(el).animationName),'none');
 await page.screenshot({path:`${dir}/${width===1440?'desktop':'mobile'}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Review role',exact:true}).click();
 await page.getByText('Reviewing a role never submits an application.').waitFor();
 await page.getByRole('button',{name:'Pass',exact:true}).click();
 await page.getByText('A chance to build on your interest in distributed systems at scale.').waitFor();
 assert.equal(await page.locator('#landing-role-review').count(),0);
 await page.getByRole('link',{name:'Find your next move',exact:true}).click();
 await page.getByRole('heading',{name:'Sign up or sign in.'}).waitFor();
 await page.goto(`${base}/`);
 await page.getByRole('link',{name:'Log in',exact:true}).click();
 await page.getByRole('heading',{name:'Sign in to your workspace'}).waitFor();
 await context.close();
}
const reduced=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});
const quiet=await reduced.newPage();await quiet.goto(`${base}/`);
assert.equal(await quiet.getByRole('button',{name:'Pause motion',exact:true}).isVisible(),false);
assert.equal(await quiet.locator('[class*=sclera]').first().evaluate(el=>getComputedStyle(el).animationName),'none');
await reduced.close();
assert.deepEqual(errors,[]);console.log('Desktop/mobile overflow, review/pass isolation, signup/login routing and runtime checks passed.');
}finally{await browser.close()}
