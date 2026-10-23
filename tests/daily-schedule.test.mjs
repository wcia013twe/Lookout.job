import test from 'node:test';
import assert from 'node:assert/strict';
import {readDailySchedule} from '../lib/daily-schedule.mjs';
import {validateAutomationSchedule} from '../lib/card-packs.mjs';
test('an unsaved schedule offers the four daily defaults in the local time zone',()=>{
 const draft=readDailySchedule(null,'America/New_York');
 assert.equal(draft.timezone,'America/New_York');
 assert.deepEqual(draft.routines.map(r=>[r.title,r.time]),[['Morning sweep','08:00'],['Midday check-in','12:00'],['Afternoon focus','15:00'],['Evening networking','20:00']]);
 assert.doesNotThrow(()=>validateAutomationSchedule({...draft,configVersion:1,routines:draft.routines.map(r=>({...r,sourceIds:[],connectionIds:[]}))}));
});
test('a deliberately emptied saved schedule stays empty and paused',()=>{
 const saved={enabled:false,timezone:'UTC',routines:[],configVersion:3};
 assert.deepEqual(readDailySchedule(saved,'America/New_York'),saved);
});
test('legacy schedule enrichment preserves timing, pause choices, and removed tasks',()=>{
 const result=readDailySchedule({enabled:false,timezone:'UTC',routines:[{id:'morning',time:'10:30',enabled:false}]});
 assert.equal(result.routines.length,1);assert.equal(result.routines[0].title,'Morning sweep');assert.equal(result.routines[0].time,'10:30');assert.equal(result.routines[0].enabled,false);
});
