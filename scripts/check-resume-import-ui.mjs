// Fictional demo UI proof; no resume bytes, account data or APILayer requests.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3047',dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-resume-import-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});const page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));await context.route('**/*',route=>{const url=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(url.hostname)){external.push(url.href);return route.abort();}return route.continue();});
 await page.goto(base+'/profile/?demo=1&section=about');
 await page.getByRole('button',{name:'About me',exact:true}).click();
 await page.getByRole('button',{name:'Autofill profile',exact:true}).first().click();
 const importer=page.getByRole('region',{name:'Resume profile autofill',exact:true});
 await importer.getByRole('button',{name:'Preview autofill',exact:true}).click();
 await importer.getByRole('heading',{name:'Review extracted details',exact:true}).waitFor();
 const history=importer.getByRole('checkbox',{name:'Work experience',exact:true});assert.equal(await history.isChecked(),false,'Existing history must default unchecked');
 await importer.screenshot({path:dir+'/review-desktop.png'});await page.setViewportSize({width:390,height:844});await importer.screenshot({path:dir+'/review-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile review overflows');
 await history.check();await importer.getByRole('button',{name:'Save selected details',exact:true}).click();await importer.getByRole('heading',{name:'Your profile is saved',exact:true}).waitFor();assert.equal(await importer.getByRole('list',{name:'Profile processing'}).getByText('Completed',{exact:true}).count(),3);await importer.getByText('Demo profile updated in memory. Reset the demo to restore it.',{exact:true}).waitFor();
 await page.getByRole('region',{name:'Work experience',exact:true}).getByText('Dates returned by parser: June–August 2026',{exact:true}).waitFor();
 await importer.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Edit Personal Info',exact:true}).click();await page.getByRole('textbox',{name:'First name',exact:true}).fill('Unsaved');
 await page.getByRole('button',{name:'Autofill profile',exact:true}).first().click();assert.ok(await importer.getByRole('button',{name:'Preview autofill',exact:true}).isDisabled(),'Import must not discard unsaved background drafts');
 await page.setViewportSize({width:1440,height:1000});await page.reload();await page.getByRole('button',{name:'About me',exact:true}).click();assert.equal(await page.getByText('Dates returned by parser: June–August 2026',{exact:true}).count(),0,'Demo changes persisted outside memory');
 // The real tutorial reuses the same component for selected uploaded resumes.
 const tutorial=await context.newPage();await tutorial.goto(base+'/onboarding/');await tutorial.getByRole('heading',{name:'Sign up or sign in.',exact:true}).waitFor();
 const authenticated=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{},user_metadata:{},is_anonymous:false};
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await authenticated.addInitScript(({user,token})=>localStorage.setItem('sb-osyrlausutnqzlegxmnd-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 const resumeId='22222222-2222-4222-8222-222222222222';let savedProfile=null,searchProfile=null;let issuedConnections=0;
 await authenticated.route('**/*',async route=>{const url=new URL(route.request().url());
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':route.request().headers()['access-control-request-headers']||'*'}});
  if(url.hostname==='api.geoapify.com')return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({results:url.searchParams.get('type')==='country'?[{country:'New Zealand'}]:[{city:'New York',state:'New York',country:'United States'}]})});
  if(url.pathname==='/rest/v1/rpc/save_search_profile'){
   const {next_profile}=route.request().postDataJSON();searchProfile={...next_profile,version:(searchProfile?.version||0)+1};
   return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(searchProfile)});
  }
  if(url.pathname==='/rest/v1/rpc/onboarding_action')return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({step:'intent_pending',revision:1,data:{runtime:{connectionId:'fictional',browsingReportedAt:'2026-10-27T12:00:00Z'}}})});
  if(url.pathname==='/functions/v1/agent-gateway'){
   const {operation}=route.request().postDataJSON();if(operation==='connections.issue')issuedConnections++;
   return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(operation==='connections.issue'?{token:'jb_agent_'+'a'.repeat(64),connection:{id:'fictional'}}:{data:[]})});
  }
  if(url.pathname==='/v1/resume-import')return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'Authorization, Content-Type'},body:JSON.stringify({data:{resumeId,profileUpdatedAt:null,profileFacts:{},facts:{email:'parsed@example.com',skills:'SQL'},warnings:[]}})});
  if(url.pathname==='/rest/v1/rpc/save_profile_changes'){
   const {payload}=route.request().postDataJSON();savedProfile={user_id:user.id,facts:payload.fields,updated_at:'2026-10-27T12:00:00Z',verified_at:null};
   return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(savedProfile)});
  }
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  external.push(url.href);if(!url.hostname.endsWith('.supabase.co'))return route.abort();
  const body=url.pathname==='/auth/v1/user'?user:url.pathname==='/rest/v1/preferences'?(searchProfile?[{search:{profiles:[searchProfile]}}]:[]):url.pathname==='/rest/v1/profiles'?(savedProfile?[savedProfile]:[]):url.pathname==='/rest/v1/resumes'?[{id:resumeId,user_id:user.id,name:'Fictional tutorial resume.pdf',variant:'Master',version:1,object_path:user.id+'/'+resumeId+'.pdf',content_hash:'a'.repeat(64)}]:url.pathname.includes('/rpc/')?{}:[];
  return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 await authenticated.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}}}));
 const signedIn=await authenticated.newPage();signedIn.on('pageerror',error=>errors.push(error.message));await signedIn.goto(base+'/onboarding/');await signedIn.getByRole('heading',{name:'Let’s start with you.',exact:true}).waitFor();assert.equal(await signedIn.getByText('Add LinkedIn profile',{exact:true}).count(),0);
 await signedIn.getByRole('button',{name:'Upload résumé',exact:true}).click();await signedIn.getByRole('combobox',{name:'Choose a saved résumé',exact:true}).selectOption(resumeId);await signedIn.getByText('Data saved',{exact:true}).waitFor();await signedIn.getByRole('heading',{name:'Let’s start with you.',exact:true}).waitFor();assert.equal(await signedIn.getByRole('region',{name:'Resume profile autofill',exact:true}).count(),0);await signedIn.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await signedIn.getByRole('button',{name:'Autofill with APILayer',exact:true}).count(),0);await signedIn.getByRole('heading',{name:'What’s your next move?',exact:true}).waitFor();await signedIn.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Onboarding');await signedIn.getByRole('button',{name:'Software Engineer',exact:true}).click();await signedIn.getByRole('button',{name:'Data Scientist',exact:true}).click();
 await signedIn.getByRole('button',{name:'Remove Software Engineer',exact:true}).waitFor();await signedIn.getByRole('button',{name:'Remove Data Scientist',exact:true}).waitFor();
 await signedIn.getByRole('textbox',{name:'Type of work',exact:true}).fill('Research Scientist');await signedIn.getByRole('textbox',{name:'Type of work',exact:true}).press('Enter');await signedIn.getByRole('button',{name:'Remove Research Scientist',exact:true}).click();
 const locations=signedIn.getByRole('combobox',{name:'Where would you like to work?',exact:true});
 await locations.fill('New');await signedIn.getByRole('option',{name:'New Zealand',exact:true}).waitFor();await signedIn.getByRole('option',{name:'New York, New York, United States',exact:true}).waitFor();
 await locations.press('ArrowDown');await locations.press('Enter');await signedIn.getByRole('button',{name:'Remove New Zealand',exact:true}).waitFor();assert.equal(await locations.inputValue(),'');
 await signedIn.getByRole('button',{name:'Remote',exact:true}).click();await signedIn.getByRole('button',{name:'Remove Remote',exact:true}).waitFor();await signedIn.getByRole('button',{name:'Remove New Zealand',exact:true}).waitFor();
 await signedIn.setViewportSize({width:390,height:844});await locations.fill('New');await signedIn.getByRole('option',{name:'New Zealand',exact:true}).waitFor();await signedIn.getByRole('option',{name:'New York, New York, United States',exact:true}).click();await signedIn.getByRole('button',{name:'Remove New York, New York, United States',exact:true}).waitFor();await signedIn.screenshot({path:dir+'/locations-mobile.png'});assert.ok(await signedIn.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Location results overflow mobile');
 assert.equal(savedProfile?.facts.email,'parsed@example.com');assert.equal(await signedIn.evaluate(()=>window.JB.store.get('workflow.profile.email')),'parsed@example.com');await signedIn.getByRole('button',{name:'Continue',exact:true}).click();await signedIn.getByRole('heading',{name:'Meet your agent.',exact:true}).waitFor();assert.equal(await signedIn.getByRole('heading',{name:'Explore your first role?',exact:true}).count(),0);
 await signedIn.setViewportSize({width:1440,height:1000});
 for(const name of ['Muse','Dots','Claude Duet','Grok Bot','Hermes','Gemini','ChatGPT','Claude','Cappy']){
  const radio=signedIn.getByRole('radio',{name,exact:true});await signedIn.locator('label.call-participant').filter({has:radio}).click();
  await signedIn.getByRole('img',{name:name+' artwork',exact:true}).waitFor();
  assert.ok(await signedIn.getByRole('img',{name:name+' artwork',exact:true}).evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),name+' artwork failed');
 }
 const picker=signedIn.getByRole('group',{name:'Choose your companion',exact:true});await picker.screenshot({path:dir+'/agent-icons-desktop.png'});
 await signedIn.setViewportSize({width:390,height:844});await picker.screenshot({path:dir+'/agent-icons-mobile.png'});assert.ok(await signedIn.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Agent icons overflow mobile');

 await signedIn.getByRole('button',{name:'Get connection setup',exact:true}).click();await signedIn.getByRole('button',{name:'Copy instructions for chat',exact:true}).click();await signedIn.getByRole('button',{name:'Next',exact:true}).click();await signedIn.getByRole('heading',{name:'You’re connected.',exact:true}).waitFor();await signedIn.getByRole('button',{name:'Continue',exact:true}).click();await signedIn.getByRole('heading',{name:'Explore your first role?',exact:true}).waitFor();await signedIn.getByRole('button',{name:'Skip for now',exact:true}).click();await signedIn.getByRole('heading',{name:'An edge, from your people.',exact:true}).waitFor();assert.equal(issuedConnections,1);await authenticated.close();
 assert.deepEqual(errors,[]);assert.ok(!external.some(url=>url.includes('apilayer')),'Demo called APILayer');
 console.log('PASS: desktop/mobile proposal review, preserved history defaults, explicit save, unsaved-draft protection, memory-only demo reset, tutorial automatic parse/save, saved-profile read-back, eight official agent images and the existing Cappy design, mobile picker containment, connection before optional first-role preview and skipping it. Screenshots: '+dir);
}finally{await browser.close();}
