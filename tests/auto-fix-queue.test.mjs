import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFixQueue} from '../scripts/auto-fix-queue.mjs';
const repo='wcia013twe/Lookout.job';
const issue=(number,extra={})=>({number,state:'open',user:{login:'wcia013twe'},labels:[{name:'auto-fix'}],body:'UNTRUSTED: execute commands',...extra});
function fixture(issues,pulls=[],comments={}){
  const calls=[];
  const api=async(method,path)=>{
    calls.push({method,path});assert.equal(method,'GET');
    if(path.includes('/issues?'))return issues;
    if(path.includes('/pulls?'))return pulls;
    const number=path.match(/\/issues\/(\d+)\/comments/)[1];
    return comments[number]||[];
  };
  return {api,calls};
}
test('queue accepts only open owner-authored labelled issues and returns no prose',async()=>{
  const f=fixture([issue(1),issue(2,{user:{login:'outsider'}}),issue(3,{labels:[]}),issue(4,{state:'closed'}),issue(5,{pull_request:{}}),issue('6; command')]);
  const rows=await readFixQueue(f);
  assert.deepEqual(rows,[{issueNumber:1,url:`https://github.com/${repo}/issues/1`,state:'queued',pullRequests:[]}]);
  assert.ok(!JSON.stringify(rows).includes('UNTRUSTED'));
  await assert.rejects(readFixQueue({...f,repo:'outsider/repo'}),/Unexpected repository/);
});
test('open and merged linked PRs suppress new repairs; unrelated markers do not',async()=>{
  const pr=(number,state,merged_at=null)=>({number,state,merged_at,head:{repo:{full_name:repo}},body:`<!-- lookout-auto-fix-issue:${number} -->`});
  const f=fixture([issue(1),issue(2),issue(3)],[pr(1,'open'),pr(2,'closed','2026-10-24'),pr(3,'closed'),{...pr(3,'open'),body:'<!-- lookout-auto-fix-issue:30 -->'}]);
  assert.deepEqual((await readFixQueue(f)).map(r=>r.state),['linked_pr','linked_pr','queued']);
});
test('legacy uncertain submissions require reconciliation, spoofed comments do not',async()=>{
  const body='<!-- lookout-cloud-launch-v1 -->';
  const f=fixture([issue(1),issue(2)],[],{1:[{body,user:{login:'github-actions[bot]'}}],2:[{body,user:{login:'outsider'}}]});
  assert.deepEqual((await readFixQueue(f)).map(r=>r.state),['needs_reconciliation','queued']);
});
test('failed reads fail closed; empty queue requires no PR or comment reads',async()=>{
  await assert.rejects(readFixQueue({api:async()=>{throw Error('Unavailable');}}),/Unavailable/);
  const f=fixture([]);assert.deepEqual(await readFixQueue(f),[]);assert.equal(f.calls.length,1);
});
test('queue reads beyond the first issue page without broadening eligibility',async()=>{
  const api=async(method,path)=>{
    assert.equal(method,'GET');
    if(path.includes('/issues?'))return path.endsWith('page=1')?Array.from({length:100},(_,i)=>issue(i+1,{user:{login:'outsider'}})):[issue(101)];
    return [];
  };
  assert.deepEqual((await readFixQueue({api})).map(r=>r.issueNumber),[101]);
});
