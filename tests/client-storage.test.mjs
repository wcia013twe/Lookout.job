import test from 'node:test';
import assert from 'node:assert/strict';
import {clientStorage} from '../supabase/functions/agent-gateway/client-storage.mjs';

test('local signed capabilities use the configured public origin and retain exact tokens and paths', async () => {
  const calls=[];
  const signedUrl='http://kong:8000/storage/v1/object/sign/resumes/owner/file.pdf?token=secret%2Bvalue';
  const storage={
    createSignedUrl:async (...args)=>{calls.push(args);return {data:{signedUrl},error:null};},
    createSignedUploadUrl:async (...args)=>{calls.push(args);return {data:{signedUrl,path:'owner/file.pdf',token:'upload-secret'},error:null};},
    download:async path=>({data:path,error:null}),
  };
  assert.equal(clientStorage(storage),storage);
  const local=clientStorage(storage,{internalUrl:'http://kong:8000',publicUrl:'http://127.0.0.1:54321'});
  assert.equal((await local.createSignedUrl('owner/file.pdf',60)).data.signedUrl,signedUrl.replace('http://kong:8000','http://127.0.0.1:54321'));
  const upload=await local.createSignedUploadUrl('owner/file.pdf',{upsert:false});
  assert.equal(upload.data.path,'owner/file.pdf');
  assert.equal(upload.data.token,'upload-secret');
  assert.deepEqual(calls,[['owner/file.pdf',60],['owner/file.pdf',{upsert:false}]]);
  assert.deepEqual(await local.download('owner/file.pdf'),{data:'owner/file.pdf',error:null});
});

test('public URL configuration rejects credentials, remote HTTP and URL suffixes', () => {
  for(const publicUrl of ['http://remote.example','https://user:pass@example.com','http://127.0.0.1:54321/path','https://example.com?x=y','https://example.com#secret']) {
    assert.throws(()=>clientStorage({}, {internalUrl:'http://kong:8000',publicUrl}));
  }
});

test('storage errors pass through and unrelated capability origins fail closed', async () => {
  const error={error:{message:'Unavailable'},data:null};
  const config={internalUrl:'http://kong:8000',publicUrl:'http://localhost:54321'};
  assert.equal(await clientStorage({createSignedUrl:async()=>error},config).createSignedUrl('private',60),error);
  for(const signedUrl of ['https://unrelated.example/storage/v1/object/sign/resumes/a','http://kong:8000/rest/v1/jobs']) {
    await assert.rejects(()=>clientStorage({createSignedUrl:async()=>({data:{signedUrl}})},config).createSignedUrl('private',60));
  }
});
