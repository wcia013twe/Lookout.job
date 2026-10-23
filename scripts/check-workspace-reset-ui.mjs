// Local static-export check. All account network traffic is blocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('../runner/node_modules/playwright/index.mjs');
const root=resolve('next-app/out'),dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-workspace-reset-ui';
await mkdir(dir,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.endsWith('/'))pathname+='index.html';const file=resolve(root,'.'+pathname);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}const body=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
try{
 for(const [name,width,height] of [['desktop',1280,900],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},colorScheme:'dark',serviceWorkers:'block'});
  const calls=[];await context.route('https://*.supabase.co/**',route=>{calls.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/workspace-reset/?demo=1');
  await page.getByRole('button',{name:'Preview reset',exact:true}).click();
  const confirm=page.getByRole('button',{name:'Permanently reset workspace',exact:true});assert.equal(await confirm.isDisabled(),true);
  const input=page.getByLabel('Type RESET MY WORKSPACE to confirm permanent deletion');await input.fill('yes');assert.equal(await confirm.isDisabled(),true);await input.fill('RESET MY WORKSPACE');assert.equal(await confirm.isEnabled(),true);
  await page.screenshot({path:`${dir}/${name}-confirm.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await confirm.click();await page.getByRole('status').filter({hasText:'Fictional workspace reset.'}).waitFor();
  assert.equal(await page.evaluate(()=>Object.keys(window.JB.store.get('workflow.applications')).length),0);assert.equal(await page.evaluate(()=>window.JB.store.get('workflow.resumes').length),0);
  await page.screenshot({path:`${dir}/${name}-complete.png`,fullPage:true});
  await page.getByRole('button',{name:'Open profile navigation'}).click();await page.getByRole('button',{name:'Reset demo data',exact:true}).click();await page.getByRole('button',{name:'Preview reset',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>Object.keys(window.JB.store.get('workflow.applications')).length)>0);
  assert.deepEqual(calls,[]);await context.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',checks:['desktop/mobile','typed confirmation','fictional empty state','fixture restoration','no account network calls','no overflow','no page errors'],artifacts:dir}));
}finally{await browser.close();await new Promise(done=>server.close(done));}
