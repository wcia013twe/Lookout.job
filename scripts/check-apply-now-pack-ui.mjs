import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:850},reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.LOOKOUT_UI_URL||'http://localhost:3054')+'/discover/?demo=1');
 const pack=page.locator('dialog[open]');
 await pack.getByRole('heading',{name:'Your Apply Now pack',exact:true}).waitFor();
 const before=await page.evaluate(()=>({applications:window.JB.store.get('workflow.applications'),tracker:window.JB.store.get('tracker.items')}));
 assert.equal(await page.evaluate(()=>window.JB.store.get('drops.packStamps')['apply-now:demo-discover-good']),true);
 await pack.locator('.pack-tear-button').click();
 await pack.getByRole('button',{name:'Reveal all',exact:true}).click();
 await pack.getByText('Backend Engineer, Query Systems',{exact:true}).first().waitFor();
 await pack.getByRole('button',{name:'Close pack',exact:true}).click();
 await pack.waitFor({state:'detached'});
 await page.getByRole('link',{name:'Applications',exact:true}).click();
 await page.getByLabel('Search tracked roles').waitFor();
 await page.getByRole('link',{name:'Discover',exact:true}).click();
 await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();
 assert.equal(await pack.count(),0,'Returning to Discover must not reactivate the same card');
 await page.evaluate(()=>window.JB.store.update('demo.roles',roles=>roles.map(role=>role.id==='demo-discover-unknown'?{...role,priority:'Apply Now'}:role)));
 await pack.getByRole('heading',{name:'Your Apply Now pack',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.JB.store.get('drops.packStamps')['apply-now:demo-discover-unknown']),true);
 await pack.locator('.pack-tear-button').click();
 await pack.getByRole('button',{name:'Reveal all',exact:true}).click();
 await pack.getByText('Software Engineer, Distributed Search Infrastructure and Query Performance',{exact:true}).first().waitFor();
 assert.equal(await pack.getByText('Example Query Labs (demo)',{exact:false}).count(),0,'Only newly eligible cards belong in the next pack');
 await pack.getByRole('button',{name:'Close pack',exact:true}).click();
 await pack.waitFor({state:'detached'});
 for(const priority of ['Strong Consider','Apply Now']) {
  await page.evaluate(priority=>window.JB.store.update('demo.roles',roles=>roles.map(role=>role.id==='demo-discover-unknown'?{...role,priority}:role)),priority);
  await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();
  assert.equal(await pack.count(),0,'Reclassification must not replay an activated card');
 }
 assert.deepEqual(await page.evaluate(()=>({applications:window.JB.store.get('workflow.applications'),tracker:window.JB.store.get('tracker.items')})),before,'Pack activation must not apply or track jobs');
 await page.reload();
 await pack.getByRole('heading',{name:'Your Apply Now pack',exact:true}).waitFor();
 await pack.getByRole('button',{name:'Close pack',exact:true}).click();
 await pack.waitFor({state:'detached'});
 await page.setViewportSize({width:390,height:844});
 await page.getByLabel('Search roles or companies').fill('Example');
 assert.equal(await pack.count(),0,'Dismissing a sealed pack also consumes its activation');
 assert.deepEqual(errors,[]);
 console.log('Apply Now pack: first arrival, per-card updates, once-only dismissal/navigation, mobile, and application isolation passed.');
} finally { await browser.close(); }
