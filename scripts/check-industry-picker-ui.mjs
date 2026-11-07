// Isolated demo and component checks. No account data or backend writes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {industryOptions} from '../lib/industries.mjs';
const root=process.cwd(),artifact=join(root,'next-app/.profile-flow-proof/industries');
await mkdir(artifact,{recursive:true});
const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const log=await open(join(artifact,'dev.log'),'w');
const dev=spawn(process.execPath,[join(root,'next-app/node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:join(root,'next-app'),env:{...process.env,NEXT_PUBLIC_LOGO_DEV_TOKEN:'industry-test'},stdio:['ignore',log.fd,log.fd],detached:true});
let browser;
try{
 const base='http://127.0.0.1:'+port;
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/profile/',{signal:AbortSignal.timeout(10000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,300));}assert(ready,'Frontend startup');
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',serviceWorkers:'block'});
 const cloud=[];await context.route('**/*.supabase.co/**',route=>{cloud.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/profile/?demo=1');
 const nav=page.getByRole('navigation',{name:'Profile sections',exact:true});
 await nav.getByRole('button',{name:'Job preferences',exact:true}).click();
 const companies=page.getByRole('region',{name:'Companies & industries',exact:true});
 await companies.getByRole('list',{name:'Selected industries'}).waitFor();
 await companies.getByRole('button',{name:'Edit Companies & industries',exact:true}).click();
 const picker=companies.getByRole('group',{name:'Industries',exact:true});
 assert.equal(await picker.getByRole('button').count(),32);
 for(const name of industryOptions)assert.equal(await picker.getByRole('button',{name,exact:true}).count(),1);
 assert.equal(await picker.getByRole('button',{name:'AI & Machine Learning',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await companies.getByRole('combobox',{name:'Industries priority',exact:true}).inputValue(),'Preferred');
 const toggle=name=>picker.getByRole('button',{name,exact:true});
 // Native keyboard toggles, rapid edits, and restoring an unchecked custom choice.
 await toggle('Fintech').focus();await page.keyboard.press('Space');
 assert.equal(await toggle('Fintech').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Enter');assert.equal(await toggle('Fintech').getAttribute('aria-pressed'),'false');
 await toggle('Research tools (demo)').click();assert.equal(await toggle('Research tools (demo)').getAttribute('aria-pressed'),'false');
 await toggle('Research tools (demo)').click();
 for(const name of ['Fintech','Robotics & Automation','Financial Services'])await toggle(name).click();
 await page.waitForTimeout(900);
 assert.equal(await companies.getByRole('combobox',{name:'Industries priority',exact:true}).inputValue(),'Preferred');
 await page.getByRole('button',{name:'Undo last adjustment',exact:true}).click();
 assert.equal(await toggle('Financial Services').getAttribute('aria-pressed'),'false');
 assert.equal(await toggle('Robotics & Automation').getAttribute('aria-pressed'),'true');
 await page.waitForTimeout(900);
 await companies.getByRole('button',{name:'Finish editing Companies & industries',exact:true}).click();
 assert.equal(await companies.getByRole('button',{name:'Fintech',exact:true}).count(),0);
 assert.match(await companies.getByRole('list',{name:'Selected industries'}).innerText(),/Fintech/);
 // Leave/remount the provider: state must come from saved demo records.
 await page.getByRole('link',{name:'Career Toolkit',exact:true}).click();await page.waitForURL('**/career-toolkit/');
 await page.getByRole('button',{name:'Open profile navigation',exact:true}).click();await page.getByRole('link',{name:'My Profile',exact:true}).click();
 await nav.getByRole('button',{name:'Job preferences',exact:true}).click();
 assert.match(await companies.getByRole('list',{name:'Selected industries'}).innerText(),/Robotics & Automation/);
 assert.doesNotMatch(await companies.getByRole('list',{name:'Selected industries'}).innerText(),/Financial Services/);
 await companies.getByRole('button',{name:'Edit Companies & industries',exact:true}).click();
 await page.addStyleTag({content:'nextjs-portal{display:none}'});
 // Capture both shipped color modes and viewport classes in one inspection pass.
 for(const [name,width,height,scheme] of [['desktop-dark',1440,1000,'dark'],['mobile-light',390,844,'light']]){
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:scheme});
  await companies.screenshot({path:join(artifact,name+'.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  for(const button of await picker.getByRole('button').all())assert((await button.boundingBox()).height>=44,'44px touch target');
 }
 await page.setViewportSize({width:1440,height:1000});
 // Duplicate instructions are never silently overwritten by the picker.
 await page.getByRole('button',{name:'Edit Advanced instructions',exact:true}).click();
 const prompt=page.getByRole('textbox',{name:/preference prompt/});
 const prior=await prompt.inputValue();
 await prompt.fill(prior.replace('## Company preferences','## Company preferences\n- Industries: Energy'));
 await picker.getByText('Resolve duplicate Industries lines in Advanced instructions.',{exact:true}).waitFor();
 for(const button of await picker.getByRole('button').all())assert(await button.isDisabled());
 await page.getByRole('button',{name:'Retry saving',exact:true}).waitFor();
 await prompt.fill(prior);await page.waitForTimeout(900);
 await page.getByRole('button',{name:'Retry saving',exact:true}).waitFor({state:'hidden'});
 assert.equal(await toggle('Fintech').getAttribute('aria-pressed'),'true');
 // Clearing all selections is valid and keeps the separate priority.
 for(const name of await picker.locator('button[aria-pressed="true"]').allTextContents())await toggle(name.trim()).click();
 assert.equal(await picker.locator('button[aria-pressed="true"]').count(),0);
 assert.equal(await companies.getByRole('combobox',{name:'Industries priority',exact:true}).inputValue(),'Preferred');
 await page.waitForTimeout(900);
 await companies.getByRole('button',{name:'Finish editing Companies & industries',exact:true}).click();
 assert.match(await companies.innerText(),/Not specified/);
 await page.getByRole('button',{name:'Open profile navigation',exact:true}).click();await page.getByRole('button',{name:'Reset demo data',exact:true}).click();
 await nav.getByRole('button',{name:'Job preferences',exact:true}).click();
 assert.equal(await companies.getByRole('list',{name:'Selected industries'}).locator('li').count(),4);
 assert.equal(cloud.length,0,'Detached demo never calls backend');assert.deepEqual(errors,[]);
 // Controlled component harness verifies busy state independently of save timing.
 const bundle=await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import Picker from './components/industry-picker'; const root=createRoot(document.getElementById('root')); window.renderPicker=props=>root.render(<Picker {...props} onChange={value=>window.changed=value}/>);`,resolveDir:join(root,'next-app'),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
 const harness=await context.newPage();await harness.setContent('<div id="root"></div>');await harness.addScriptTag({content:bundle.outputFiles[0].text});
 await harness.evaluate(()=>window.renderPicker({value:'Fintech, Research tools (demo)',disabled:true}));
 await harness.getByRole('button',{name:'Fintech',exact:true}).waitFor();
 for(const button of await harness.getByRole('button').all())assert(await button.isDisabled());
 await harness.getByRole('button',{name:'Fintech',exact:true}).evaluate(el=>el.click());assert.equal(await harness.evaluate(()=>window.changed),undefined);
 await harness.evaluate(()=>window.renderPicker({value:'Fintech, Research tools (demo)',disabled:false}));
 await harness.getByRole('button',{name:'Fintech',exact:true}).click();assert.equal(await harness.evaluate(()=>window.changed),'Research tools (demo)');
 console.log('PASS: exact taxonomy, standard/custom selection, native Space/Enter, rapid edits, autosave/remount, undo after save, finish/reopen, duplicates/recovery, clearing, busy state, reset isolation, desktop dark/mobile light, 44px targets, no overflow or cloud writes. Screenshots: '+artifact);
}finally{await browser?.close();try{process.kill(-dev.pid,'SIGTERM');}catch{}await log.close();}
