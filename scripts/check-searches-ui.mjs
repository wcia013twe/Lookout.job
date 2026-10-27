// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
const {chromium} = await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE || '../runner/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-profile-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>localStorage.setItem('sb-osyrlausutnqzlegxmnd-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 await context.route('https://osyrlausutnqzlegxmnd.supabase.co/**',async route=>{
  cloud.push(route.request().url());const url=route.request().url();
  const op=route.request().postDataJSON()?.operation;
  const body=url.includes('/auth/v1/user')?user:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LOOKOUT_UI_URL || 'http://localhost:3027')+'/discover/');
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Demo mode',exact:true}).click();
 const section=page.getByRole('region',{name:'Agent searches'});
 await section.getByRole('button',{name:/Full-time engineering/}).click();
 await section.getByRole('heading',{name:'Source coverage'}).waitFor();
 await section.getByRole('button',{name:/Full-time engineering/}).click();
 await section.screenshot({path:'/private/tmp/searches-desktop.png'});
 await section.getByRole('button',{name:'New search',exact:true}).click();
 await section.getByLabel('Search window').selectOption('backlog');
 await section.getByRole('button',{name:'Request search',exact:true}).click();
 await section.getByText('Fictional request queued in this preview; no agent is contacted.').waitFor();
 await page.setViewportSize({width:390,height:844});
 await section.screenshot({path:'/private/tmp/searches-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: disclosure, request, desktop/mobile layout, demo isolation');
}finally{await browser.close();}
