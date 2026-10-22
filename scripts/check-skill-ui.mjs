// Optional browser verification against a built export. All account traffic is fictional.
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/career-skill-ui';await mkdir(dir,{recursive:true});
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3041';
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[],cloud=[],leaks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>{if(window.parent===window)localStorage.setItem('sb-umhqfqzpwmszhcknwtrs-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));},{user,token});
 await context.route('https://umhqfqzpwmszhcknwtrs.supabase.co/**',async route=>{cloud.push(route.request().url());const url=route.request().url();const body=url.includes('/auth/v1/user')?user:url.includes('/rpc/artifact_action')?{items:[],nextOffset:null}:[];await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});});
 // Requests here would be an isolation failure. Block them even if a regression occurs.
 await context.route('https://artifact-exfil.example/**',async route=>{leaks.push(route.request().url());await route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));

 await context.addInitScript(()=>{if(window.parent===window)Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}});});
 await page.goto(base+'/career-toolkit/profile-interview/');await page.waitForLoadState('networkidle');
 await page.getByRole('heading',{name:'Talk through your experience',exact:true}).waitFor();
 assert.equal(await page.locator('iframe').getAttribute('src'),null);
 assert.match(await page.locator('iframe').getAttribute('srcdoc'),/Lookout skill instructions/);
 await page.frameLocator('iframe').getByRole('heading',{name:'Lookout skill instructions'}).waitFor();
 assert.equal(await page.locator('iframe').locator('..').locator('..').locator('fieldset,select,textarea').count(),0);
 await page.getByRole('button',{name:'Copy skill invocation'}).click();
 assert.match(await page.evaluate(()=>window.__copied),/read_guide\(\{"id":"career-profile-interview"\}\)/);
 await page.getByText('Copied. Paste it into your agent to invoke this skill.').waitFor();
 for(const [name,width,height,theme] of [['desktop',1440,1100,'dark'],['mobile',390,844,'light']]){
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});await page.waitForTimeout(350);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const frame=page.frames().find(f=>f.parentFrame());assert(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:dir+'/skill-'+name+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Open profile navigation'}).click();await page.getByRole('button',{name:'Demo mode',exact:true}).click();
 await page.getByRole('button',{name:'Copy skill invocation'}).click();assert.match(await page.evaluate(()=>window.__copied),/Fictional practice only/);
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('Clipboard denied');};});
 await page.getByRole('button',{name:'Copy skill invocation'}).click();assert.match(await page.getByRole('textbox').inputValue(),/Fictional practice only/);
 assert.equal(errors.length,0,errors.join('\n'));console.log('Skill page desktop/mobile, canonical document, copy invocation and no overflow passed');
}finally{await browser.close();}
