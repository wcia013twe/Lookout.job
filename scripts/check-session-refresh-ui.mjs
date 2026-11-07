// Exercises the real browser auth client with fictional sessions and intercepted APIs.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {SUPABASE_URL} from '../next-app/lib/supabase-config.mjs';
const base=process.env.LOOKOUT_UI_URL || 'http://127.0.0.1:3096';
const dir=process.env.LOOKOUT_UI_ARTIFACTS || join(tmpdir(),'lookout-session-refresh-ui');
await mkdir(dir,{recursive:true});
const key=`sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional-refresh@example.com',app_metadata:{},user_metadata:{},is_anonymous:false};
const jwt=expires=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:expires})).toString('base64url'),'fictional'].join('.');
const session=expired=>{const expires=Math.floor(Date.now()/1000)+(expired?-60:3600);return {access_token:jwt(expires),refresh_token:'fictional-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user};};
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 let refreshCount=0;
 async function context(saved) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.addInitScript(({key,saved})=>{
   if(saved && !sessionStorage.getItem('refresh-fixture-seeded')) {
    localStorage.setItem(key,JSON.stringify(saved));
    sessionStorage.setItem('refresh-fixture-seeded','1');
   }
   window.authFlashes=[];
   new MutationObserver(()=>{
    const headings=[...document.querySelectorAll('main h1')].map(el=>el.textContent);
    const buttons=[...document.querySelectorAll('main button')].map(el=>el.textContent.trim());
    if(headings.some(text=>['Welcome back','Create your account','Sign in to your workspace'].includes(text)) || buttons.some(text=>['Continue with Google','Sign in with Google','Checking sign-in…'].includes(text)))window.authFlashes.push(true);
   }).observe(document,{childList:true,subtree:true,characterData:true});
  },{key,saved});
  await context.route(`${SUPABASE_URL}/**`,async route=>{
   const url=route.request().url();
   let body=[];
   if(url.includes('/auth/v1/token')) {refreshCount++;await new Promise(resolve=>setTimeout(resolve,700));body=session(false);}
   else if(url.includes('/auth/v1/user'))body=user;
   else if(url.includes('/auth/v1/logout'))body={};
   else if(url.includes('/rpc/onboarding_action')) {await new Promise(resolve=>setTimeout(resolve,180));body={revision:1,step:'connection_pending',data:{websiteCompletedAt:'2026-10-23T12:00:00Z'}};}
   else if(url.includes('/rpc/search_action'))body={documents:[],profileId:null};
   else if(url.includes('/rpc/workspace_reset_action'))body=null;
   else if(url.includes('/rpc/artifact_action'))body={items:[],nextOffset:null};
   else if(url.includes('/rpc/company_action'))body={items:[]};
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
  });
  return context;
 }
 const account=await context(session(false));
 const page=await account.newPage();page.setDefaultTimeout(15000);
 for(const path of ['/', '/discover/', '/profile/', '/login/', '/signup/']) {
  await page.goto(base+path);
  await page.getByRole('navigation',{name:'Workspace pages',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.authFlashes),[],`No auth screen while restoring ${path}`);
  await page.reload();
  await page.getByRole('navigation',{name:'Workspace pages',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.authFlashes),[],`No auth screen on refresh of ${path}`);
 }
 assert.equal(refreshCount,0,'A valid persisted session needs no token refresh or Google sign-in');
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/discover/');
 await page.getByRole('navigation',{name:'Workspace pages',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:join(dir,'restored-mobile.png')});
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();
 await page.reload();
 await page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();
 assert.equal(await page.getByRole('navigation',{name:'Workspace pages',exact:true}).count(),0);
 await account.close();
 const expired=await context(session(true));
 const recovering=await expired.newPage();recovering.setDefaultTimeout(15000);
 await recovering.goto(base+'/discover/');
 await recovering.getByText('Loading your workspace…',{exact:true}).waitFor();
 await recovering.screenshot({path:join(dir,'restoring-desktop.png')});
 await recovering.getByRole('navigation',{name:'Workspace pages',exact:true}).waitFor();
 assert(refreshCount>=1,'Expired access token recovers through the persisted refresh token');
 assert.deepEqual(await recovering.evaluate(()=>window.authFlashes),[],'No login flash during delayed token refresh');
 await expired.close();
 const guest=await context(null);
 const signedOut=await guest.newPage();signedOut.setDefaultTimeout(15000);
 await signedOut.goto(base+'/discover/');
 await signedOut.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();
 assert.equal(await signedOut.getByRole('navigation',{name:'Workspace pages',exact:true}).count(),0);
 await signedOut.goto(base+'/privacy/');
 await signedOut.getByRole('heading',{name:/Privacy/}).first().waitFor();
 await guest.close();
 const demo=await context(null);
 const preview=await demo.newPage();preview.setDefaultTimeout(15000);
 await preview.goto(base+'/discover/?demo=1');
 await preview.getByRole('navigation',{name:'Workspace pages',exact:true}).waitFor();
 await preview.reload();
 await preview.getByRole('navigation',{name:'Workspace pages',exact:true}).waitFor();
 await demo.close();
 console.log('Passed: persisted sessions and reloads across five routes; no sign-in flash; delayed expired-token recovery; explicit sign-out persists; guests, public privacy, demo, and mobile layout. All APIs intercepted.');
} finally {await browser.close();}
