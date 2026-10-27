// Fictional detached demo only; never contacts account storage or external services.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-interview-intelligence-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});let cloudCalls=0;const errors=[];
 await context.route('**/*.supabase.co/**',route=>{cloudCalls++;return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto((process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3069')+'/applications/?demo=1');
 await page.getByRole('button',{name:'Open Backend Engineer at Cedar Systems (demo)',exact:true}).click();
 const panel=page.getByRole('dialog'),reports=panel.getByRole('region',{name:'Interview reports',exact:true});
 await reports.getByRole('heading',{name:'From your Circles'}).waitFor();
 await reports.getByText(/Fictional experience: explain idempotency/).waitFor();
 assert.match(await reports.getByRole('link',{name:'Read conversation'}).getAttribute('href'),/circle=demo-circle&thread=demo-cedar-intelligence/);
 await reports.scrollIntoViewIfNeeded();await reports.screenshot({path:dir+'/desktop.png'});
 await reports.getByRole('button',{name:'Refresh interview reports'}).click();await reports.getByRole('button',{name:'Refresh interview reports'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});await reports.scrollIntoViewIfNeeded();await reports.screenshot({path:dir+'/mobile.png'});
 assert(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Mobile dialog overflow');
 await panel.getByRole('button',{name:'Close application details'}).click();
 await page.getByRole('button',{name:'Open Database Engineer at Harbor Data (demo)',exact:true}).click();
 await reports.getByRole('button',{name:'Check interview reports',exact:true}).waitFor();
 assert.equal(await reports.getByRole('heading',{name:'From your Circles'}).count(),0);
 assert.equal(await reports.getByRole('status').count(),0,'Automatic empty result must remain silent');
 await reports.getByRole('button',{name:'Check interview reports',exact:true}).click();
 await reports.getByText('No matching reports were found in your accessible Circles.').waitFor();
 await reports.screenshot({path:dir+'/empty-direct.png'});
 assert.equal(cloudCalls,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['posting-specific fictional evidence','source navigation','manual refresh','automatic empty silence','explicit empty explanation','desktop/mobile','no overflow','no cloud requests'],artifacts:dir},null,2));
}finally{await browser.close();}
