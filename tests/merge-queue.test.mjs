import test from 'node:test';
import assert from 'node:assert/strict';
import {queuedPull,runQueue} from '../scripts/merge-queue.mjs';
import {githubApi} from '../scripts/github-api.mjs';
const head='a'.repeat(40),base='b'.repeat(40),changed='c'.repeat(40);
const pr={number:1,state:'open',draft:false,created_at:'2026-10-13',labels:[{name:'merge-ready'}],head:{sha:head,ref:'codex/feature',repo:{full_name:'owner/repo'}},base:{sha:base},requested_reviewers:[],merge_commit_sha:'d'.repeat(40),mergeable_state:'clean'};
test('queue picks oldest ready non-draft PR and never skips a blocker for a newer PR',()=>{
 assert.equal(queuedPull([{...pr,number:2,created_at:'2026-10-14'},pr,{...pr,number:3,created_at:'2026-10-12',draft:true}]).number,1);
});
function fixture(options={}) {
 const calls=[];let refs=0,pulls=0;
 const api=async(method,path,body)=>{
  calls.push({method,path,body});
  if(path.includes('/statuses/'))return {};
  if(path.includes('/pulls?'))return [pr];
  if(path.endsWith('/pulls/1'))return ++pulls>1&&options.headChanged?{...pr,head:{...pr.head,sha:changed}}:options.fork?{...pr,head:{...pr.head,repo:{full_name:'fork/repo'}}}:pr;
  if(path.endsWith('/git/ref/heads/main'))return {object:{sha:++refs>1&&options.baseChanged?changed:base}};
  if(path.includes('/actions/workflows/deploy.yml/runs'))return options.noDeploy?{workflow_runs:[]}:{workflow_runs:[{id:10,head_sha:base,status:options.deployRunning?'in_progress':'completed',conclusion:options.deployFailed?'failure':'success'}]};
  if(path.includes('/actions/workflows/ci.yml/runs'))return {workflow_runs:options.approval?[{id:20,head_sha:head,event:'pull_request',head_repository:{full_name:'owner/repo'},path:'.github/workflows/ci.yml',pull_requests:[{number:options.unrelatedApproval?2:1}]}]:[]};
  if(path.endsWith('/approve'))return {};
  if(path.includes('/compare/'))return {status:options.behind?'behind':'ahead'};
  if(path.endsWith('/update-branch')){if(options.conflict){const error=Error('conflict');error.status=422;throw error;}return {};}
  if(path.includes('/check-runs?'))return {check_runs:[{id:1,name:'CI',status:'completed',conclusion:options.ciFailed?'failure':'success'}]};
  if(path.endsWith('/merge'))return {merged:true};
  if(path.endsWith('/requested_reviewers')||path.endsWith('/dispatches'))return {};
  throw Error('Unexpected fixture API '+method+' '+path);
 };
 return {calls,api};
}
for(const [flag,result] of [['fork','fork'],['deployFailed','deployment-failed'],['behind','updated'],['ciFailed','testing'],['headChanged','changed'],['baseChanged','changed']])test('queue holds safely: '+flag,async()=>{
 const f=fixture({[flag]:true});assert.equal(await runQueue({api:f.api,repo:'owner/repo',log:()=>{}}),result);assert.equal(f.calls.some(call=>call.path.endsWith('/merge')),false);
 if(flag==='behind')assert.ok(f.calls.some(call=>call.path.endsWith('/ci.yml/dispatches')));
});
test('merge pins tested head and explicitly triggers deployment despite GITHUB_TOKEN event suppression',async()=>{
 const f=fixture();assert.equal(await runQueue({api:f.api,repo:'owner/repo',log:()=>{}}),'merged');
 assert.deepEqual(f.calls.find(call=>call.path.endsWith('/merge')).body,{sha:head,merge_method:'squash'});
 assert.ok(f.calls.some(call=>call.path.endsWith('/deploy.yml/dispatches')));
 assert.ok(f.calls.some(call=>call.path.endsWith('/merge-queue.yml/dispatches')));
});
test('API transport rejects external destinations and never exposes credential in errors',async()=>{
 let requested=false;const api=githubApi('secret',async()=>{requested=true;return new Response('{}',{status:403});});
 await assert.rejects(api('GET','//evil.test'),/Relative/);assert.equal(requested,false);
 await assert.rejects(api('GET','/repos/owner/repo'),/rejected \(403\)/);
});

for(const flag of ['deployRunning','noDeploy'])test('queue continues validated merges without waiting for deployment: '+flag,async()=>{const f=fixture({[flag]:true});assert.equal(await runQueue({api:f.api,repo:'owner/repo',log:()=>{}}),'merged');});

test('queue approves only reviewed same-repository CI before attempting a merge',async()=>{const f=fixture({approval:true});assert.equal(await runQueue({api:f.api,repo:'owner/repo',log:()=>{}}),'approving');assert.ok(f.calls.some(c=>c.path.endsWith('/actions/runs/20/approve')));assert.equal(f.calls.some(c=>c.path.endsWith('/merge')),false);});

test('queue never approves unrelated PR workflows or fork workflows',async()=>{for(const options of [{approval:true,unrelatedApproval:true},{approval:true,fork:true}]){const f=fixture(options);await runQueue({api:f.api,repo:'owner/repo',log:()=>{}});assert.equal(f.calls.some(c=>c.path.endsWith('/approve')),false);}});
