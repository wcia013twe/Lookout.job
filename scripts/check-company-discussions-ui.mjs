// Detached fictional demo only; no real account or external submissions.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-company-discussions';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const [name,width,height,colorScheme] of [['desktop',1440,1000,'dark'],['mobile',390,844,'light']]){
  const context=await browser.newContext({viewport:{width,height},colorScheme,serviceWorkers:'block'});
  let cloudCalls=0;const errors=[];
  await context.route('**/*.supabase.co/**',route=>{if(!new URL(route.request().url()).pathname.startsWith('/storage/v1/object/public/company-logos/'))cloudCalls++;return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto((process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3074')+'/circles/?demo=1');
  await page.getByRole('navigation',{name:'Community views'}).getByRole('button',{name:'Companies',exact:true}).click();
  const discussions=page.getByRole('region',{name:'Company discussions',exact:true});
  await discussions.getByRole('button',{name:'Search',exact:true}).waitFor({state:'visible'});
  await discussions.getByRole('region',{name:'Companies from your applications'}).getByRole('button',{name:'Stripe',exact:true}).click();
  await discussions.getByRole('button',{name:'Stripe OA: a fictional recruiting update',exact:true}).waitFor();
  await discussions.screenshot({path:`${dir}/${name}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow');
  await discussions.getByRole('button',{name:'Stripe OA: a fictional recruiting update',exact:true}).click();
  await page.getByRole('heading',{name:'Stripe OA: a fictional recruiting update',exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to your circles',exact:true}).click();
  await discussions.getByLabel('Company',{exact:true}).fill('No Such Company');
  await discussions.getByRole('button',{name:'Search',exact:true}).click();
  await discussions.getByText('No matching discussions in your Circles. Try a different company or clear your search.').waitFor();
  await discussions.getByRole('button',{name:'Clear search',exact:true}).click();
  await discussions.getByRole('button',{name:'Stripe OA: a fictional recruiting update',exact:true}).waitFor();
  await page.reload();await discussions.getByRole('heading',{name:'Company discussions',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Community views'}).getByRole('button',{name:'Circles',exact:true}).click();
  await page.getByRole('heading',{name:'Your circles',exact:true}).waitFor();
  assert.equal(cloudCalls,0);assert.deepEqual(errors,[]);
  console.log(`${name}: subviews, company shortcut, source thread, return, empty/clear, reload, overflow and isolated demo passed`);
  await context.close();
 }
}finally{await browser.close();}
