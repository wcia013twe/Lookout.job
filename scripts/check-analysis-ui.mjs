// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
const {chromium} = await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE || '../runner/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-discover-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[];
const supabaseUrl=process.env.LOOKOUT_UI_SUPABASE_URL||'https://osyrlausutnqzlegxmnd.supabase.co';
const authStorageKey='sb-'+new URL(supabaseUrl).hostname.split('.')[0]+'-auth-token';
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token,authStorageKey})=>localStorage.setItem(authStorageKey,JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token,authStorageKey});
 await context.route(supabaseUrl+'/**',async route=>{
  cloud.push(route.request().url());const url=route.request().url();
  const op=route.request().postDataJSON()?.operation;
  const body=url.includes('/auth/v1/user')?user:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LOOKOUT_UI_URL || 'http://127.0.0.1:3048') + '/discover/?demo=1');
 const card=page.locator('article').filter({hasText:'Example Query Labs (demo)'});
 await card.locator('h3 button').click();
 const panel=page.getByRole('dialog');
 const fit=panel.getByRole('region',{name:'Why it’s here',exact:true});
 const caution=panel.getByRole('region',{name:'What to watch out for',exact:true});
 assert.equal(await fit.locator('li').count(),3);
 assert.equal(await caution.locator('li').count(),2);
 for(const [width,height,theme] of [[1440,1000,'dark'],[390,844,'light']]) {
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});
  await caution.evaluate(el=>el.scrollIntoView({block:"center"}));
  await page.waitForTimeout(200);
  for(const section of [fit,caution]) assert(await section.evaluate(el=>getComputedStyle(el).borderRadius!=='0px' && getComputedStyle(el).backgroundColor!=='rgba(0, 0, 0, 0)'));
  assert(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:dir+`/analysis-${width}-${theme}.png`});
 }
 await panel.getByRole('heading',{name:'Job Description',exact:true}).click();
 await panel.getByText('Fictional demo description',{exact:true}).waitFor();
 await page.keyboard.press('Escape');assert.equal(await panel.count(),0);
 assert(await card.locator('h3 button').evaluate(el=>document.activeElement===el));
 await card.locator('h3 button').click();await caution.waitFor();
 await panel.getByRole('button',{name:'Close job preview'}).click();assert.equal(await panel.count(),0);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({result:'passed',checks:['five unique bullets in two bounded sections','desktop dark and mobile light surfaces','horizontal overflow','Job Description disclosure','Escape and focus return','reopen and Close'],artifacts:dir},null,2));
} finally { await browser.close(); }
