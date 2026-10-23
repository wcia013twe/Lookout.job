// Profile access checks with fictional auth responses; no real account sign-in.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const base=process.env.LOOKOUT_UI_URL||'http://localhost:3076';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-profile-access';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const mode of ['guest','signed-in','anonymous','demo']) {
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
  const errors=[],calls=[];
  const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{},user_metadata:{},is_anonymous:mode==='anonymous'};
  if(mode==='signed-in'||mode==='anonymous') {
   const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
   const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
   await context.addInitScript(({user,token})=>localStorage.setItem('sb-umhqfqzpwmszhcknwtrs-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
  }
  await context.route('https://umhqfqzpwmszhcknwtrs.supabase.co/**',async route=>{
   calls.push(route.request().url());const url=route.request().url();
   const op=route.request().postDataJSON()?.operation;
   const body=url.includes('/auth/v1/user')?user:url.includes('/auth/v1/logout')?{}:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  if(mode==='guest'||mode==='anonymous') await context.addInitScript(()=>{
   window.profileEditorMounted=false;
   new MutationObserver(()=>{if(document.querySelector('nav[aria-label="Profile sections"]'))window.profileEditorMounted=true;}).observe(document,{subtree:true,childList:true});
  });
  await page.goto(base+'/profile/?section=appearance'+(mode==='demo'?'&demo=1':''));
  if(mode==='guest'||mode==='anonymous') {
   await page.waitForURL(base+'/');
   assert.equal(await page.getByRole('navigation',{name:'Profile sections',exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>window.profileEditorMounted),false,'Profile editor must not flash before redirect');
  } else await page.getByRole('navigation',{name:'Profile sections',exact:true}).waitFor();
  await page.getByRole('button',{name:'Open profile navigation',exact:true}).click();
  const menu=page.getByRole('navigation',{name:'Profile navigation',exact:true});
  assert.equal(await menu.getByRole('button',{name:'Demo mode',exact:true}).count(),0);
  assert.equal(await menu.getByRole('button',{name:'Exit demo mode',exact:true}).count(),mode==='demo'?1:0);
  assert.equal(await menu.getByRole('link',{name:'My Profile',exact:true}).count(),mode==='guest'||mode==='anonymous'?0:1);
  await page.screenshot({path:`${dir}/${mode}.png`});
  if(mode==='signed-in') {
   await menu.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.waitForURL(base+'/');
   assert.equal(await page.getByRole('navigation',{name:'Profile sections',exact:true}).count(),0);
   await page.getByRole('button',{name:'Open profile navigation',exact:true}).click();
   assert.equal(await page.getByRole('link',{name:'My Profile',exact:true}).count(),0);
  }
  if(mode==='demo')assert.deepEqual(calls,[],'Demo must remain detached from account services');
  assert.deepEqual(errors,[]);console.log(mode+': menu and direct-route access passed');
  await context.close();
 }
}finally{await browser.close();}
