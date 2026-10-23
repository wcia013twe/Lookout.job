// Optional rendered-state check. All hosted API traffic uses fictional responses.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3047';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-api-errors-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const pageErrors=[];
try {
 const demo=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',serviceWorkers:'block'});
 const demoCalls=[];
 await demo.route('https://*.supabase.co/**',route=>{demoCalls.push(route.request().url());return route.abort();});
 const page=await demo.newPage();page.on('pageerror',e=>pageErrors.push(e.message));page.setDefaultTimeout(12000);
 for(const [path,emptyText,operation] of [['career-toolkit','No upcoming prep saved yet','artifacts.list'],['circles','No circles yet. Create one for your people, or join with an invite code.','circles.list']]) {
  await page.goto(`${base}/${path}/?demo=1&demoApi=empty`);
  await page.getByText(emptyText,{exact:true}).waitFor();
  assert.equal(await page.getByRole('alert',{name:'API request failed'}).count(),0);
  await page.screenshot({path:`${dir}/${path}-empty-mobile.png`,fullPage:true});
  await page.goto(`${base}/${path}/?demo=1&demoApi=unavailable`);
  const alert=page.getByRole('alert',{name:'API request failed'});await alert.waitFor();
  assert.match(await alert.innerText(),new RegExp(`${operation} failed.*PGRST202`));
  assert.equal(await page.getByText(emptyText,{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.screenshot({path:`${dir}/${path}-failure-mobile.png`,fullPage:true});
  await alert.getByRole('button',{name:'Check again'}).click();await alert.waitFor({state:'detached'});
  assert.equal(await page.getByText(emptyText,{exact:true}).count(),0);
 }
 assert.deepEqual(demoCalls,[],'Detached demos must never contact the backend');await demo.close();
 const account=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await account.addInitScript(({user,token})=>localStorage.setItem('sb-umhqfqzpwmszhcknwtrs-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 let failed=true;const writes=[];
 await account.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=request.url();let op;
  try{op=request.postDataJSON()?.operation;}catch{}
  if(request.method()==='POST'&&!url.includes('/rpc/'))writes.push(url);
  let status=200,body=[];
  if(url.includes('/auth/v1/user'))body=user;
  else if(url.includes('/rpc/artifact_action'))body=failed?(status=404,{code:'PGRST202',message:'private SQL details'}):{items:[],nextOffset:null};
  else if(url.includes('/rpc/company_action'))body=failed?(status=404,{code:'PGRST202'}):{items:[]};
  else if(url.includes('/rpc/knowledge_action'))body=failed?(status=404,{code:'PGRST202'}):{available:true,circles:[]};
  else if(url.includes('/rest/v1/outreach_contacts')&&failed)body=(status=403,{code:'42501',message:'private row details'});
  else if(url.includes('/rpc/search_action')&&op==='search.context')body={documents:[],profileId:null};
  await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const real=await account.newPage();real.setDefaultTimeout(12000);real.on('pageerror',e=>pageErrors.push(e.message));
 for(const [path,operation] of [['career-toolkit/','artifacts.list'],['circles/','circles.list'],['referrals/?view=targets','company_workspaces.list']]){
  await real.goto(`${base}/${path}`);
  await real.getByRole('alert',{name:'API request failed'}).filter({hasText:`${operation} failed`}).waitFor();
  assert.equal(await real.getByText(/Alex Morgan|Jamie Chen/).count(),0,'No mock contacts in account mode');
  assert.doesNotMatch(await real.locator('body').innerText(),/private SQL|private row/);
  await real.screenshot({path:`${dir}/${path.split('/')[0]}-account-failure.png`,fullPage:true});
 }
 await real.getByRole('alert',{name:'API request failed'}).filter({hasText:'outreach_contacts.read failed [42501'}).waitFor();
 failed=false;
 for(const [path,text] of [['career-toolkit/','No upcoming prep saved yet'],['circles/','No circles yet. Create one for your people, or join with an invite code.'],['referrals/?view=targets','Where would you like to work?']]){
  await real.goto(`${base}/${path}`);await real.getByText(text,{exact:true}).waitFor();
  assert.equal(await real.getByRole('alert',{name:'API request failed'}).count(),0);
 }
 await real.goto(`${base}/circles/`);await real.getByText('No circles yet. Create one for your people, or join with an invite code.',{exact:true}).waitFor();
 await real.getByRole('textbox',{name:'Circle name',exact:true}).fill('Fictional teammates');
 await real.getByRole('textbox',{name:'Your name in this Circle',exact:true}).first().fill('Demo name');
 failed=true;await real.getByRole('button',{name:'Create private Circle',exact:true}).click();
 await real.getByRole('alert',{name:'API request failed'}).filter({hasText:'circles.create failed'}).waitFor();
 assert.equal(await real.getByRole('textbox',{name:'Circle name',exact:true}).inputValue(),'Fictional teammates','Failed saves preserve form input');
 assert.equal(await real.getByText('No circles yet. Create one for your people, or join with an invite code.',{exact:true}).count(),0);
 assert.deepEqual(writes,[],'Reading an empty account must not create data');
 await account.close();
 const guest=await browser.newContext({serviceWorkers:'block'});
 await guest.route('https://*.supabase.co/**',route=>route.abort());
 const signedOut=await guest.newPage();signedOut.setDefaultTimeout(12000);signedOut.on('pageerror',e=>pageErrors.push(e.message));
 await signedOut.goto(`${base}/circles/`);
 await signedOut.getByRole('button',{name:'Explore fictional demo',exact:true}).waitFor();
 assert.equal(await signedOut.getByRole('heading',{name:'Your circles',exact:true}).count(),0);
 await signedOut.getByRole('button',{name:'Explore fictional demo',exact:true}).click();
 await signedOut.getByRole('heading',{name:'Your circles',exact:true}).waitFor();
 await guest.close();assert.deepEqual(pageErrors,[]);
 console.log('Verified mobile demo empty/error/recovery, account API failures and empty results, no fallback contacts, safe diagnostics, and no backend writes.');
} finally {await browser.close();}
