import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalSubmissionTarget,identifySubmissionTarget,validSubmissionReceipt} from '../lib/submission-targets.mjs';
import {validateApplicationJob} from '../supabase/functions/agent-gateway/application-jobs.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createDemoWorkspace,createDemoServices} from '../next-app/lib/muse-demo-fixtures.mjs';
import {buildSubmissionRecord} from '../lib/submission-record.mjs';
import {normalizeApplicationQuestion} from '../lib/application-field-facts.mjs';
import {assertSubmitFormScope} from '../runner/submit.mjs';
const urls={greenhouse:'https://job-boards.greenhouse.io/fixture/jobs/123',ashby:'https://jobs.ashbyhq.com/fixture/abc-123',lever:'https://jobs.lever.co/fixture/abc-123'};
export const receipts=Object.entries(urls).map(([ats,jobUrl])=>({source:`runner-observed-${ats}-confirmation`,jobUrl,observedUrl:jobUrl+(ats==='lever'?'/thanks':ats==='ashby'?'/application':'/confirmation'),marker:ats==='greenhouse'?'#confirmation':'h1',message:'Your application has been submitted.'}));
test('Lever required-field glyphs preserve exact draft labels but normalize for verified fact and resume matching',()=>{
 assert.equal(normalizeApplicationQuestion('Email ✱'),'email');
 assert.doesNotThrow(()=>assertSubmitFormScope({questions:[{question:'Resume/CV ✱',fields:[{type:'file'}]}]}));
 assert.throws(()=>assertSubmitFormScope({questions:[{question:'Transcript ✱',fields:[{type:'file'}]}]}));
});
test('the queue accepts canonical supported postings and rejects application-path aliases and injected URLs',()=>{
 for(const [ats,url] of Object.entries(urls)){
  assert.equal(canonicalSubmissionTarget(url).ats,ats);
  assert.doesNotThrow(()=>validateApplicationJob({posting:{id:'fixture',company:'Fixture',title:'Engineer',employmentType:'FT',location:'Remote',url},expectedRevision:0,eventKey:'fixture'}));
 }
 assert.equal(identifySubmissionTarget(urls.ashby+'/application').url,urls.ashby);
 assert.equal(identifySubmissionTarget(urls.lever+'/apply').url,urls.lever);
 assert.equal(canonicalSubmissionTarget('https://jobs.eu.lever.co/fixture/abc-123').ats,'lever');
 for(const url of [urls.lever+'/apply',urls.ashby+'/application',urls.lever+'?redirect=x',urls.ashby+'#application',urls.lever+'/',urls.lever.replace('jobs.lever.co','jobs.lever.co.evil.example'),urls.ashby.replace('https://','https://user:password@'),'https://example.com/jobs/123','https://fixture.myworkdayjobs.com/job/123'])assert.throws(()=>canonicalSubmissionTarget(url),url);
});
test('receipt validation binds platform, job, success message and expected confirmation URL together',()=>{
 for(const receipt of receipts){
  assert.equal(validSubmissionReceipt(receipt),true);
  assert.doesNotThrow(()=>validateRequest({operation:'submission.finish',payload:{applicationId:'11111111-1111-4111-8111-111111111111',claimId:'22222222-2222-4222-8222-222222222222',outcome:'confirmed',receipt}}));
  for(const patch of [{source:'runner-observed-workday-confirmation'},{observedUrl:urls.ashby+'/different-job'},{observedUrl:receipt.observedUrl+'?redirect=x'},{observedUrl:receipt.observedUrl+'#fragment'},{message:'The form disappeared'},{marker:'body'}])assert.equal(validSubmissionReceipt({...receipt,...patch}),false,JSON.stringify(patch));
 }
 assert.equal(validSubmissionReceipt({...receipts[1],source:receipts[2].source}),false);
});
test('vendored MIT source files are byte-for-byte pinned GitHub blobs',async()=>{
 const files={'ashby.js':'d71059a232b5c4abcd2fdff49f1b018b232bec0a','lever.js':'345b3270c46c9911469d6aea3c48fa00db77b10f','LICENSE':'52f8108517056adbf0eea5e10a15ac4075ded83d'};
 for(const [name,hash] of Object.entries(files)){
  const bytes=await readFile(new URL('../runner/vendor/applyai/'+name,import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),hash,name);
 }
});
test('resettable fictional demo exposes Ashby and Lever confirmation records without external writes',async()=>{
 const state=createDemoWorkspace('2026-11-03');
 const store={get:key=>key.split('.').reduce((value,part)=>value?.[part],state),set:()=>{throw Error('No writes expected');}};
 const api=createDemoServices(store);
 for(const ats of ['ashby','lever']){
  const record=await api.readSubmissionRecord('demo-'+ats);
  assert.equal(record.attempts[0].receipt.source,`runner-observed-${ats}-confirmation`);
  assert.equal(buildSubmissionRecord(record.application,record.attempts).attempts[0].confirmed,true);
  assert.match(record.attempts[0].receipt.jobUrl,/^https:\/\/example.com\/demo\//);
 }
});
