// Fictional demo UI proof; no resume bytes, account data or Affinda requests.
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
 await history.check();await importer.getByRole('button',{name:'Save selected details',exact:true}).click();await importer.getByText('Demo profile updated in memory. Reset the demo to restore it.',{exact:true}).waitFor();
 await page.getByRole('region',{name:'Work experience',exact:true}).getByText('Fictional demo: built a query performance dashboard.',{exact:true}).waitFor();
 await importer.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Edit Personal Info',exact:true}).click();await page.getByRole('textbox',{name:'First name',exact:true}).fill('Unsaved');
 await page.getByRole('button',{name:'Autofill profile',exact:true}).first().click();assert.ok(await importer.getByRole('button',{name:'Preview autofill',exact:true}).isDisabled(),'Import must not discard unsaved background drafts');
 await page.setViewportSize({width:1440,height:1000});await page.reload();await page.getByRole('button',{name:'About me',exact:true}).click();assert.equal(await page.getByText('Fictional demo: built a query performance dashboard.',{exact:true}).count(),0,'Demo changes persisted outside memory');
 // The real tutorial reuses the same component for selected uploaded resumes.
 const tutorial=await context.newPage();await tutorial.goto(base+'/onboarding/');await tutorial.getByRole('heading',{name:'Sign up or sign in.',exact:true}).waitFor();
 const authenticated=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{},user_metadata:{},is_anonymous:false};
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await authenticated.addInitScript(({user,token})=>localStorage.setItem('sb-umhqfqzpwmszhcknwtrs-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 const resumeId='22222222-2222-4222-8222-222222222222';
 await authenticated.route('**/*',async route=>{const url=new URL(route.request().url());if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  external.push(url.href);if(!url.hostname.endsWith('.supabase.co'))return route.abort();
  const body=url.pathname==='/auth/v1/user'?user:url.pathname==='/rest/v1/resumes'?[{id:resumeId,user_id:user.id,name:'Fictional tutorial resume.pdf',variant:'Master',version:1,object_path:user.id+'/'+resumeId+'.pdf',content_hash:'a'.repeat(64)}]:url.pathname.includes('/rpc/')?{}:[];
  return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const signedIn=await authenticated.newPage();signedIn.on('pageerror',error=>errors.push(error.message));await signedIn.goto(base+'/onboarding/');await signedIn.getByRole('heading',{name:'Let’s start with you.',exact:true}).waitFor();assert.equal(await signedIn.getByText('Add LinkedIn profile',{exact:true}).count(),0);
 await signedIn.getByRole('button',{name:'Upload résumé',exact:true}).click();await signedIn.getByRole('combobox',{name:'Choose a saved résumé',exact:true}).selectOption(resumeId);await signedIn.getByRole('region',{name:'Resume profile autofill',exact:true}).getByRole('button',{name:'Autofill with Affinda',exact:true}).waitFor();await authenticated.close();
 assert.deepEqual(errors,[]);assert.ok(!external.some(url=>url.includes('affinda')),'Demo called Affinda');
 console.log('PASS: desktop/mobile proposal review, preserved history defaults, explicit save, unsaved-draft protection, memory-only demo reset, tutorial resume entry. Screenshots: '+dir);
}finally{await browser.close();}
