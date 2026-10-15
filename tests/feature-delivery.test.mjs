import test from 'node:test';
import assert from 'node:assert/strict';
import { publishFeature, startFeature, validateFragment, fragmentName, command } from '../scripts/feature-delivery.mjs';
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


test('publisher refreshes main before pushing and refuses unresolved integration',async()=>{
  const f=fixture();await publishFeature({run:f.run,title:'Feature',bodyFile:'/tmp/body.md'});
  const merge=f.calls.findIndex(c=>c.file==='git'&&c.args[0]==='merge');
  assert.ok(f.calls.some(c=>c.file==='git'&&c.args[0]==='fetch'));
  assert.ok(merge>=0&&merge<f.calls.findIndex(c=>c.args[0]==='push'));
  const conflict=fixture();
  await assert.rejects(publishFeature({run:async(file,args)=>{const result=await conflict.run(file,args);if(args[0]==='merge')throw Error('conflict');return result;},title:'Feature',bodyFile:'/tmp/body.md'}),/Resolve the branch conflict/);
  assert.equal(conflict.calls.some(c=>c.file==='gh'||c.args[0]==='push'),false);
});
test('unfinished generated change notes cannot be published',async()=>{
  const f=fixture();
  await assert.rejects(publishFeature({run:f.run,readFragment:async()=> '# Feature\n<!-- change-fragment: draft -->',title:'Feature',bodyFile:'/tmp/body.md'}),/Complete and commit/);
  assert.ok(f.calls.every(c=>c.file==='git'&&['branch','status'].includes(c.args[0])));
  await validateFragment('codex/feature',async()=> '# Feature\n\n- Fixed a real bug. Validation: targeted regression passed.');
  assert.equal(fragmentName('codex/../../outside'),null);
});
test('new checkouts create unique change-note files and reject their draft templates',async()=>{
  const {mkdir,readFile,rm}=await import('node:fs/promises');
  const {join,dirname}=await import('node:path');
  const created=[];
  try {
    for(let i=0;i<2;i++) {
      let branch;
      const checkout=await startFeature('fragment-fixture',async(file,args)=>{
        if(args[0]==='remote')return 'https://github.com/owner/repo.git';
        if(args[0]==='clone')await mkdir(args.at(-1),{recursive:true});
        if(args[0]==='switch')branch=args.at(-1);
        return '';
      });
      created.push(checkout);
      const note=await readFile(join(checkout,'changes',fragmentName(branch)),'utf8');
      assert.match(note,/change-fragment: draft/);
      await assert.rejects(validateFragment(branch,(path)=>readFile(join(checkout,path),'utf8')),/Complete and commit/);
    }
    assert.notEqual(created[0],created[1]);
  } finally {for(const checkout of created)await rm(dirname(checkout),{recursive:true,force:true});}
});

test('real isolated checkouts integrate independent edits and preserve conflicting work',async()=>{
  const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  for(const conflict of [false,true]) {
    const root=await mkdtemp(join(tmpdir(),'publish-integration-'));
    const remote=join(root,'remote.git'), main=join(root,'main'), task=join(root,'task');
    const git=(cwd,...args)=>command('git',args,cwd);
    try {
      await git(root,'init','--bare','--initial-branch=main',remote);
      await git(root,'clone',remote,main);
      for(const cwd of [main]) {
        await git(cwd,'config','user.name','Publication test');
        await git(cwd,'config','user.email','publication@example.invalid');
      }
      await writeFile(join(main,'shared.txt'),'initial\n');
      await git(main,'add','.');await git(main,'commit','-m','Base');await git(main,'push','origin','main');
      await git(root,'clone',remote,task);
      await git(task,'config','user.name','Publication test');
      await git(task,'config','user.email','publication@example.invalid');
      await git(task,'switch','-c','codex/integration');
      await writeFile(join(task,conflict?'shared.txt':'task.txt'),'task progress\n');
      await git(task,'add','.');await git(task,'commit','-m','Task');
      await writeFile(join(main,'shared.txt'),'published update\n');
      await git(main,'add','.');await git(main,'commit','-m','Main advances');await git(main,'push','origin','main');
      const gh=fixture();
      const publish=()=>publishFeature({title:'Task',bodyFile:'/tmp/body.md',run:(file,args)=>file==='git'?command(file,args,task):gh.run(file,args)});
      if(conflict) {
        await assert.rejects(publish(),/Resolve the branch conflict/);
        assert.equal(gh.calls.length,0);
        assert.match(await git(task,'status','--porcelain'),/UU shared.txt/);
        assert.match(await readFile(join(task,'shared.txt'),'utf8'),/task progress/);
        assert.equal(await git(main,'ls-remote','--heads','origin','codex/integration'),'');
      } else {
        await publish();
        await git(task,'merge-base','--is-ancestor',await git(main,'rev-parse','HEAD'),'HEAD');
        assert.equal(await readFile(join(task,'task.txt'),'utf8'),'task progress\n');
        assert.match(await git(main,'ls-remote','--heads','origin','codex/integration'),/refs\/heads\/codex\/integration/);
      }
    } finally {await rm(root,{recursive:true,force:true});}
  }
});
