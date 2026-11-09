// Detached, fictional UI checks. No account, employer, password or backend access.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('next-app/out'),dir='/private/tmp/lookout-application-access-ui';await mkdir(dir,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))return res.writeHead(403).end();
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try {
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'}),errors=[],backend=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(/\/(rest|functions)\/v1\//.test(url.pathname))backend.push(url.pathname);return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(`http://127.0.0.1:${server.address().port}/needs-you/?demo=1`);
  const row=company=>page.locator('.action-board-row[data-kind="resolve_blocker"]').filter({hasText:company});
  const tasks=[['signin','Example Sign-in (demo)','I signed in — resume Muse'],['password','Example Secure Entry (demo)','Password entered — resume Muse'],['permission','Example Browser Access (demo)','Access approved — resume Muse'],['verification','Example Verification (demo)','Verification completed — resume Muse']];
  for(const [key,company,label] of tasks){
   const card=row(company);await card.waitFor();
   assert.equal(await card.getByRole('region',{name:'Inferred details'}).count(),0,'Save draft-review material for the review step');
   assert.equal(await card.getByRole('combobox').count(),0,'No unrelated résumé editing on access tasks');
   assert.equal(await card.getByRole('textbox').count(),0,'No answer field or credential collection');
   assert.equal(await card.getByRole('checkbox').count(),0,'No review checkbox without questions');
   assert.equal(await card.getByText('No résumé selected',{exact:true}).count(),0,'Saved selection is shown');
   if(key==='signin'){
    assert.equal(await card.getByText('Résumé selected',{exact:true}).count(),0);
    const link=card.getByRole('link',{name:'Open application',exact:true});await link.waitFor();
    assert.equal(await link.getAttribute('href'),'https://example.com/careers/demo-signin');
    assert.equal(await link.getAttribute('target'),'_blank');
    await card.getByText('Muse couldn’t access the application questions.',{exact:false}).waitFor();
   }else await card.getByText('Résumé selected',{exact:true}).waitFor();
   const button=card.getByRole('button',{name:'Accept: '+label,exact:true});assert.equal(await button.isEnabled(),true);
   await card.scrollIntoViewIfNeeded();await card.screenshot({path:`${dir}/${name}-${key}.png`});
   if(key!=='signin'){await card.getByText('Why Muse paused',{exact:true}).click();
   assert.equal(await card.locator('details[open]').count(),1,'Original saved reason remains accessible');}
   await button.focus();await button.press('Enter');await card.waitFor({state:'detached'});
  }
  const answer=row('Your start date is needed');await answer.waitFor();
  assert.equal(await answer.getByRole('textbox').count(),1);assert.equal(await answer.getByRole('checkbox',{name:'I have checked the answers shown above.'}).count(),1);
  assert.equal(await answer.getByRole('button',{name:/^Accept:/}).isDisabled(),true,'Actual unanswered fields remain gated');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  assert.deepEqual(backend,[]);assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Passed desktop/mobile: precise access tasks, saved résumé, no empty answer reviews, explicit keyboard completion, original diagnostics, genuine-answer gates and no backend calls. Screenshots: '+dir);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
