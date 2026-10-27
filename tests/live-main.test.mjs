import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {syncMain,publicPreviewEnv} from '../scripts/live-main.mjs';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
test('main preview follows landed commits, flags dependency changes and preserves dirty work',async()=>{
 const root=await mkdtemp(join(tmpdir(),'live-main-test-'));
 const source=join(root,'source'),preview=join(root,'preview');
 try{
  git(root,'init','-b','main',source);git(source,'config','user.name','Fictional Test');git(source,'config','user.email','fictional@example.com');
  await writeFile(join(source,'screen.txt'),'original');git(source,'add','.');git(source,'commit','-m','initial');git(root,'clone',source,preview);
  assert.deepEqual(await syncMain(source,preview),{changed:false,dependencies:false});
  await writeFile(join(source,'screen.txt'),'latest search');git(source,'commit','-am','land UI');
  assert.deepEqual(await syncMain(source,preview),{changed:true,dependencies:false});assert.equal(await readFile(join(preview,'screen.txt'),'utf8'),'latest search');
  await writeFile(join(source,'package-lock.json'),'{}');git(source,'add','.');git(source,'commit','-m','dependencies');
  assert.deepEqual(await syncMain(source,preview),{changed:true,dependencies:true});
  await writeFile(join(preview,'screen.txt'),'unfinished preview edit');
  await writeFile(join(source,'screen.txt'),'next landed change');git(source,'commit','-am','next');
  await assert.rejects(syncMain(source,preview),/local edits/);assert.equal(await readFile(join(preview,'screen.txt'),'utf8'),'unfinished preview edit');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('main preview refuses divergent commits before changing files',async()=>{
 const calls=[];
 await assert.rejects(syncMain('/source','/preview',async(file,args)=>{
  calls.push(args);
  if(args[0]==='branch')return 'main';
  if(args[0]==='rev-parse')return args[1]==='main'?'new':'old';
  if(args[0]==='merge-base')throw Error('not an ancestor');
  return '';
 }),/not an ancestor/);
 assert.equal(calls.some(args=>args[0]==='merge'),false);
});

test('preview carries only the configured public parser origin from source env files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'live-env-test-'));
 try{
  await mkdir(join(root,'next-app'));
  await writeFile(join(root,'.env.local'),'NEXT_PUBLIC_LOOKOUT_API_URL="http://127.0.0.1:8081"\nAPILAYER_API_KEY=private\nOPENAI_API_KEY=private\nGEOIFY_API=fictional-browser-key\n');
  assert.deepEqual(await publicPreviewEnv(root),{NEXT_PUBLIC_LOOKOUT_API_URL:'http://127.0.0.1:8081',NEXT_PUBLIC_GEOAPIFY_API_KEY:'fictional-browser-key'});
  await writeFile(join(root,'next-app/.env.local'),'NEXT_PUBLIC_LOOKOUT_API_URL=http://127.0.0.1:8082\n');
  assert.deepEqual(await publicPreviewEnv(root),{NEXT_PUBLIC_LOOKOUT_API_URL:'http://127.0.0.1:8082',NEXT_PUBLIC_GEOAPIFY_API_KEY:'fictional-browser-key'});
 }finally{await rm(root,{recursive:true,force:true});}
});
