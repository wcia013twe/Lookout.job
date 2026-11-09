#!/usr/bin/env node
// Exercise frozen fictional HTTPS forms entirely inside intercepted browser routes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {BrowserHost} from './browser.mjs';import {read,write,hash} from './core.mjs';
const [output]=process.argv.slice(2);if(!output||fs.existsSync(output))throw Error('New output directory required');fs.mkdirSync(output,{recursive:true,mode:0o700});
const spec=read(new URL('../../examples/job02/controlled-scenario.json',import.meta.url)),actor=read(new URL('../../examples/job02/controlled-actor.json',import.meta.url)),resume=path.join(output,'fictional.pdf');fs.writeFileSync(resume,'%PDF-1.4\nFictional local document\n%%EOF');
let b;const report={status:'running',synthetic:true,controlled:true,inferenceExecuted:false,externalRequestsSent:0,conditions:{}};
try{for(const condition of ['baseline','lookout']){
 b=await new BrowserHost({targets:spec.targets,resume,output:path.join(output,condition),profile:path.join(output,condition+'-profile'),executablePath:process.env.JOB02_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',synthetic:true,controlled:true,fixtureRoot:path.resolve('examples/job02/forms')}).start();
 assert.equal((await b.open('manual')).manualHandoff,true);
 for(const id of ['personal','clean']){let state=await b.open(id);spec.targets.find(t=>t.id===id).expectedFingerprint=state.fingerprint;
 for(const [key,value]of [['name','Fictional Person'],['email','candidate@example.test'],...(id==='personal'?[['motivation',actor.facts[0].answer]]:[])])state=await b.fill(id,key,value,state.fingerprint);
 state=await b.upload(id,'resume',state.fingerprint);assert.equal(state.readyToSubmit,true);assert.equal(state.resumeUpload.sha256,hash(fs.readFileSync(resume)));}
 await b.capture('final');const target=spec.targets.find(t=>t.id==='clean');
 for(const mode of ['submit','requestSubmit','keyboard','get']){const p=await b.context.newPage();p._job02Target=target;await p.goto(target.url);await p.evaluate(()=>{document.forms[0].noValidate=true;});
 if(mode==='keyboard')await p.locator('#name').press('Enter');else await p.evaluate(mode=>{const f=document.forms[0];if(mode==='get'){f.method='get';f.submit();}else f[mode]();},mode);
 await p.waitForTimeout(75);await p.close();}
 assert.ok(b.events.filter(e=>e.kind==='network_blocked').length>=4);report.conditions[condition]={status:'passed',manualHandoff:true,bothFormsReady:true,fileHashVerified:true,keyboardAndScriptAndGetSubmitDenied:true};await b.close();b=null;
 }report.status='passed';write(output+'/scenario-with-fingerprints.json',spec);write(output+'/verification.json',report);console.log(JSON.stringify(report));
}catch(e){report.status='failed';report.error=e.message;write(output+'/failure.json',report);throw e;}finally{if(b)await b.close();}
