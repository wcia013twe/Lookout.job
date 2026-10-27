// Detached fictional demo only; no real account or external submissions.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-company-grid';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const [name,width,height,colorScheme] of [['desktop',1440,1100,'dark'],['mobile',390,844,'light'],['desktop-light',1440,1100,'light'],['mobile-dark',390,844,'dark']]){
  const context=await browser.newContext({viewport:{width,height},colorScheme,serviceWorkers:'block'});
  let cloudCalls=0;const errors=[];
  await context.route('**/*.supabase.co/**',route=>{if(!new URL(route.request().url()).pathname.startsWith('/storage/v1/object/public/company-logos/'))cloudCalls++;return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(/same key|unique.*key|hydration/i.test(message.text()))errors.push(message.text());});
  await page.goto((process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3074')+'/circles/?demo=1&view=companies');
  const discussions=page.locator('section[aria-labelledby="company-discussions-title"]');
  const recommended=discussions.getByRole('region',{name:'Where you’re interviewing',exact:true});
  const bloomberg=recommended.getByRole('article').filter({has:page.getByRole('heading',{name:'Bloomberg',exact:true})});
  await bloomberg.getByText('Beyond getting it right: explaining your coding decisions',{exact:true}).waitFor();
  assert.equal(await discussions.getByRole('searchbox').count(),1,'One search field');
  await bloomberg.getByText('Interview',{exact:true}).waitFor();
  await bloomberg.getByText('New Grad Software Engineer',{exact:true}).waitFor();
  assert.equal(await recommended.getByRole('article').first().getByRole('heading',{name:'Bloomberg',exact:true}).count(),1,'Bloomberg leads demo');
  const cards=await recommended.getByRole('article').all(),first=await cards[0].boundingBox(),second=await cards[1].boundingBox();
  assert(width>700?second.x>first.x:second.y>first.y,'Responsive grid columns');
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow');
  await discussions.getByRole('searchbox').fill('Bloomberg');
  await discussions.getByRole('button',{name:'Search',exact:true}).click();
  await discussions.getByRole('heading',{name:'Results for “Bloomberg”',exact:true}).waitFor();
  await discussions.getByRole('button',{name:'Explore Bloomberg discussions',exact:true}).click();
  const threads=discussions.getByRole('region',{name:'Bloomberg discussions',exact:true});
  await threads.getByRole('button',{name:'Beyond getting it right: explaining your coding decisions',exact:true}).waitFor();
  await threads.getByText('Fictional individual experience for the product demo; not a claim about Bloomberg’s hiring process.').waitFor();
  await page.screenshot({path:`${dir}/${name}-threads.png`,fullPage:true});
  await threads.getByRole('button',{name:'Beyond getting it right: explaining your coding decisions',exact:true}).click();
  await page.getByRole('heading',{name:'Beyond getting it right: explaining your coding decisions',exact:true}).waitFor();
  await page.getByRole('button',{name:'Write a reply',exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to your circles',exact:true}).click();
  await discussions.getByRole('searchbox').fill('NoSuchCompanyXYZ');
  await discussions.getByRole('button',{name:'Search',exact:true}).click();
  await discussions.getByRole('heading',{name:'No companies found for that search.',exact:true}).waitFor();
  await discussions.getByRole('button',{name:'Clear search',exact:true}).first().click();
  await recommended.getByRole('heading',{name:'Bloomberg',exact:true}).waitFor();
  await page.reload();await recommended.getByRole('heading',{name:'Bloomberg',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Community views'}).getByRole('button',{name:'Circles',exact:true}).click();
  await page.getByRole('heading',{name:'Your circles',exact:true}).waitFor();
  assert.equal(cloudCalls,0);assert.deepEqual(errors,[]);
  console.log(`${name}: single search, interviewing recommendations, Bloomberg evidence, responsive grid, company/thread/reply entry, empty/clear, reload and demo isolation passed`);
  await context.close();
 }
}finally{await browser.close();}
