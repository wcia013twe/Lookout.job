// Real browser regression using fictional auth and intercepted APIs only.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3047';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-signed-out-ui';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
try {
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  const context=await browser.newContext({viewport,colorScheme:'dark',serviceWorkers:'block'});
  await context.route('https://*.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  await page.addInitScript(()=>{
   localStorage.setItem('job-signal-state-v1',JSON.stringify({workflow:{profile:{name:'Private guest fixture'},applications:{}},progress:{xp:9876},tracker:{ids:[]}}));
   window.__workspaceLeaks=[];
   new MutationObserver(()=>{
    const text=document.body?.innerText||'';
    if(/Private guest fixture|9876 XP|Last scan:|to review ·/.test(text))window.__workspaceLeaks.push(text);
   }).observe(document,{childList:true,subtree:true});
  });
  for(const path of ['discover/', 'applications/', 'needs-you/', 'profile/', 'referrals/', 'circles/', 'progress/','career-toolkit/']) {
   await page.goto(`${base}/${path}`);
   await page.getByRole('heading',{name:'Sign in to your workspace'}).waitFor();
   await page.getByRole('button',{name:'Sign in with Google',exact:true}).waitFor();
   assert.equal(await page.locator('input[aria-label="Search roles or companies"]').count(),0);
   assert.deepEqual(await page.evaluate(()=>window.__workspaceLeaks),[]);
  }
  await page.goto(`${base}/`);await page.getByRole('heading',{name:'Your next move is in the cards.'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${dir}/signed-out-${viewport.width}.png`,fullPage:true});
  await page.goto(`${base}/privacy/`);await page.getByRole('heading',{level:1}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Sign in to your workspace'}).count(),0);
  await page.goto(`${base}/?demo=1`);await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Sign in to your workspace'}).count(),0);
  await page.screenshot({path:`${dir}/demo-${viewport.width}.png`,fullPage:true});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>localStorage.setItem('sb-osyrlausutnqzlegxmnd-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),{user,token});
 await context.route('https://*.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/user')?user:path.endsWith('/onboarding_action')?{data:{websiteCompletedAt:'2026-10-23T00:00:00Z'}}:[])});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(`${base}/`);await page.getByRole('heading',{name:'Room for your next move.'}).waitFor();
 assert.equal(await page.locator('input[aria-label="Search roles or companies"]').count(),0,'New account does not fall back to catalog');
 await page.evaluate(()=>window.JB.auth.client.auth.signOut({scope:'local'}));
 await page.getByRole('heading',{name:'Your next move is in the cards.'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Room for your next move.'}).count(),0);
 await context.close();
 assert.deepEqual(errors,[]);
 console.log('Signed-out desktop/mobile, guest-cache isolation, public privacy, explicit demo, empty account and sign-out checks passed.');
} finally {await browser.close();}
