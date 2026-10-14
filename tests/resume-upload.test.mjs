import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeUploadDispatch} from '../supabase/functions/agent-gateway/resume-upload.mjs';
const bytes=new TextEncoder().encode('%PDF-test');
const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
test('finalization verifies exact bytes before the metadata write',async()=>{
 const calls=[];
 const result=await resumeUploadDispatch({operation:'resumes.upload.complete',payload:{id:'owned'},rpc:async(op,p)=>{calls.push(op);return op.endsWith('context')?{data:{id:'owned',objectPath:'owner/owned.pdf',fileType:'pdf',sizeBytes:bytes.length,sha256:sha}}:{data:{id:'owned'}};},storage:{download:async(path)=>{assert.equal(path,'owner/owned.pdf');return {data:new Blob([bytes])};}}});
 assert.deepEqual(calls,['resumes.upload.context','resumes.upload.finalize']);assert.equal(result.data.id,'owned');
});
test('a hash mismatch never registers the file',async()=>{
 const calls=[];
 const result=await resumeUploadDispatch({operation:'resumes.upload.complete',payload:{id:'owned'},rpc:async(op)=>{calls.push(op);return {data:{objectPath:'owner/owned.pdf',fileType:'pdf',sizeBytes:bytes.length,sha256:'bad'}};},storage:{download:async()=>({data:new Blob([bytes])})}});
 assert.ok(result.error);assert.deepEqual(calls,['resumes.upload.context']);
});
test('expired, revoked or foreign intents do not access storage',async()=>{
 const result=await resumeUploadDispatch({operation:'resumes.upload.complete',payload:{id:'other'},rpc:async()=>({error:{code:'42501'}}),storage:{download:()=>{throw Error('Must not download');}}});assert.equal(result.error.code,'42501');
});

test('retrying a completed upload returns the existing record without a new capability',async()=>{
 const resume={id:'owned'};
 const result=await resumeUploadDispatch({operation:'resumes.upload.begin',payload:{id:'owned'},rpc:async()=>({data:{id:'owned',completed:true,resume}}),storage:{createSignedUploadUrl:()=>{throw Error('Must not mint another upload URL');}}});
 assert.deepEqual(result.data,{id:'owned',completed:true,resume});
});
