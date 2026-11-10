#!/usr/bin/env node
// Host-only read-back: credentials never enter grader handoff or receipts.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {read,hash} from './task.mjs';
const {values:v}=parseArgs({options:{root:{type:'string'},'batch-ids':{type:'string'},output:{type:'string'}}});
try{
 const root=path.resolve(v.root),a=read(path.join(root,'account.private.json')),h=read(path.join(root,'grading/handoff.json')),freeze=read(path.join(root,'freeze.json'));
 if(a.status!=='verified'||! /^(?:n02|job01)-pilot-[a-f0-9-]+@example.test$/.test(a.email)||a.apiUrl!=='http://127.0.0.1:54321'||a.mcpUrl!=='http://127.0.0.1:8080/mcp'||freeze.files['account.private.json']!==hash(fs.readFileSync(path.join(root,'account.private.json'),'utf8')))throw Error('Frozen dedicated local account required');
 const r=h.runs.find(r=>r.condition==='lookout');const stages=fs.readdirSync(r.path).filter(n=>/^stage-\d+$/.test(n)&&fs.existsSync(path.join(r.path,n,'after-state.json'))).sort((a,b)=>Number(a.split('-')[1])-Number(b.split('-')[1]));
 if(!stages.length)throw Error('No captured native outcome');
 const snapshot=read(path.join(r.path,stages.at(-1),'after-state.json'));const owned=new Set(snapshot.tables.job_batches.filter(b=>b.user_id===a.userId).map(b=>b.id));
 const ids=read(v['batch-ids']);if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!owned.has(id))||ids.length!==owned.size)throw Error('Explicit batch IDs from final dedicated-account snapshot required');
 const output=path.resolve(v.output),grading=fs.realpathSync(path.join(root,'grading'));if(path.dirname(output)!==grading)throw Error('Write receipt directly in separate grading directory');
 const calls=[],deadline=Date.now()+60000;
 for(const [name,args] of [['read_personal_context',{}],...ids.map(batchId=>['read_batch',{batchId}])]){
  const res=await fetch(a.mcpUrl,{signal:AbortSignal.timeout(Math.max(1,Math.min(30000,deadline-Date.now()))),method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+a.token},body:JSON.stringify({jsonrpc:'2.0',id:calls.length+1,method:'tools/call',params:{name,arguments:args}})});
  let text=await res.text();if(text.trimStart().startsWith('data:'))text=text.split('\n').find(l=>l.startsWith('data: {')).slice(6);
  const body=JSON.parse(text);if(!res.ok||body.error||body.result?.isError)throw Error('Native read-only confirmation failed');
  // Strip signed download links and secret-shaped fields from returned context.
  const scrub=x=>Array.isArray(x)?x.map(scrub):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>! /token|password|secret|signed.?url|download.?url/i.test(k)).map(([k,y])=>[k,scrub(y)])):typeof x==='string'&&(/jb_agent_|[?&]token=/.test(x))?'[REDACTED]':x;
  const result=body.result.structuredContent??JSON.parse(body.result.content.find(c=>c.type==='text').text);
  calls.push({name,arguments:args,result:scrub(result)});
 }
 fs.writeFileSync(output,JSON.stringify({capturedAt:new Date().toISOString(),status:'confirmed',semanticMatchReviewed:false,purpose:'post-run read-only confirmation, excluded from participant timing',handoffHash:hash(h),accountUserId:a.userId,calls},null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({confirmed:true,reads:calls.length}));
}catch(e){
 const root=path.resolve(v.root),output=path.resolve(v.output);
 if(path.dirname(output)===path.join(root,'grading')&&!fs.existsSync(output)){const h=read(path.join(root,'grading/handoff.json'));fs.writeFileSync(output,JSON.stringify({status:'failed',handoffHash:hash(h),capturedAt:new Date().toISOString(),error:'Read-only confirmation failed; inspect host diagnostics separately',errorType:e.name})+'\n',{flag:'wx',mode:0o600});}
 console.error('Read-only confirmation failed; receipt retained');process.exitCode=1;}
