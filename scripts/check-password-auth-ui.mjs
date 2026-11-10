import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3097';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-password-auth-ui';await mkdir(dir,{recursive:true});
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional-password@example.com',app_metadata:{},user_metadata:{},is_anonymous:false};
const expires=Math.floor(Date.now()/1000)+3600;
const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:expires})).toString('base64url'),'fictional'].join('.');
const saved={access_token:jwt,refresh_token:'fictional-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user};
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
async function setup(width,signedIn=false){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});const calls=[];
 if(signedIn)await context.addInitScript(saved=>localStorage.setItem('sb-osyrlausutnqzlegxmnd-auth-token',JSON.stringify(saved)),saved);
 await context.route('https://*.supabase.co/**',async route=>{
  const req=route.request(),url=req.url();calls.push({url,method:req.method(),body:req.postDataJSON()});
  let body=[];let status=200;
  if(url.includes('/auth/v1/token')){status=400;body={code:'invalid_credentials',msg:'Invalid login credentials'};}
  else if(url.includes('/auth/v1/user'))body=user;
  else if(url.includes('/auth/v1/recover'))body={};
  else if(url.includes('/rpc/onboarding_action'))body={revision:1,step:'connection_pending',data:{websiteCompletedAt:'2026-10-23T12:00:00Z'}};
  else if(url.includes('/rpc/workspace_reset_action'))body=null;
  else if(url.includes('/rpc/search_action'))body={documents:[],profileId:null};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page,calls};
}
try{
 for(const width of [1440,390]){
  const {context,page,calls}=await setup(width);await page.goto(base+'/login/');
  await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fictional-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('alert').filter({hasText:'Could not sign in.'}).waitFor();
  const login=calls.find(c=>c.url.includes('/auth/v1/token'));assert.equal(login.body.email,user.email);assert.equal(login.body.password,'fictional-password');
  await page.screenshot({path:`${dir}/login-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Set or reset password',exact:true}).click();await page.getByRole('button',{name:'Send password link',exact:true}).click();
  await page.getByRole('status').filter({hasText:'a password link is on its way'}).waitFor();
  const recovery=calls.find(c=>c.url.includes('/auth/v1/recover'));assert.equal(recovery.body.email,user.email);assert.equal(new URL(recovery.url).searchParams.get('redirect_to'),base+'/reset-password/');assert.ok(recovery.body.code_challenge);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
 }
 const reset=await setup(390,true);await reset.page.goto(base+'/reset-password/');
 await reset.page.getByLabel('New password',{exact:true}).fill('new-fictional-password');await reset.page.getByLabel('Confirm password',{exact:true}).fill('mismatch-password');await reset.page.getByRole('button',{name:'Save password',exact:true}).click();await reset.page.getByRole('alert').filter({hasText:'do not match'}).waitFor();
 assert.equal(reset.calls.filter(c=>c.method==='PUT').length,0);
 await reset.page.getByLabel('New password',{exact:true}).fill('new-fictional-password');await reset.page.getByLabel('Confirm password',{exact:true}).fill('new-fictional-password');
 await reset.page.screenshot({path:`${dir}/reset-mobile.png`,fullPage:true});await reset.page.getByRole('button',{name:'Save password',exact:true}).click();await reset.page.getByRole('status').filter({hasText:'Password saved.'}).waitFor();
 assert.equal(reset.calls.find(c=>c.method==='PUT').body.password,'new-fictional-password');assert.equal(new URL(reset.page.url()).pathname,'/reset-password/');await reset.context.close();
 const expired=await setup(390);await expired.page.goto(base+'/reset-password/');await expired.page.getByText('Open the password setup link from your email.',{exact:false}).waitFor();assert.equal(await expired.page.getByRole('button',{name:'Save password',exact:true}).count(),0);await expired.context.close();
 const demo=await setup(390);await demo.page.goto(base+'/login/?demo=1');await demo.page.getByLabel('Email',{exact:true}).fill(user.email);await demo.page.getByLabel('Password',{exact:true}).fill('fictional-password');await demo.page.getByRole('button',{name:'Sign in',exact:true}).click();await demo.page.getByRole('status').filter({hasText:'Fictional demo:'}).waitFor();assert.deepEqual(demo.calls,[]);await demo.context.close();
 assert.deepEqual(errors,[]);console.log('Desktop/mobile login errors, PKCE recovery, same-session password save, expired-link state, overflow, and detached demo passed.');
}finally{await browser.close();}
