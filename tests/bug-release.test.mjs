import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getBugStatus,releaseMarker,issueMarker} from '../supabase/functions/agent-gateway/bug-status.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {signalRelease,linkedIssues} from '../scripts/auto-fix-release.mjs';
const repo='wcia013twe/Lookout.job',sha='a'.repeat(40);
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
    if(path.split('?')[0].endsWith('/pulls/7/files'))return overrides.files??[{filename:'next-app/app/page.tsx'}];
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

test('Pages success cannot signal a backend fix as deployed',async()=>{
  for(const files of [[{filename:'supabase/functions/agent-mcp/index.ts'}],[{filename:'moved.mjs',previous_filename:'supabase/functions/old.mjs'}]]){
    const f=fixture({files});
    const status=await getBugStatus({...options,fetchImpl:f.fetchImpl});
    assert.equal(status.data.state,'backend_release_unverified');
    assert.equal(status.data.readyToRetry,false);
    assert.deepEqual(await signalRelease({api:f.api,repo,event:{workflow_run:{id:19}}}),{signalled:0});
    assert.equal(f.calls.some(c=>c.method!=='GET'),false);
  }
});


test('linkage recognizes all exact markers once and rejects malformed or unsafe numbers',()=>{
  assert.deepEqual(linkedIssues(`${issueMarker(1)} ${issueMarker(2)} ${issueMarker(1)}
    <!-- lookout-auto-fix-issue:0 --> <!-- lookout-auto-fix-issue:01 -->
    <!-- lookout-auto-fix-issue:9007199254740992 --> Refs #3`),[1,2]);
  assert.deepEqual(linkedIssues(null),[]);
});

test('multiple linked issues are validated and delivered independently; backend still fails closed',async()=>{
  for(const backend of [false,true]) {
    const issues=new Map([1,2,3,4].map(n=>[n,{...issue,number:n,state:'open',
      user:{login:n===3?'outsider':'wcia013twe'},labels:n===4?[]:issue.labels}]));
    const comments=new Map([...issues.keys()].map(n=>[n,[]]));
    const writes=[];
    const f=fixture({pr:{...pr,body:[1,2,3,4,2].map(issueMarker).join('\n')},
      files:[{filename:backend?'supabase/functions/agent-mcp/index.ts':'next-app/app/page.tsx'}]});
    const api=async(method,path,body)=>{
      const match=path.match(/\/issues\/(\d+)(?:\/(comments|events))?(?:\?|$)/);
      if(!match)return f.api(method,path,body);
      const n=Number(match[1]);
      if(method==='POST'){writes.push({n,method});comments.get(n).push({body:body.body,user:{login:'github-actions[bot]'}});return {};}
      if(method==='PATCH'){writes.push({n,method});issues.get(n).state=body.state;return {};}
      return match[2]==='comments'?comments.get(n):match[2]==='events'?[]:issues.get(n);
    };
    assert.deepEqual(await signalRelease({api,repo,event:{workflow_run:{id:19}}}),{signalled:backend?0:2});
    assert.deepEqual(writes.filter(w=>w.method==='POST').map(w=>w.n),backend?[]:[1,2]);
    assert.equal(writes.some(w=>w.n===3||w.n===4),false);
    assert.deepEqual(await signalRelease({api,repo,event:{workflow_run:{id:19}}}),{signalled:0});
    assert.equal(comments.get(1).length,backend?0:1);
    assert.equal(comments.get(2).length,backend?0:1);
  }
});

