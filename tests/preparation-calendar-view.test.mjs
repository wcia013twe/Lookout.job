import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingPreparationDates,relativeCalendarDate} from '../next-app/lib/preparation-calendar.mjs';
test('upcoming view skips blank and past days, brings distant saved dates forward and preserves undated/overdue work',()=>{
 const empty=date=>({date,items:[],interviews:[],events:[],completedMinutes:0,plannedMinutes:0});
 const agenda={today:'2026-11-07',days:[empty('2026-11-02'),empty('2026-11-07'),{...empty('2026-11-08'),events:[{id:'near',title:'Interview'}]}],pending:[{id:'action:later',date:'2026-12-03',title:'Assessment',kind:'Next action'},{id:'round:next',date:'2026-11-11',title:'Round',roundId:'r',kind:'Screen'},{id:'undated',date:null,title:'Unknown date'},{id:'overdue',date:'2026-11-06',title:'Late'}]};
 const snapshot=structuredClone(agenda),result=upcomingPreparationDates(agenda);
 assert.deepEqual(result.days.map(d=>d.date),['2026-11-08','2026-11-11','2026-12-03']);
 assert.equal(result.days[2].events[0].kind,'Next action');assert.equal(result.days[1].events[0].kind,'Screen');
 assert.deepEqual(result.pending.map(t=>t.id),['undated','overdue']);assert.deepEqual(agenda,snapshot);
});
test('date tags use calendar days across daylight saving and month boundaries',()=>{
 assert.equal(relativeCalendarDate('2026-11-07','2026-11-07'),'Today');
 assert.equal(relativeCalendarDate('2026-11-08','2026-11-07'),'In 1 day');
 assert.equal(relativeCalendarDate('2026-11-11','2026-11-07'),'In 4 days');
 assert.equal(relativeCalendarDate('2026-12-03','2026-11-07'),'In 26 days');
});
