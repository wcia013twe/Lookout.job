import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {SearchStaging,pruneSearchStaging} from '../backend/runtime/search-staging.ts';
test('immutable staged snapshots isolate attempts, survive a new instance, reject paths and clean up',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lookout-staging-fixture-'));
 try{
  const stage=new SearchStaging(root,'job-one','run-one');
  const keys=await Promise.all(Array.from({length:10},(_,i)=>stage.write(i,'same-source',{value:i})));
  assert.equal(new Set(keys).size,10);
  const resumed=new SearchStaging(root,'job-one','run-one');
  for(let i=0;i<keys.length;i++)assert.deepEqual(await resumed.read(keys[i]),{value:i});
  assert.equal(await resumed.read('../credentials'),null);
  assert.equal(await new SearchStaging(root,'other-job','run-one').read(keys[0]),null);
  assert.equal((await readdir(stage.directory)).some(name=>name.endsWith('.tmp')),false);
  await stage.clear();assert.equal(await resumed.read(keys[0]),null);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('expired staging is removed while recent resumable work remains',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lookout-staging-expiry-'));
 try{
  const old=new SearchStaging(root,'old','run'),fresh=new SearchStaging(root,'fresh','run');
  await old.write(1,'a',{});const key=await fresh.write(1,'b',{kept:true});
  const date=new Date(Date.now()-8*86400000);await utimes(old.directory,date,date);
  await pruneSearchStaging(root);assert.deepEqual(await fresh.read(key),{kept:true});assert.equal((await readdir(root)).length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('fictional direct-search demo distinguishes staged candidates from permanent shortlist rows',async()=>{
 const {searchDemo}=await import('../lib/search/demo.mjs');
 const {backendJobsDemoFixtures}=await import('../lib/backend-jobs-demo.mjs');
 const source=searchDemo().runs.find(run=>run.id==='demo-run-resuming').sources[0];
 assert.equal(source.counts.staged,25);assert.equal(source.counts.saved,0);assert.equal(source.checkpoint.stage,'temporary-staging');
 const job=backendJobsDemoFixtures().jobs.find(job=>job.kind==='search_ats'&&job.status==='completed');
 assert.equal(job.result.pipelineVersion,2);assert.equal(job.result.shortlist.totalRetained,1);
});
