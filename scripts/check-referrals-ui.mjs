// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
import {chromium} from '../runner/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-referrals-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[];let contactRows=[],contactSaves=0;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>localStorage.setItem('sb-umhqfqzpwmszhcknwtrs-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 await context.route('https://umhqfqzpwmszhcknwtrs.supabase.co/**',async route=>{
  cloud.push(route.request().url());const url=route.request().url();
  const payload=route.request().postDataJSON();
  const op=payload?.operation;
  if(url.includes('/rpc/save_outreach_contact')) {
   contactSaves++;
   if(contactSaves===1) {await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fictional temporary connection failure'})});return;}
   contactRows=[{id:payload.p_id,record:payload.p_record,revision:0}];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({revision:0})});return;
  }
  const body=url.includes('/auth/v1/user')?user:url.includes('/rest/v1/outreach_contacts')?contactRows:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.LOOKOUT_UI_URL || 'http://127.0.0.1:3036'}/referrals/`);
 await page.waitForFunction(()=>window.JB?.cloud?.ready);
 assert.equal(await page.getByRole('button',{name:/^(Retry sync|Load account)$/}).count(),0);
 await page.getByRole('button',{name:'Add manually',exact:true}).click();
 await page.getByLabel('Company',{exact:true}).fill('Fictional Retry Company');
 await page.getByLabel('Contact name',{exact:true}).fill('Fictional Retry Contact');
 await page.getByLabel('Message (optional)',{exact:true}).fill('Hi, this is a fictional auto-sync check.');
 await page.getByRole('button',{name:'Add contact',exact:true}).click();
 await page.getByText('Your outreach edits are kept here. Sync will retry automatically.',{exact:true}).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByText('Saved to your account.',{exact:true}).waitFor();
 assert.equal(contactSaves,2,'Failed outreach save should retry automatically');
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Demo mode',exact:true}).click();
 await page.getByRole('textbox',{name:'Message for Jamie (fictional)'}).waitFor();
 const message=page.getByRole('textbox',{name:'Message for Jamie (fictional)'});
 assert.match(await message.inputValue(),/Would you feel comfortable referring me/);
 assert(await message.isVisible());
 assert.equal(await page.locator('mark[data-kind]').count()>3,true);
 assert.equal(await page.getByText('Outreach templates · 5').evaluate(el=>el.parentElement.open),false);
 await page.screenshot({path:dir+'/referrals-desktop.png',fullPage:true});
 const before=cloud.length;
 await message.fill((await message.inputValue()).replace('Hi Jamie,','Hello Jamie,'));
 await page.getByRole('button',{name:'Highlights: On',exact:true}).click();
 await page.getByRole('button',{name:'Highlights: Off',exact:true}).click();
 assert.equal(cloud.length,before,'Demo edits must stay local');
 await page.setViewportSize({width:390,height:844});
 assert(await message.isVisible(),'Draft should be visible on mobile entry');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
 await message.scrollIntoViewIfNeeded();
 await page.screenshot({path:dir+'/referrals-mobile.png',animations:'disabled'});
 await page.getByRole('button',{name:'Back to referral contacts'}).click();
 await page.getByRole('button',{name:/Alex.*Not asked/}).click();
 await page.getByRole('textbox',{name:'Message for Alex (fictional)'}).waitFor();
 assert.equal(await page.getByRole('button',{name:/^(Retry outreach sync|Load saved outreach)$/}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('Desktop/mobile draft, highlights, templates, contact navigation and demo isolation passed.');
} finally {await browser.close();}
