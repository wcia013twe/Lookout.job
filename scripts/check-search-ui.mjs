// Optional visual/integration check. All cloud traffic is intercepted with fictional data.
import {chromium} from '../runner/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-search-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];const cloud=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>localStorage.setItem('sb-osyrlausutnqzlegxmnd-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 await context.route('https://osyrlausutnqzlegxmnd.supabase.co/**',async route=>{
  cloud.push(route.request().url());const url=route.request().url();
  const op=route.request().postDataJSON()?.operation;
  const body=url.includes('/auth/v1/user')?user:url.includes('/rpc/search_action')&&op==='search.context'?{documents:[],profileId:null}:[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3031/discover/');
 await page.getByRole('button',{name:'Open profile navigation'}).click();
 await page.getByRole('button',{name:'Demo mode',exact:true}).click();
 await page.getByRole('button',{name:'View coverage and discoveries'}).click();
 await page.getByText('Fictional example: personal agent search unavailable.',{exact:true}).waitFor();
 assert(await page.getByText('Example Systems (fictional) · Backend Engineering Intern').isVisible());
 await page.getByText('Employer evidence and eligibility',{exact:true}).click();
 await page.getByText('Fictional employer observation for demonstration only.',{exact:true}).waitFor();
 await page.screenshot({path:dir+'/sweeps-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});
 await page.screenshot({path:dir+'/sweeps-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile sweep overflows');
 // Client-side navigation preserves isolated demo state.
 await page.getByRole('button',{name:'Open profile navigation'}).click();await page.getByRole('link',{name:'My Profile',exact:true}).click();
 await page.getByRole('button',{name:/Job preferences/}).click();
 await page.getByRole('heading',{name:'Career context',exact:true}).waitFor();
 const before=cloud.length;
 await page.getByLabel('How your agent should work').fill('Show location. Keep unknown eligibility explicit.');
 await page.getByRole('button',{name:'Save context',exact:true}).click();
 await page.getByText('Fictional context updated in memory.',{exact:true}).waitFor();
 assert.equal(cloud.length,before,'Demo context must not call cloud');
 await page.getByLabel('Context document').selectOption('portals:shared');
 const queries=page.getByLabel('Broad search queries, one per line');
 await queries.fill('fictional backend new graduate');
 await queries.press('End');await queries.press('Enter');
 assert.equal(await queries.inputValue(),'fictional backend new graduate\n');
 await queries.pressSequentially('fictional internship query');
 assert.equal(await queries.inputValue(),'fictional backend new graduate\nfictional internship query');
 await page.getByRole('button',{name:'Add Simplify off-season',exact:true}).click();
 await page.getByRole('button',{name:'Save context',exact:true}).click();
 await page.getByText('Fictional context updated in memory.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'View revisions',exact:true}).click();
 await page.screenshot({path:dir+'/context-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile context overflows');
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'dark'});
 await page.screenshot({path:dir+'/context-desktop.png',fullPage:true});
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({status:'passed',artifacts:dir,checks:['desktop/mobile','context edit/save','portal/query edit','revision view','coverage/evidence','demo cloud isolation','no page errors']}));
}finally{await browser.close();}
