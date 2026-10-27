// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-search-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>localStorage.setItem('sb-umhqfqzpwmszhcknwtrs-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 await context.route('https://umhqfqzpwmszhcknwtrs.supabase.co/**',async route=>{
  cloud.push(route.request().url());const url=route.request().url();
  const op=route.request().postDataJSON()?.operation;
  const body=url.includes('/auth/v1/user')?user:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LOOKOUT_UI_URL||'http://localhost:3031')+'/discover/?demo=1');
 const searches=page.getByRole('region',{name:'Agent searches',exact:true});
 const summary=searches.locator('summary').first();
 await summary.getByText('Incomplete',{exact:false}).waitFor({timeout:12000}).catch(async e=>{console.log(await page.locator('body').innerText());await searches.screenshot({path:dir+'/failure.png'});throw e;});
 assert.match(await summary.innerText(),/Latest search[\s\S]*Oct 20[\s\S]*Incomplete/);
 assert.equal(await searches.getByRole('heading',{name:'Agent searches',exact:true}).isVisible(),false);
 for(const [name,width,height,theme] of [['desktop',1440,1000,'dark'],['mobile',390,844,'light']]){
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});
  assert.equal(await searches.getByRole('button',{name:'New search',exact:true}).isVisible(),false);
  await searches.screenshot({path:dir+'/compact-'+name+'.png'});
  await summary.click();
  await searches.getByRole('button',{name:'New search',exact:true}).waitFor();
  const runs=searches.locator('details > div > ul > li > button');
  assert.equal(await runs.count(),2);
  assert.match(await runs.first().innerText(),/Oct 20[\s\S]*Incomplete/);
  await runs.first().click();
  await searches.getByText('Fictional example: personal agent search unavailable.',{exact:true}).waitFor();
  assert(await searches.getByText('Example Systems (fictional) · Backend Engineering Intern').isVisible());
  await searches.screenshot({path:dir+'/expanded-'+name+'.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Search view overflows');
  await runs.first().click();
  await summary.click();
 }
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({status:'passed',artifacts:dir,checks:['latest run selected from unsorted demo history','collapsed controls and history','desktop dark/mobile light','expand coverage and discoveries','no overflow or page errors']}));
}finally{await browser.close();}
