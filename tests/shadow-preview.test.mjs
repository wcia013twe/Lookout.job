import test from 'node:test';
import assert from 'node:assert/strict';
import {shadowPreviewEntry,writeShadowPreview} from '../backend/runtime/shadow-preview.mjs';

const preview={subjectKey:'subject-0123456789abcdef',runId:'fixture-run',trigger:'onboarding',mode:'fictional',recommendation:'Practice queue-consumer idempotency.',citations:[{sourceId:'report-1',revision:1}]};
test('shadow preview allowlists fields and never accepts delivery or private context',()=>{
  const entry=shadowPreviewEntry({...preview,delivery:{enabled:true},profile:{email:'private@example.com'},resume:'PRIVATE_RESUME',tokenUsage:{input:12,output:5},cost:0});
  assert.deepEqual(entry.jsonPayload.delivery,{enabled:false,attempted:false});
  assert(!JSON.stringify(entry).includes('PRIVATE_RESUME'));
  assert(!JSON.stringify(entry).includes('private@example.com'));
  assert.deepEqual(entry.jsonPayload.measurement.tokenUsage,{input:12,output:5});
  assert.equal(entry.jsonPayload.measurement.retrievalMs,null);
  assert.equal(entry.jsonPayload.measurement.cost,0);
  assert.equal(entry.jsonPayload.author,null);
  assert.equal(shadowPreviewEntry({...preview,author:'Current assistant'}).jsonPayload.author,'Current assistant');
  assert.equal(entry.insertId,shadowPreviewEntry({...preview,tokenUsage:{input:12,output:5},cost:0}).insertId);
  for(const change of [{subjectKey:'private@example.com'},{recommendation:''},{recommendation:'x'.repeat(12001)},{mode:'unknown'},{trigger:'send'},{citations:[{sourceId:'r',revision:0}]}])assert.throws(()=>shadowPreviewEntry({...preview,...change}));
});
test('preview masks credentials and email and removes URL credentials, query and fragments',()=>{
  const entry=shadowPreviewEntry({...preview,recommendation:'Contact private@example.com. Bearer secret. https://user:pass@example.com/report?token=secret#private'});
  const text=entry.jsonPayload.recommendation;
  assert(!text.includes('private@example.com'));assert(!text.includes('secret'));assert(!text.includes('user:pass'));assert(!text.includes('#private'));
  assert(text.includes('https://example.com/report'));
});
test('cloud writer sends only the preview to fixed logging endpoint and returns no message for user delivery',async()=>{
  let calls=0;
  const receipt=await writeShadowPreview('example-project',preview,'server-token',{request:async(url,options)=>{
    calls++;assert.equal(url,'https://logging.googleapis.com/v2/entries:write');
    assert.equal(options.headers.Authorization,'Bearer server-token');
    assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);
    assert.equal(body.logName,'projects/example-project/logs/lookout-shadow');assert.equal(body.partialSuccess,false);
    assert.equal(body.entries[0].jsonPayload.trigger,'onboarding');assert(!options.body.includes('server-token'));
    return new Response('{}');
  }});
  assert.equal(calls,1);assert.deepEqual(receipt.delivery,{enabled:false,attempted:false});assert.equal(receipt.message,undefined);
  await assert.rejects(()=>writeShadowPreview('example-project',preview,'server-token',{request:async()=>new Response('private failure details',{status:403})}),/^Error: Shadow logging failed \(HTTP 403\); no delivery attempted$/);
  await assert.rejects(()=>writeShadowPreview('bad/project',preview,'token'));
});
