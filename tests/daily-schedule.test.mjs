import test from 'node:test';
import assert from 'node:assert/strict';
import {readDailySchedule} from '../lib/daily-schedule.mjs';
import {validateAutomationSchedule} from '../lib/card-packs.mjs';
import {readGuide} from '../supabase/functions/agent-gateway/guides.mjs';
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

test('evening feedback review reuses the existing routine and preserves custom saved instructions',()=>{
 const defaults=readDailySchedule(null,'America/New_York');
 const evening=defaults.routines.find(routine=>routine.id==='evening');
 assert.equal(defaults.routines.length,4);
 assert.equal(evening.time,'20:00');
 assert.match(evening.description,/new or changed job, networking, and planning feedback/);
 assert.match(evening.description,/Skip feedback inference when nothing changed/);
 const saved={enabled:false,timezone:'UTC',routines:[{id:'evening',title:'My review',description:'My custom instructions',time:'21:30',enabled:false,connectionIds:['owned-connection']}],configVersion:4};
 assert.deepEqual(readDailySchedule(saved),saved);
 assert.match(readDailySchedule({routines:[{id:'evening',time:'22:00',enabled:false}]}).routines[0].description,/connection-schedules/);
});

test('evening feedback guidance is bounded, incremental and owned by the external host',()=>{
 const guide=readGuide('connection-schedules');
 assert.equal(guide.version,3);
 for(const phrase of ['list_recommendation_feedback','at most one page per evening run','With no new changes, skip feedback inference','explicit user directions win','a clear withdraws','Advance the cursor only after','durably saved','do not silently rewrite or reactivate'])assert.ok(guide.instructions.includes(phrase),phrase);
});
