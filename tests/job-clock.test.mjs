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
