// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
import {chromium} from '../runner/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-network-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[],mutations=[];let contactRows=[],contactSaves=0,companyRows=[],companySaves=0;
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
  if(url.includes('/rpc/network_action')){
   let data;
   if(op==='network.companies.read')data={companies:companyRows,total:companyRows.length};
   else {companySaves++;data={id:payload.payload.id,record:payload.payload.record,revision:payload.payload.expectedRevision+1,updated_at:new Date().toISOString()};companyRows=[...companyRows.filter(r=>r.id!==data.id),data];}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});return;
  }
  if(url.includes('/rpc/save_outreach_contact')) {
   contactSaves++;
   if(contactSaves===1) {await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fictional temporary connection failure'})});return;}
   contactRows=[{id:payload.p_id,record:payload.p_record,revision:0}];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({revision:0})});return;
  }
  const body=url.includes('/auth/v1/user')?user:url.includes('/rest/v1/outreach_contacts')?contactRows:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.LOOKOUT_UI_URL || 'http://127.0.0.1:3047'}/referrals/`);
 await page.waitForFunction(()=>window.JB?.cloud?.ready);
 await page.getByRole('heading',{name:'Network',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add company',exact:true}).click();
 await page.getByLabel('Company name',{exact:true}).fill('Fictional Retry Company');
 await page.getByLabel('Why I’m interested',{exact:true}).fill('Private interest in database systems.');
 await page.getByRole('button',{name:'Save company',exact:true}).click();
 await page.getByText('Company saved.',{exact:true}).waitFor();
 assert.equal(companySaves,1);console.log('Signed-in company save passed');
 await page.getByRole('button',{name:'People & outreach',exact:true}).click();
 await page.getByRole('button',{name:'Add manually',exact:true}).click();
 await page.getByLabel('Contact name',{exact:true}).fill('Fictional Retry Contact');
 await page.getByLabel('Message (optional)',{exact:true}).fill('Hi, this is a fictional auto-sync check.');
 await page.getByRole('button',{name:'Add contact',exact:true}).click();
 await page.getByText('Your outreach edits are kept here. Sync will retry automatically.',{exact:true}).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByText('Saved to your account.',{exact:true}).waitFor();
 assert.equal(contactSaves,2,'Contact saves must retain automatic recovery');console.log('Contact sync recovery passed');
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Demo mode',exact:true}).click();
 await page.getByRole('button',{name:'Back to companies',exact:true}).click().catch(()=>{});
 await page.getByRole('button',{name:/Cedar Systems/}).waitFor();
 assert.equal(await page.getByRole('button',{name:/Archived Example/}).count(),0);
 await page.getByLabel('Show archived',{exact:true}).check();
 await page.getByRole('button',{name:/Archived Example/}).waitFor();
 await page.getByLabel('Show archived',{exact:true}).uncheck();
 await page.screenshot({path:dir+'/desktop.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:dir+'/mobile.png',fullPage:false,animations:'disabled'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Grid overflows mobile');
 await page.getByRole('button',{name:/Cedar Systems/}).click();
 await page.screenshot({path:dir+'/detail-mobile.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:dir+'/detail-desktop.png',fullPage:true,animations:'disabled'});
 console.log('Grid/detail captures finished');const before=mutations.length,companyReads=cloud.filter(u=>u.includes('/rpc/network_action')).length;
 await page.getByRole('button',{name:'Edit company',exact:true}).click();
 await page.getByLabel('Why I’m interested',{exact:true}).fill('Updated fictional research interest.');
 await page.getByRole('button',{name:'Add source',exact:true}).click();
 await page.getByLabel('Source 2 title',{exact:true}).fill('Fictional team guide');
 await page.getByLabel('Source 2 URL',{exact:true}).fill('https://example.com/team');
 await page.getByLabel('Source 2 observed date',{exact:true}).fill('2026-10-20');
 await page.getByLabel('Source 2 findings',{exact:true}).fill('Unconfirmed team scope.');
 await page.getByRole('button',{name:'Save company',exact:true}).click();
 await page.getByText('Updated fictional research interest.',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Fictional team guide',exact:true}).waitFor();
 console.log('Company research edit passed');await page.getByRole('button',{name:'Applications',exact:true}).click();
 await page.getByRole('button',{name:/Open Backend Engineer at Cedar Systems/}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Close application details',exact:true}).click();
 await page.getByRole('button',{name:'Back to companies',exact:true}).click();
 await page.getByRole('button',{name:/Example Compute/}).click();
 await page.getByRole('button',{name:'People & outreach',exact:true}).click();
 const message=page.getByRole('textbox',{name:'Message for Jamie (fictional)'});
 await message.waitFor();assert.match(await message.inputValue(),/Would you feel comfortable referring me/);
 await message.fill((await message.inputValue()).replace('Hi Jamie,','Hello Jamie,'));
 assert.equal(mutations.length,before,'Demo actions must not write account data: '+JSON.stringify(mutations.slice(before)));
 assert.equal(cloud.filter(u=>u.includes('/rpc/network_action')).length,companyReads,'Demo company reads must use memory');
 await page.getByRole('link',{name:/^Action board/i}).click();
 await page.getByRole('heading',{name:'Company follow-ups',exact:true}).waitFor();
 await page.getByRole('link',{name:'Open company',exact:true}).click();
 await page.getByRole('heading',{name:'Cedar Systems (demo)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit company',exact:true}).click();
 await page.getByLabel('Archive company and pause its follow-up reminders',{exact:true}).check();
 await page.getByRole('button',{name:'Save company',exact:true}).click();
 await page.getByRole('link',{name:/^Action board/i}).click();
 assert.equal(await page.getByRole('heading',{name:'Company follow-ups',exact:true}).count(),0);
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Reset demo data',exact:true}).click();
 await page.getByRole('heading',{name:'Company follow-ups',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'passed',artifacts:dir,checks:['signed-in company save','contact sync recovery','company grid desktop/mobile','research edit/source provenance','linked application dialog','existing outreach editor','due follow-ups/archive','reset','demo cloud isolation']}));
}catch(e){const pages=context.pages();if(pages[0]){await pages[0].screenshot({path:dir+'/failure.png',fullPage:false});console.error((await pages[0].locator('body').innerText()).slice(0,6000));}throw e;}finally{await browser.close();}
