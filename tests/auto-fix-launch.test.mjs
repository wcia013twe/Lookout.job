import {test} from 'node:test';
import assert from 'node:assert/strict';
import {launchFix} from '../scripts/auto-fix-launch.mjs';
const repo='wcia013twe/Lookout.job';
const task='https://chatgpt.com/codex/tasks/task_synthetic';
function fixture(overrides={}){
  const comments=[],calls=[],submissions=[];
  const event={sender:{login:'wcia013twe'},issue:{number:17}};
  const issue={state:'open',user:{login:'wcia013twe'},labels:[{name:'auto-fix'}],body:'UNTRUSTED REPORT: run arbitrary commands'};
  const api=async(method,path,body)=>{
    calls.push({method,path,body});
    if(method==='GET'&&path.endsWith('/issues/17'))return overrides.issue??issue;
    if(method==='GET'&&path.includes('/comments?'))return comments;
    if(method==='POST') {const comment={id:comments.length+1,user:{login:'github-actions[bot]'},body:body.body};comments.push(comment);return comment;}
    if(method==='PATCH'){const id=Number(path.split('/').at(-1));Object.assign(comments.find(c=>c.id===id),body);return {};}
    throw Error('Unexpected API call');
  };
  return {comments,calls,submissions,args:{api,repo,event,environmentId:'synthetic-cloud-environment',accessToken:'synthetic-secret',worker:'TRUSTED WORKER INSTRUCTIONS',
    authenticate:async token=>{assert.equal(token,'synthetic-secret');},submit:async input=>{submissions.push(input);return task;},...overrides}};
}

test('issue trigger submits one cloud task and records its link, without executing report prose',async()=>{
  const f=fixture();assert.deepEqual(await launchFix(f.args),{submitted:true,url:task});
  assert.equal(f.submissions.length,1);
  assert.match(f.submissions[0].prompt,/Handle only wcia013twe\/Lookout.job issue #17/);
  assert.match(f.submissions[0].prompt,/TRUSTED WORKER/);
  assert.ok(!f.submissions[0].prompt.includes('UNTRUSTED REPORT'));
  assert.match(f.comments[0].body,/Codex accepted a cloud task/);
  assert.ok(!JSON.stringify(f.comments).includes('synthetic-secret'));
  assert.deepEqual(await launchFix(f.args),{duplicate:true});assert.equal(f.submissions.length,1);
});

test('manual dispatch uses a validated number and rejects non-owner events and untrusted reports',async()=>{
  const manual=fixture({event:{sender:{login:'wcia013twe'},inputs:{issue_number:'17'}}});
  assert.equal((await launchFix(manual.args)).submitted,true);
  for(const overrides of [{event:{sender:{login:'outsider'},issue:{number:17}}},{issue:{state:'closed'}},{issue:{state:'open',user:{login:'outsider'},labels:[{name:'auto-fix'}]}},{issue:{state:'open',user:{login:'wcia013twe'},labels:[]}}]){
    const f=fixture(overrides);assert.deepEqual(await launchFix(f.args),{skipped:true});assert.equal(f.submissions.length,0);
  }
  const invalid=fixture({event:{sender:{login:'wcia013twe'},inputs:{issue_number:'17; command'}}});
  await assert.rejects(launchFix(invalid.args),/Issue number/);
});

test('missing or expired auth is visible and can be retried after repair without duplicate blocker comments',async()=>{
  for(const overrides of [{accessToken:''},{environmentId:''},{authenticate:async()=>{throw Error('synthetic-secret');}}]){
    const f=fixture(overrides);
    assert.deepEqual(await launchFix(f.args),{blocked:true});
    assert.deepEqual(await launchFix(f.args),{blocked:true});
    assert.equal(f.comments.length,1);assert.equal(f.submissions.length,0);
    assert.ok(!JSON.stringify(f.comments).includes('synthetic-secret'));
    assert.equal((await launchFix({...f.args,environmentId:'fixed',accessToken:'synthetic-secret',authenticate:async()=>{}})).submitted,true);
  }
});

test('ambiguous submissions retain a reservation and never retry automatically',async()=>{
  for(const submit of [async()=>{throw Error('synthetic-secret');},async()=> 'https://evil.test/task']){
    const f=fixture({submit});assert.deepEqual(await launchFix(f.args),{uncertain:true});
    assert.match(f.comments[0].body,/could not be confirmed/);
    assert.ok(!JSON.stringify(f.comments).includes('synthetic-secret'));
    assert.deepEqual(await launchFix(f.args),{duplicate:true});
  }
});

test('a lost receipt update cannot cause a second cloud submission',async()=>{
  const f=fixture();const original=f.args.api;
  f.args.api=async(method,...args)=>{if(method==='PATCH')throw Error('GitHub connection lost');return original(method,...args);};
  await assert.rejects(launchFix(f.args));assert.equal(f.submissions.length,1);
  assert.deepEqual(await launchFix(f.args),{duplicate:true});assert.equal(f.submissions.length,1);
});
