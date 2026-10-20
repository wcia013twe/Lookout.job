// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
import {chromium} from '../runner/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-outreach-conversations';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[],mutations=[];let contactRows=[],preferenceRows=[],contactSaves=0,companySaves=0;
let context;
try{
 context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>localStorage.setItem('sb-umhqfqzpwmszhcknwtrs-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 await context.route('https://umhqfqzpwmszhcknwtrs.supabase.co/**',async route=>{
  cloud.push(route.request().url());const url=route.request().url();
  const payload=route.request().postDataJSON();
  const op=payload?.operation;
  if(route.request().method()!=='GET'&&url.includes('/rest/v1/')&&!['network.companies.read','search.context'].includes(op))mutations.push(url);
  if(url.includes('/rpc/save_preferences_preserving_quiet')) {
   preferenceRows=[{user_id:user.id,search:payload.search_next,tier_lists:payload.lists_next,active_tier_list_id:payload.active_next,theme:payload.theme_next}];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(preferenceRows[0])});return;
  }
  if(url.includes('/rpc/save_outreach_contact')) {
   if(payload.p_record.collection==='companies')companySaves++;
   else contactSaves++;
   const old=contactRows.find(r=>r.id===payload.p_id);
   const row={id:payload.p_id,record:payload.p_record,revision:old?old.revision+1:0};
   contactRows=[...contactRows.filter(r=>r.id!==row.id),row];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(row)});return;
  }
  const body=url.includes('/auth/v1/user')?user:url.includes('/rest/v1/outreach_contacts')?contactRows:url.includes('/rest/v1/preferences')?preferenceRows:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });

 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.LOOKOUT_UI_URL || 'http://127.0.0.1:3053'}/referrals/?view=people`);
 await page.waitForFunction(()=>window.JB?.cloud?.ready);
 await page.getByRole('heading',{name:'Referrals',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add manually',exact:true}).click();
 await page.getByLabel('Company',{exact:true}).fill('Fictional Company');
 await page.getByLabel('Contact name',{exact:true}).fill('Fictional Contact');
 await page.getByLabel('Message (optional)',{exact:true}).fill('This is my unsent draft.');
 await page.getByRole('button',{name:'Add contact',exact:true}).click();
 await page.getByText('Saved to your account.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Copy message',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Proposed outreach (1)',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Log sent message',exact:true}).click();
 await page.getByLabel('Message date',{exact:true}).fill('2026-10-19');
 await page.getByLabel('Message or summary',{exact:true}).fill('This is what I actually sent.');
 await page.getByLabel('Conversation link (optional)',{exact:true}).fill('https://www.linkedin.com/messaging/thread/fictional/');
 await page.getByRole('button',{name:'Save logged message',exact:true}).click();
 await page.getByText('Waiting for reply',{exact:true}).first().waitFor();
 await page.getByText('Saved to your account.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Ongoing conversations (1)',exact:true}).getAttribute('aria-pressed'),'true');
 assert.match(contactRows[0].record.notes,/This is what I actually sent/);
 await page.getByRole('button',{name:'Log reply',exact:true}).click();
 await page.getByLabel('Message date',{exact:true}).fill('2026-10-20');
 await page.getByLabel('Channel',{exact:true}).selectOption('Email');
 await page.getByLabel('Message or summary',{exact:true}).fill('Happy to chat about the role.');
 await page.getByRole('button',{name:'Save logged message',exact:true}).click();
 await page.getByText('Your turn to reply',{exact:true}).first().waitFor();
 await page.getByLabel('Next follow-up',{exact:true}).fill('2026-10-21');
 await page.getByText('Saved to your account.',{exact:true}).waitFor();
 assert.equal(contactRows[0].record.followUpDate,'2026-10-21');
 await page.reload();
 await page.getByRole('button',{name:'Ongoing conversations (1)',exact:true}).click();
 await page.getByText('Happy to chat about the role.',{exact:true}).waitFor();
 // Demo changes must stay isolated from the signed-in contact service.
 await page.waitForFunction(()=>window.JB?.cloud?.ready && !window.JB.store.get('workflow.cloudDirty'));
 await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Demo mode',exact:true}).click();
 await page.getByText('Demo contacts — changes stay in memory.',{exact:true}).waitFor();
 const baseline=mutations.length;
 await page.getByRole('button',{name:/^Proposed outreach \(/}).click();
 await page.getByRole('button',{name:/Alex \(fictional\)/}).click();
 await page.getByRole('heading',{name:'Draft message',exact:true}).waitFor();
 await page.screenshot({path:dir+'/proposed-desktop.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:/^Ongoing conversations \(/}).click();
 await page.getByRole('button',{name:/Jamie \(fictional\)/}).click();
 await page.getByRole('heading',{name:'Conversation',exact:true}).waitFor();
 assert.equal(await page.getByRole('list',{name:'Logged messages'}).locator('li').count(),2);
 await page.getByText('Prepare another message',{exact:true}).click();
 await page.getByRole('heading',{name:'Draft message',exact:true}).waitFor();
 await page.getByText('Prepare another message',{exact:true}).click();
 await page.screenshot({path:dir+'/ongoing-desktop.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('heading',{name:'Conversation',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:dir+'/ongoing-mobile.png',fullPage:false,animations:'disabled'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
 await page.getByRole('button',{name:'Log reply',exact:true}).click();
 await page.getByLabel('Message or summary',{exact:true}).fill('Fictional additional reply for reset.');
 await page.getByRole('button',{name:'Save logged message',exact:true}).click();
 assert.equal(await page.getByRole('list',{name:'Logged messages'}).locator('li').count(),3);
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Reset demo data',exact:true}).click();
 await page.getByRole('button',{name:/^Ongoing conversations \(/}).click();
 await page.getByRole('button',{name:/Jamie \(fictional\)/}).click();
 assert.equal(await page.getByRole('list',{name:'Logged messages'}).locator('li').count(),2);
 assert.equal(mutations.length,baseline,'Demo wrote to cloud: '+JSON.stringify(mutations.slice(baseline)));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'passed',artifacts:dir,checks:['copy remains proposed','explicit sent logging','reply logging','follow-up persistence','signed-in reload','demo proposal and replied history','desktop/mobile','demo reset','no demo backend mutations','no page errors']}));
}catch(e){const pages=context.pages();if(pages[0]){await pages[0].screenshot({path:dir+'/failure.png',fullPage:true});console.error((await pages[0].locator('body').innerText()).slice(0,6000));}throw e;}finally{await browser.close();}
