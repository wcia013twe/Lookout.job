#!/usr/bin/env node
// Controlled forms only. Never contacts an employer or invokes a participant model.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {BrowserHost} from './browser.mjs';
import {hash,write,actorAnswer,read,readiness,launchGate,gates,digest} from './core.mjs';
import {responsePayload} from './native.mjs';
export async function fixtureServer(){
 const requests=[];
 const server=http.createServer((req,res)=>{requests.push({method:req.method,url:req.url});if(!['/clean','/personal'].includes(req.url)){res.writeHead(405);res.end('No submissions');return;}
  res.setHeader('content-type','text/html');res.end(`<!doctype html><html><body><form method="post" action="/submit"><label for="name">Full name</label><input id="name" required><label for="email">Email</label><input id="email" type="email" required>${req.url==='/personal'?'<label for="motivation">Why do you want to apply?</label><textarea id="motivation" required maxlength="500"></textarea>':''}<label for="resume">Resume</label><input id="resume" type="file" required><label for="scope">Scope</label><select id="scope" onchange="document.getElementById('detail').hidden=this.value!=='other'"><option value="systems">Systems</option><option value="other">Other</option></select><span id="detail" hidden><label for="extra">Other details</label><input id="extra"></span><button type="submit">Submit</button></form></body></html>`);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,requests,url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
export async function rehearse(output){
 if(fs.existsSync(output))throw Error('Preserve prior rehearsal; new output required');fs.mkdirSync(output,{recursive:true,mode:0o700});
 const fixture=await fixtureServer(),resume=output+'/fictional-resume.pdf';fs.writeFileSync(resume,Buffer.from('%PDF-1.4\nFictional JOB02 browser test only\n%%EOF'));
 const report={synthetic:true,inferenceExecuted:false,realEmployerAccess:false,conditions:{},checks:[],startedAt:new Date().toISOString()};let browser;
 const targets=[{id:'manual',kind:'workday',url:fixture.url+'/workday'},{id:'personal',kind:'personal_input',url:fixture.url+'/personal'},{id:'clean',kind:'greenhouse',url:fixture.url+'/clean'}];
 try{
  for(const condition of ['baseline','lookout']){
   browser=await new BrowserHost({targets,resume,output:output+'/'+condition,profile:output+'/'+condition+'-profile',executablePath:process.env.JOB02_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',synthetic:true}).start();
   const manual=await browser.open('manual');assert.equal(manual.manualHandoff,true);assert.equal(fixture.requests.some(r=>r.url==='/workday'),false);
   let state=await browser.open('personal');assert.equal(state.inspectionComplete,true);const initialFp=state.fingerprint;
   state=await browser.fill('personal','scope','other',state.fingerprint);
   await assert.rejects(browser.fill('personal','name','Fictional Candidate',initialFp),/Form changed/);
   state=await browser.fill('personal','name','Fictional Candidate',state.fingerprint);state=await browser.fill('personal','email','candidate@example.test',state.fingerprint);
   const actor=read(new URL('../../examples/job02/actor.json',import.meta.url));const answer=actorAnswer(actor,'personal','Why do you want to apply?');
   state=await browser.fill('personal','motivation',answer.answer,state.fingerprint);state=await browser.upload('personal','resume',state.fingerprint);assert.equal(state.upload.sha256,hash(fs.readFileSync(resume)));assert.equal(state.readyToSubmit,true);
   const payload=responsePayload({kind:'resolve_blocker',applicationId:'fictional',key:'fixture:personal',questions:[{fieldId:'name',question:'Full name',answer:'Fictional Candidate'},{fieldId:'motivation',question:'Why do you want to apply?',answer:''}]},'personal',actor);
   assert.equal(payload.payload.response,'accept');assert.equal(payload.payload.input.answers[0],'Fictional Candidate');assert.equal(payload.eventExpected,true);
   let clean=await browser.open('clean');for(const [field,value]of [['name','Fictional Candidate'],['email','candidate@example.test']])clean=await browser.fill('clean',field,value,clean.fingerprint);clean=await browser.upload('clean','resume',clean.fingerprint);assert.equal(clean.readyToSubmit,true);
   await assert.rejects(browser.call('browser_submit',{}),/unavailable/);
   // Test lower-level bypass attempts without making them available to participants.
   const page=browser.pages.get('clean');await page.evaluate(()=>{fetch('/submit',{method:'POST',body:'denied'}).catch(()=>{});fetch('/submit?method=get').catch(()=>{});});await page.waitForTimeout(100);
   assert.equal(fixture.requests.some(r=>r.url.startsWith('/submit')),false);
   const capture=await browser.capture('final');assert.equal(capture.targets.length,3);assert.equal(capture.targets.find(t=>t.targetId==='manual').observed,true);
   report.conditions[condition]={status:'passed',fieldCapture:true,conditionalFingerprintFence:true,resumeHash:true,manualNoAccess:true,filledReady:true,submissionNetworkDenied:true,nativeIngress:'not_tested'};
   await browser.close();browser=null;
  }
  const gateRoot=output+'/guard';fs.mkdirSync(gateRoot,{recursive:true});write(gateRoot+'/freeze.json',{version:'synthetic',files:{}});fs.mkdirSync(gateRoot+'/suite');write(gateRoot+'/suite/scenario.json',read(new URL('../../examples/job02/scenario.json',import.meta.url)));
  const blocked=readiness(gateRoot,{});assert.equal(blocked.ready,false);write(gateRoot+'/readiness.json',{...blocked,ready:true});write(gateRoot+'/receipts.json',{});assert.throws(()=>launchGate(gateRoot),/Launch blocked/);
  report.checks=['three_browser_paths','both_condition_browser_paths','conditional_field_drift_rejected','correct_fictional_resume_hash','human_payload_preserves_answers','unexposed_submit_rejected','post_and_get_submission_denied','missing_gate_blocks_readiness','forged_ready_bit_rejected'];
  report.status='passed';report.readyForLive=false;report.remaining=['actual participant container/browser parity','real native human ingress and exact event','selected live target verification','native schemas','independent final grader assignment'];write(output+'/rehearsal.json',report);return report;
 }catch(e){report.status='failed';report.error=e.message;write(output+'/failure.json',report);throw e;}finally{if(browser)await browser.close();await fixture.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){const out=process.argv[2];if(!out)throw Error('Usage: rehearse.mjs NEW_OUTPUT_DIRECTORY');const r=await rehearse(path.resolve(out));console.log(JSON.stringify({status:r.status,synthetic:true,readyForLive:false,receipt:path.resolve(out,'rehearsal.json')}));}
