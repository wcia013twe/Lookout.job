import test from 'node:test';
import assert from 'node:assert/strict';
import { publishFeature, startFeature } from '../scripts/feature-delivery.mjs';
function fixture({branch='codex/feature',dirty='',existing=[]}={}) {
  const calls=[];
  const run=async(file,args)=>{
    calls.push({file,args});
    if(args[0]==='branch')return branch;
    if(args[0]==='status')return dirty;
    if(args[0]==='repo')return 'owner/repo';
    if(args[0]==='pr' && args[1]==='list')return JSON.stringify(existing);
    if(args[0]==='pr' && args[1]==='create')return 'https://github.com/owner/repo/pull/12';
    if(args[0]==='pr' && args[1]==='view')return JSON.stringify({number:12,url:'https://github.com/owner/repo/pull/12',isDraft:false});
    return '';
  };
  return {run,calls};
}
test('publisher refuses main and mixed uncommitted files before remote mutations',async()=>{
  for(const options of [{branch:'main'},{dirty:' M unrelated.js'}]) {
    const f=fixture(options);
    await assert.rejects(publishFeature({run:f.run,title:'Feature',bodyFile:'/tmp/body.md'}));
    assert.ok(f.calls.every(c=>c.file==='git' && ['branch','status'].includes(c.args[0])));
  }
});
test('publisher pushes a committed feature, creates its PR, labels and immediately wakes queue',async()=>{
  const f=fixture();
  assert.equal(await publishFeature({run:f.run,title:'Feature',bodyFile:'/tmp/body.md'}),'https://github.com/owner/repo/pull/12');
  assert.deepEqual(f.calls.find(c=>c.args[0]==='push').args,['push','-u','origin','codex/feature']);
  assert.ok(f.calls.some(c=>c.args.includes('--body-file')&&c.args.includes('/tmp/body.md')));
  assert.ok(f.calls.some(c=>c.args.includes('--add-label')&&c.args.includes('merge-ready')));
  assert.deepEqual(f.calls.at(-1).args,['workflow','run','merge-queue.yml','--repo','owner/repo','--ref','main']);
});
test('retry updates the existing draft and queues it without creating duplicate PRs',async()=>{
  const f=fixture({existing:[{number:12,url:'https://github.com/owner/repo/pull/12',isDraft:true}]});
  await publishFeature({run:f.run,title:'Revised feature',bodyFile:'/tmp/body.md'});
  assert.equal(f.calls.filter(c=>c.args[0]==='pr'&&c.args[1]==='create').length,0);
  assert.ok(f.calls.some(c=>c.args[0]==='pr'&&c.args[1]==='ready'));
  assert.ok(f.calls.some(c=>c.args.includes('--title')&&c.args.includes('Revised feature')));
});

test('feature names cannot escape the fresh-checkout directory',async()=>{let called=false;await assert.rejects(startFeature('../shared',async()=>{called=true;}));assert.equal(called,false);});