const backendPath='supabase/functions/agent-gateway/bug-status.mjs';
const evidenceSha='b'.repeat(40);
function backendFixture(overrides={}) {
  const files=[{filename:backendPath}];
  const functions=['agent-gateway','agent-mcp'].map((name,i)=>({name,
    id:i?'fe2b7a80-96bb-475d-b281-e05bb1d7fa50':'dfc5f49c-280e-48f5-ad2b-8c013050a1da',version:i?29:33,status:'ACTIVE',verifyJwt:false,
    files:[`supabase/functions/${name}/index.ts`,`supabase/functions/${name}/deno.json`,backendPath].map(path=>({path,gitBlobSha:sha,sha256:'c'.repeat(64)}))}));
  const evidence={schemaVersion:1,status:'verified',provenance:'operator-attested-supabase-source-readback',verification:'point-in-time',operator:'authorized test operator',projectId:'umhqfqzpwmszhcknwtrs',sourceCommit:sha,observedAt:'2026-10-23T00:30:00Z',functions,...overrides.evidence};
  const tree={truncated:false,tree:[...new Set(functions.flatMap(f=>f.files.map(x=>x.path)))].map(path=>({path,type:'blob',sha}))};
  const f=fixture({files,comments:[{user:{login:'github-actions[bot]'},body:releaseMarker(7,19,'success',1,overrides.markerId??evidenceSha)}],...overrides});
  const api=async(method,path,body)=>{
    if(path.includes('/contents/backend/releases/current.json'))return {sha:path.endsWith('ref=main')?(overrides.currentId??evidenceSha):evidenceSha,encoding:'base64',content:Buffer.from(JSON.stringify(evidence)).toString('base64')};
    if(path.includes('/git/trees/'))return path.includes('/trees/main')?(overrides.latestTree??tree):(overrides.tree??tree);
    return f.api(method,path,body);
  };
  return {...f,api,evidence,fetchImpl:async url=>new Response(JSON.stringify(await api('GET',new URL(url).pathname+new URL(url).search)))};
}

test('exact reviewed backend observation plus successful frontend permits a new evidence-bound retry, not closure',async()=>{
  const f=backendFixture();const r=await getBugStatus({...options,fetchImpl:f.fetchImpl});
  assert.equal(r.data.readyToRetry,true);assert.equal(r.data.releaseId,`19:1:7:${evidenceSha}`);
  assert.equal(r.data.backendEvidence.provenance,'operator-attested-supabase-source-readback');
  const again=await getBugStatus({...options,fetchImpl:f.fetchImpl});assert.equal(again.data.releaseId,r.data.releaseId);
  const unsignalled=backendFixture({comments:[],issue:{...issue,state:'open'}});
  assert.deepEqual(await signalRelease({api:unsignalled.api,repo,event:{workflow_run:{id:19}}}),{signalled:1});
  assert.equal(unsignalled.calls.some(c=>c.method==='PATCH'),false);
  assert.match(unsignalled.comments[0].body,/point-in-time operator attestation/);
});

test('backend evidence fails closed for pending/failed, wrong identity/source/hash, superseded and stale release IDs',async()=>{
  for(const o of [
    {evidence:{status:'pending'}},{evidence:{status:'failed'}},{evidence:{provenance:'issue-comment'}},
    {evidence:{projectId:'other'}},{evidence:{functions:[]}},{evidence:{observedAt:'2099-01-01T00:00:00Z'}},
    {currentId:'d'.repeat(40)},{markerId:'d'.repeat(40)},{comparison:'behind'},
    {tree:{truncated:true,tree:[]}},{tree:{tree:[],truncated:false}},{latestTree:{tree:[],truncated:false}},
    {files:[{filename:'supabase/migrations/schema.sql'}]},
  ]){const f=backendFixture(o);const r=await getBugStatus({...options,fetchImpl:f.fetchImpl});assert.equal(r.data?.readyToRetry,false,JSON.stringify(o));assert.equal(r.data?.state,'backend_release_unverified');}
  for(const conclusion of ['failure','cancelled']){
    const f=backendFixture({run:{...run,conclusion}});const r=await getBugStatus({...options,fetchImpl:f.fetchImpl});assert.equal(r.data.readyToRetry,false);assert.equal(r.data.state,'release_failed');
  }
  const f=backendFixture({run:{...run,status:'in_progress'}});assert.equal((await getBugStatus({...options,fetchImpl:f.fetchImpl})).status,503);
});
