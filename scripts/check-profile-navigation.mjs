// A complete isolated demo navigation flow; no account or backend writes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),artifact=join(root,'next-app/.profile-flow-proof');
await mkdir(artifact,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const log=await open(join(artifact,'navigation-dev.log'),'w');
const dev=spawn(process.execPath,[join(root,'next-app/node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:join(root,'next-app'),env:{...process.env,NEXT_PUBLIC_LOGO_DEV_TOKEN:'navigation-test'},stdio:['ignore',log.fd,log.fd],detached:true});
let browser;
try {
 const base='http://127.0.0.1:'+port;
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/profile/')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,300));}assert.ok(ready,'Frontend startup');
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.goto(base+'/profile/?demo=1');
  await page.getByRole('heading',{name:'About me',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Overview',exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Open onboarding',exact:true}).count(),0);
  assert.equal(await page.locator('footer').count(),0);
  if(width===390)await page.getByRole('combobox',{name:/Profile section/}).selectOption('appearance');
  else await page.getByRole('button',{name:'Appearance',exact:true}).click();
  await page.getByRole('heading',{name:'Setup & guidance',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Open onboarding',exact:true}).getAttribute('href'),'/onboarding/?demo=1');
  assert.equal(await page.getByRole('link',{name:'Reset workspace',exact:true}).getAttribute('href'),'/workspace-reset/?demo=1');
  await page.screenshot({path:join(artifact,`appearance-${width}.png`),fullPage:true});
  await page.getByRole('link',{name:'Dashboard tour',exact:true}).click();
  await page.getByRole('button',{name:'Skip tour',exact:true}).click();
  await page.getByRole('button',{name:'Open profile navigation',exact:true}).click();
  await page.getByRole('link',{name:'Sharing & privacy',exact:true}).click();
  await page.getByRole('link',{name:'Read the privacy policy',exact:true}).waitFor();
  await page.getByRole('link',{name:'Read the privacy policy',exact:true}).click();
  await page.waitForURL('**/privacy/');
  await page.goto(base+'/applications/?demo=1');
  await page.getByRole('heading',{name:'Your Job Tracker',exact:true}).waitFor();
  const rowsBefore=await page.locator('.tracker-row').count();assert.ok(rowsBefore>0,'Demo active tracker has representative rows');
  await page.getByRole('button',{name:'Stats',exact:true}).click();
  const stats=page.getByRole('region',{name:'Application stats',exact:true});await stats.waitFor();
  const values=await stats.locator(':scope > dl dd').allTextContents();assert.equal(values.length,4);assert.ok(Number(values[0])>0);assert.ok(Number(values[1])>0);assert.ok(Number(values[2])>0);
  await page.locator('[data-application-flow-chart] svg').waitFor();
  const chart=page.getByRole('region',{name:'Application flow',exact:true});
  await chart.getByLabel('Application flow counts').waitFor();
  assert.equal(await page.getByLabel('Search tracked roles').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
  await page.screenshot({path:join(artifact,`tracker-stats-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Active',exact:true}).click();assert.equal(await page.locator('.tracker-row').count(),rowsBefore);
  await page.getByRole('button',{name:'Saved jobs',exact:true}).click();await page.getByLabel('Search tracked roles').fill('no-matching-role');await page.getByRole('heading',{name:'No matching roles',exact:true}).waitFor();
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.goto(base+'/applications/?demo=1&demoApi=application-flow');
  await page.getByRole('button',{name:'Stats',exact:true}).click();
  const flow=page.getByRole('region',{name:'Application flow',exact:true});
  await flow.locator('svg').waitFor();
  assert.deepEqual(await flow.locator('dd').allTextContents(),['1','1','1','1','1','1']);
  await flow.getByText('6 applications · Current recorded stages and outcomes',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Flow fits mobile page');
  // SVG nodes and links have finite, visible geometry, including the single-link case.
  assert.ok(await flow.locator('svg path').count()>=6);
  await page.screenshot({path:join(artifact,`application-flow-${width}.png`),fullPage:true});
 }
 await page.goto(base+'/applications/?demo=1&demoApi=application-flow-single');
 await page.getByRole('button',{name:'Stats',exact:true}).click();
 await page.locator('[data-application-flow-chart] svg path').first().waitFor();
 await page.getByText('1 application · Current recorded stages and outcomes',{exact:true}).waitFor();
 await page.goto(base+'/applications/?demo=1&demoApi=application-flow-empty');
 await page.getByRole('button',{name:'Stats',exact:true}).click();
 await page.getByText('Your flow will appear when an application or hiring stage is recorded.',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-application-flow-chart] svg').count(),0);
 await page.goto(base+'/profile/?demo=1&section=overview');await page.getByRole('heading',{name:'About me',exact:true}).waitFor();
 assert.deepEqual(errors,[],'No browser runtime errors');
 console.log('PASS: desktop/mobile profile → Appearance → tour → profile privacy → policy → tracker Stats → tracker filters; legacy Overview link; six/single/empty Sankey states; no footer or overflow. Screenshots: next-app/.profile-flow-proof');
}finally{await browser?.close();try{process.kill(-dev.pid,'SIGTERM');}catch{}await log.close();}
