// Called by check-local-work-experience.mjs with LOOKOUT_PROFILE_FLOW_UI=1.
// Real local website + Node MCP + isolated Edge; no mocked backend responses.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {open,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
export async function checkProfileFlowUI({root,local,admin,client,user,mcp}) {
 const ok=({data,error})=>{if(error)throw Error('Local UI fixture rejected: '+error.code);return data;};
 const onboarding=ok(await client.rpc('onboarding_action',{operation:'onboarding.get_state',payload:{}}));
 ok(await client.rpc('onboarding_action',{operation:'onboarding.submit_step',payload:{event:'website_complete',expectedRevision:onboarding.revision,eventKey:'profile-flow-complete',data:{}}}));
 const fixtureSession=ok(await client.auth.getSession()).session;
 const portServer=createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
 const artifact=join(root,'next-app/.profile-flow-proof');await mkdir(artifact,{recursive:true});const log=await open(join(artifact,'dev.log'),'w');
 const dev=spawn(process.execPath,[join(root,'next-app/node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:join(root,'next-app'),env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.ANON_KEY,NEXT_PUBLIC_LOOKOUT_API_URL:'http://127.0.0.1:8080'},stdio:['ignore',log.fd,log.fd],detached:true});
 let browser;
 try {
  const base='http://127.0.0.1:'+port;let ready=false;
  for(let n=0;n<100;n++){try{const response=await fetch(base+'/profile/');if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready,'Task frontend did not start');
  browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.addInitScript(({session,key})=>localStorage.setItem(key,JSON.stringify(session)),{session:fixtureSession,key:client.auth.storageKey});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>console.log('Profile page error: '+error.message));page.on('response',response=>{if(response.url().startsWith(local.API_URL)&&response.status()>=400)console.log('Profile API error: '+response.status()+' '+new URL(response.url()).pathname);});
  await page.goto(base+'/profile/?section=about');await page.getByRole('heading',{name:'Work experience',exact:true}).waitFor();
  await page.waitForFunction(()=>window.JB?.cloud?.ready).catch(async error=>{await page.screenshot({path:join(artifact,'startup.png'),fullPage:true});console.log('Profile startup diagnostics: '+JSON.stringify(await page.evaluate(()=>({ready:window.JB?.cloud?.ready,owner:window.JB?.auth?.userId,dirty:window.JB?.store?.get('workflow.cloudDirty'),conflict:window.JB?.store?.get('ui.profileConflict'),status:document.body.innerText.slice(0,650)}))));throw error;});
  const row=()=>admin.from('profiles').select('*').eq('user_id',user.id).single().then(ok);
  const call=async(name,args)=>{const result=await mcp(name,args);assert.ok(!result.isError,name+' failed');return JSON.parse(result.content[0].text);};
  const current=await row();await call('edit_work_experience',{action:'add',expectedUpdatedAt:current.updated_at,fields:{company:'Muse flow employer',title:'Backend Engineer'}});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Muse flow employer',{exact:true}).waitFor();
  async function editPersonal(field,value){await page.getByRole('button',{name:'Edit Personal Info',exact:true}).click();await page.locator('#profile-'+field).fill(value);}
  await editPersonal('phone','+1 202-555-0199');await page.getByRole('button',{name:'Finish editing Personal Info',exact:true}).click();await page.evaluate(()=>window.JB.cloud.save());
  let read=await call('workspace_read',{});assert.equal(read.profile.facts.phone,'+1 202-555-0199');assert.equal(read.profile.facts.workExperience.length,3);
  // Hold an actual form draft while Muse writes, then reject its stale save.
  await editPersonal('location','Website flow location');
  const before=await row();await call('update_profile_fields',{fields:{headline:'Muse flow headline'},expectedUpdatedAt:before.updated_at});
  await page.getByRole('button',{name:'Finish editing Personal Info',exact:true}).click();
  const rejected=await page.evaluate(async()=>{try{await window.JB.cloud.save();return null;}catch(error){return error.code||error.message;}});
  assert.ok(rejected==='PT409'||/conflict/.test(rejected),'Stale website save must reject: '+JSON.stringify(rejected));
  await page.getByRole('button',{name:'Reload latest profile',exact:true}).waitFor();await page.screenshot({path:join(artifact,'conflict-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(artifact,'conflict-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Reload latest profile',exact:true}).click();await page.waitForFunction(()=>!window.JB.store.get('ui.profileConflict'));await page.evaluate(()=>window.JB.cloud.save());
  read=await call('workspace_read',{});assert.equal(read.profile.facts.headline,'Muse flow headline');assert.equal(read.profile.facts.location,'Website flow location');assert.equal(read.profile.facts.workExperience.length,3);assert.equal(read.profile.verified_at,null);
  await page.reload();await page.getByRole('heading',{name:'Work experience',exact:true}).waitFor();await page.waitForFunction(()=>window.JB?.cloud?.ready);assert.equal(await page.evaluate(()=>window.JB.store.get('workflow.profile.phone')),'+1 202-555-0199');assert.equal(await page.evaluate(()=>window.JB.store.get('workflow.profile.workExperience').length),3);
  // An overlapping edit needs a deliberate choice rather than a silent merge.
  await editPersonal('location','Browser competing location');const overlap=await row();await call('update_profile_fields',{fields:{location:'Muse competing location'},expectedUpdatedAt:overlap.updated_at});await page.getByRole('button',{name:'Finish editing Personal Info',exact:true}).click();await page.evaluate(()=>window.JB.cloud.save().catch(()=>{}));await page.getByRole('button',{name:'Reload latest profile',exact:true}).click();await page.getByRole('button',{name:'Use latest values',exact:true}).waitFor();await page.getByRole('button',{name:'Use latest values',exact:true}).click();await page.waitForFunction(()=>!window.JB.store.get('ui.profileConflict'));await page.evaluate(()=>window.JB.cloud.save());assert.equal((await row()).facts.location,'Muse competing location');
  // The same conflict UI is available in an isolated resettable demo.
  const demo=await browser.newPage({viewport:{width:390,height:844}});await demo.goto(base+'/profile/?demo=1&section=about&demoApi=profile-conflict');await demo.getByRole('button',{name:'Reload latest profile',exact:true}).click();await demo.getByRole('button',{name:'Use latest values',exact:true}).click();await demo.getByText('Fictional agent location',{exact:true}).waitFor();await demo.close();
  await context.close();
  return {passed:true,website:'real task Next.js frontend',muse:'actual Node MCP tools',backend:'real local Docker Auth/PostgreSQL and isolated Edge',checks:['Muse entry appears on website','Website phone edit appears in Muse read-back','Concurrent agent entry/facts preserved','Stale website write rejects','Inline reload preserves non-conflicting draft','Overlapping edit requires explicit choice','Reload preserves saved facts and history','Changed facts remain unverified','Detached demo conflict recovery is isolated'],artifacts:'next-app/.profile-flow-proof'};
 } finally {await browser?.close();try{process.kill(-dev.pid,'SIGTERM');}catch{}await log.close();}
}
