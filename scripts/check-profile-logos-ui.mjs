// Optional integration check. Start an isolated frontend with NEXT_PUBLIC_LOGO_DEV_TOKEN=pk_test_only.
// Uses fictional admin/demo state, intercepts cloud traffic, and never uses real account data.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-profile-logos';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{demo_preview:true},user_metadata:{},is_anonymous:false};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fictional';
 await context.addInitScript(({user,token})=>{localStorage.setItem('sb-osyrlausutnqzlegxmnd-auth-token',JSON.stringify({access_token:token,refresh_token:'fictional',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));},{user,token});
 const writes=[],requests=[],cachedRequests=[];
 await context.route('https://*.supabase.co/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/storage/')){cachedRequests.push(url.pathname);return route.fulfill({status:404,body:''});}
  const op=route.request().postDataJSON()?.operation;
  if(op&&!op.endsWith('.read')&&!op.endsWith('.context'))writes.push(op);
  const body=url.pathname.endsWith('/auth/v1/user')?user:op==='search.context'?{documents:[],profileId:null}:[];
  return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
 });
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
 await context.route('https://img.logo.dev/**',route=>{
  const url=new URL(route.request().url());requests.push(url.pathname);
  return url.pathname.includes('Missing Logo')||decodeURIComponent(url.pathname).includes('Missing Logo')?route.fulfill({status:404,body:''}):route.fulfill({status:200,contentType:'image/png',body:pixel});
 });
 const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.LOOKOUT_UI_URL||'http://127.0.0.1:39841')+'/profile/?demo=1');
 await page.getByRole('button',{name:'About me',exact:true}).click();
 const work=page.getByRole('region',{name:'Work experience',exact:true}),education=page.getByRole('region',{name:'Education',exact:true}),projects=page.getByRole('region',{name:'Projects & outside experience',exact:true});
 assert.equal(await work.getByRole('img').count(),0,'Fictional work uses fallback');
 assert.equal(await education.getByRole('img').count(),0,'Fictional schools use fallback');
 assert.equal(await work.locator('svg[width="24"]').count(),2);
 assert.equal(await education.locator('svg[width="24"]').count(),1);
 assert.equal(await projects.locator('svg[width="28"]').count(),1,'Project retains its own icon');
 assert(!requests.some(path=>path.includes('Example')),'No fictional provider lookups');
 await work.getByRole('button',{name:'Edit Work experience',exact:true}).click();
 const company=work.getByRole('textbox',{name:'Company',exact:true}).first();
 await company.fill('NVIDIA');
 const loaded=work.getByRole('img',{name:'NVIDIA logo',exact:true});
 await loaded.waitFor();await loaded.evaluate(img=>img.decode());
 assert(new URL(await loaded.getAttribute('src')).hostname==='img.logo.dev');
 // A new name resets failed-image state; missing provider images fall back to a briefcase.
 await company.fill('Google');
 const google=work.getByRole('img',{name:'Google logo',exact:true});await google.waitFor();await google.evaluate(img=>img.decode());
 assert.equal(new URL(await google.getAttribute('src')).hostname,'img.logo.dev','Google also uses the provider directly');
 await company.fill('Missing Logo Example');
 await work.getByRole('img',{name:'Missing Logo Example logo',exact:true}).waitFor({state:'hidden'});
 assert.equal(await work.locator('svg[width="24"]').count(),2);
 await company.fill('NVIDIA');await loaded.waitFor();await loaded.evaluate(img=>img.decode());
 await work.getByRole('button',{name:'Finish editing Work experience',exact:true}).click();
 await education.getByRole('button',{name:'Edit Education',exact:true}).click();
 await education.getByRole('textbox',{name:'School',exact:true}).fill('Stanford University');
 const school=education.getByRole('img',{name:'Stanford University logo',exact:true});await school.waitFor();await school.evaluate(img=>img.decode());
 await page.addStyleTag({content:'nextjs-portal{display:none}'});
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  if(process.env.LOOKOUT_UI_SCREENSHOTS!=='0'){await work.screenshot({path:dir+'/'+name+'-work.png'});await education.screenshot({path:dir+'/'+name+'-education.png'});}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow');
 }
 await education.getByRole('button',{name:'Finish editing Education',exact:true}).click();
 await page.getByRole('button',{name:'Open profile navigation',exact:true}).click();await page.getByRole('button',{name:'Reset demo data',exact:true}).click();
 await work.getByText('Example Systems (demo)',{exact:true}).waitFor();
 assert.equal(await work.getByRole('img').count(),0);assert.equal(await education.getByRole('img').count(),0);
 assert.deepEqual(cachedRequests,[],'No legacy logo storage requests');assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 console.log('PASS: work/school logos, briefcase fallback, name-change recovery, project icon, demo reset, desktop/mobile; no account writes');
}finally{await browser.close();}
