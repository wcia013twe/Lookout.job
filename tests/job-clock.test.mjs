import {execFileSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {virtualDate,readClockOffset} from '../scripts/jobs/virtual_clock.mjs';
test('ticking virtual date preserves explicit dates and native date operations',()=>{
 const RealDate=Date,ClockDate=virtualDate(RealDate,()=>86400);assert.ok(Math.abs(ClockDate.now()-RealDate.now()-86400000)<10);assert.equal(new ClockDate('2026-11-09T00:00:00Z').toISOString(),'2026-11-09T00:00:00.000Z');assert.ok(new ClockDate() instanceof RealDate);assert.equal(ClockDate.parse('2026-11-09'),RealDate.parse('2026-11-09'));assert.equal(ClockDate.UTC(2026,10,9),RealDate.UTC(2026,10,9));assert.equal(new ClockDate(undefined).toString(),'Invalid Date');assert.equal(Date,RealDate);
});
test('clock offset updates are observed without changing monotonic host timing',async()=>{
 const p=fs.mkdtempSync(path.join(os.tmpdir(),'job-clock-'));const file=path.join(p,'time.rc');fs.writeFileSync(file,'+86400.000000\n');const Clock=virtualDate(Date,()=>readClockOffset(file));const first=Clock.now();const start=performance.now();await new Promise(resolve=>setTimeout(resolve,30));assert.ok(Clock.now()>first);assert.ok(performance.now()-start>=15);fs.writeFileSync(file,'+172800.000000\n');assert.ok(Clock.now()-first>86400000);fs.rmSync(p,{recursive:true});
});
test('invalid or missing clock data fails closed',()=>{
 assert.throws(()=>virtualDate(Date,()=>NaN).now(),/Invalid/);const p=fs.mkdtempSync(path.join(os.tmpdir(),'job-clock-'));const file=path.join(p,'clock');for(const text of ['2026-11-16 14:00:00','0','+Infinity','+1e6','+1\ntrailing']){fs.writeFileSync(file,text);assert.throws(()=>readClockOffset(file));}fs.rmSync(p,{recursive:true});assert.throws(()=>readClockOffset(file));
});

test('Node fixture preload reports its ticking clock without changing HTTP body or status',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'job-node-clock-')),file=path.join(root,'time.rc');
 try{
  fs.writeFileSync(file,'+86400.000000\n');
  const script=`import {createServer} from 'node:http';const server=createServer((q,r)=>{r.writeHead(207,{'content-type':'application/json'});r.end(JSON.stringify({nativeBody:'unchanged'}));});server.listen(0,'127.0.0.1',async()=>{try{const start=performance.now();await new Promise(r=>setTimeout(r,20));const response=await fetch('http://127.0.0.1:'+server.address().port);console.log(JSON.stringify({status:response.status,body:await response.json(),clock:response.headers.get('x-job-fixture-node-now'),monotonic:performance.now()-start}));}finally{server.closeAllConnections();server.close();}});`;
  const before=Date.now();const result=JSON.parse(execFileSync(process.execPath,['--import',path.resolve('scripts/jobs/clock_node.mjs'),'--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,LOOKOUT_JOB_CLOCK_FIXTURE:'1',LOOKOUT_JOB_CLOCK_FILE:file},timeout:10000}));
  assert.equal(result.status,207);assert.deepEqual(result.body,{nativeBody:'unchanged'});assert.ok(Math.abs(Date.parse(result.clock)-before-86400000)<3000);assert.ok(result.monotonic>=10);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
