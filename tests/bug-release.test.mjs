import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getBugStatus,releaseMarker,issueMarker} from '../supabase/functions/agent-gateway/bug-status.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {signalRelease} from '../scripts/auto-fix-release.mjs';
import {planBackendRelease} from '../scripts/plan-backend-release.mjs';
const repo='wcia013twe/Lookout.job',sha='a'.repeat(40),base='b'.repeat(40);
const issue={number:1,state:'closed',user:{login:'wcia013twe'},labels:[{name:'auto-fix'}]};
const pr={number:7,merged:true,merged_at:'2026-10-23T00:00:00Z',base:{ref:'main'},head:{repo:{full_name:repo}},merge_commit_sha:sha,labels:[{name:'auto-fix'}],body:issueMarker(1)};
const run={id:19,path:'.github/workflows/deploy.yml',head_branch:'main',head_repository:{full_name:repo},event:'workflow_dispatch',head_sha:sha,status:'completed',conclusion:'success',updated_at:'2026-10-23T01:00:00Z',run_attempt:1};
function fixture(overrides={}) {
  const comments=overrides.comments??[{user:{login:'github-actions[bot]'},body:releaseMarker(7,19)}];
  const calls=[];
  const api=async(method,path,body)=>{
    calls.push({method,path,body});
    if(method==='POST'){comments.push({body:body.body,user:{login:'github-actions[bot]'}});return {id:comments.length};}
    if(path.includes('/comments'))return comments;
    if(path.includes('/events'))return overrides.events??[];
    if(path.endsWith('/issues/1'))return overrides.issue??issue;
    if(path.endsWith('/pulls/7'))return overrides.pr??pr;
    if(path.includes('/pulls?'))return [overrides.pr??pr];
    if(path.endsWith('/actions/runs/19'))return overrides.run??run;
    if(path.includes('/compare/'))return {status:overrides.comparison??'identical'};
    throw Error('Unexpected request '+path);
  };
  const fetchImpl=async(url)=>new Response(JSON.stringify(await api('GET',new URL(url).pathname+new URL(url).search)),{status:200});
  return {api,fetchImpl,calls,comments};
}
const options={payload:{issueNumber:1},token:'synthetic',connectionId:'muse',authorize:async()=>({status:200,data:{id:'muse',scopes:['activity:write']}})};

test('Muse gets retry permission only for a verified successful release containing the merged fix',async()=>{
  assert.doesNotThrow(()=>validateRequest({operation:'bugs.status',payload:options.payload}));
  for(const payload of [{issueNumber:0},{issueNumber:1,owner:'other'},{}])assert.throws(()=>validateRequest({operation:'bugs.status',payload}));
  const f=fixture();const result=await getBugStatus({...options,fetchImpl:f.fetchImpl});
  assert.equal(result.data.state,'ready_to_retry');assert.equal(result.data.readyToRetry,true);assert.equal(result.data.releaseId,'19:1:7');
  assert.ok(!JSON.stringify(result).includes(pr.body));
  assert.equal(f.calls.some(c=>c.method!=='GET'),false);
});

test('closed issues, spoofed comments, failed releases, unmerged fixes and stale deploys never authorize retry',async()=>{
  for(const [overrides,state,status] of [
    [{comments:[]},'closed_unverified',200],
    [{comments:[{user:{login:'outsider'},body:releaseMarker(7,19)}]},'closed_unverified',200],
    [{run:{...run,conclusion:'failure'}},'release_failed',200],
    [{pr:{...pr,merged:false}},undefined,503],
    [{comparison:'behind'},undefined,503],
    [{run:{...run,path:'.github/workflows/ci.yml'}},undefined,503],
    [{run:{...run,event:'pull_request'}},undefined,503],
    [{run:{...run,head_repository:{full_name:'outsider/fork'}}},undefined,503],
    [{run:{...run,status:'in_progress'}},undefined,503],
    [{run:{...run,run_attempt:2}},undefined,503],
    [{events:[{event:'reopened',created_at:'2026-10-23T02:00:00Z'}]},'awaiting_release',200],
  ]) {
    const f=fixture(overrides);const r=await getBugStatus({...options,fetchImpl:f.fetchImpl});
    assert.equal(r.status,status);assert.equal(r.data?.state,state);assert.ok(!r.data?.readyToRetry);
  }
});

test('status auth gates prevent GitHub access and return sanitized errors',async()=>{
  for(const args of [{connectionId:'other'},{authorize:async()=>({status:401})},{token:undefined}]) {
    const r=await getBugStatus({...options,...args,fetchImpl:()=>assert.fail('Must not fetch')});assert.ok(r.status>=400);
  }
  const r=await getBugStatus({...options,fetchImpl:async()=>{throw Error('private secret detail');}});
  assert.equal(r.status,503);assert.ok(!JSON.stringify(r).includes('private secret'));
});

test('release workflow posts durable success and failure signals once, without merging or deploying',async()=>{
  for(const conclusion of ['success','failure']) {
    const f=fixture({comments:[],run:{...run,conclusion},issue:{...issue,state:'open'}});
    assert.deepEqual(await signalRelease({api:f.api,repo,event:{workflow_run:{id:19}}}),{signalled:1});
    assert.match(f.comments[0].body,/@wcia013twe/);
    assert.match(f.comments[0].body,conclusion==='success'?/Muse can retry/:/Muse must wait/);
    assert.deepEqual(await signalRelease({api:f.api,repo,event:{workflow_run:{id:19}}}),{signalled:0});
    assert.equal(f.calls.some(c=>c.method==='PUT'||c.path.includes('/dispatches')),false);
    assert.equal(f.calls.some(c=>c.method==='PATCH'&&c.body.state==='closed'),conclusion==='success');
  }
});

test('release signalling ignores fork fixes, undeployed commits and already released PRs',async()=>{
  for(const o of [{pr:{...pr,head:{repo:{full_name:'outsider/fork'}}},comments:[]},{comparison:'behind',comments:[]},{}]) {
    const f=fixture(o);assert.equal((await signalRelease({api:f.api,repo,event:{workflow_run:{id:19}}})).signalled,0);
  }
});

test('backend release planning compares the complete release, requires backend updates and refuses rollback or truncation',async()=>{
  const api=(files,status='ahead',runs=[{...run,head_sha:base}])=>async(_method,path)=>path.includes('/runs?')?{workflow_runs:runs}:{status,files};
  for(const path of ['supabase/migrations/new.sql','supabase/functions/agent-mcp/index.ts','supabase/config.toml']) {
    assert.equal((await planBackendRelease({repo,sha,api:api([{filename:path}])})).backend,true);
  }
  assert.equal((await planBackendRelease({repo,sha,api:api([{filename:'next-app/app/page.tsx'}])})).backend,false);
  assert.equal((await planBackendRelease({repo,sha,api:api([],'ahead',[])})).backend,true);
  await assert.rejects(planBackendRelease({repo,sha,api:api([],'behind')}));
  await assert.rejects(planBackendRelease({repo,sha,api:api(Array.from({length:300},()=>({filename:'x'})))}));
});
