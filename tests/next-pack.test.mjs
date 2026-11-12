import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceStage, applyNowDrops, applyNowPackStamp, canClaimPack, demoDrops, MEGA_DROP_MAX, dropKey, groupPack, packComplete, tierOf} from '../next-app/lib/drop-pack.ts';

test('the first-open pack maps only Apply Now recommendations without inventing job facts', () => {
 const role={id:'job-one',priority:'Apply Now',company:'Example Systems',title:'Backend Engineer',employmentType:'FT',discoveredDate:'2026-11-10',location:'Remote',applicationUrl:'https://example.com/jobs/one',whyItFits:'Saved recommendation',searchProfileId:'general'};
 assert.deepEqual(applyNowDrops([role,{...role,id:'consider',priority:'Strong Consider'},{...role,id:'skip',priority:'Skip Unless Team Fit'}]),[{
  packId:'job-one',company:role.company,title:role.title,type:'FT',dateSeen:role.discoveredDate,location:role.location,url:role.applicationUrl,note:role.whyItFits,searchProfileId:'general',status:'added',
 }]);
 assert.deepEqual(applyNowDrops([]),[]);
 const duplicates=applyNowDrops([role,{...role,id:'job-two'}]);
 assert.notEqual(dropKey(duplicates[0]),dropKey(duplicates[1]));
 assert.equal(applyNowPackStamp(role.id),'apply-now:job-one');
 assert.notEqual(applyNowPackStamp(role.id),applyNowPackStamp('job-two'));
});

test('Mega drops group same-company same-day roles up to the cap without losing overflow', () => {
 const base=demoDrops('2026-10-14')[0];
 const drops=Array.from({length:MEGA_DROP_MAX+2},(_,i)=>({...base,title:`Role ${i}`}));
 const otherDay={...base,dateSeen:'2026-10-13'};
 const otherCompany={...base,company:'Google'};
 const skipped={...base,title:'Skipped',status:'skipped'};
 const all=[...drops,otherDay,otherCompany,skipped];
 const groups=groupPack(all);
 assert.deepEqual(groups.map(g=>g.drops.length),[5,2,1,1,1]);
 assert.deepEqual(groups.flatMap(g=>g.drops).map(dropKey).sort(),all.map(dropKey).sort());
 assert.equal(groupPack(demoDrops('2026-10-14'))[0].drops.length,5);
 assert.deepEqual(groupPack([]),[]);
});
test('a mystery reveal starts at common and power-ups stop at the factual tier', () => {
 let stage=advanceStage('mystery','legendary');
 assert.equal(stage,'common');
 for(let i=0;i<10;i++)stage=advanceStage(stage,'legendary');
 assert.equal(stage,'legendary');
 assert.equal(advanceStage('back','rare'),'common');
 assert.equal(advanceStage('common','common'),'common');
});
test('completion requires each paired and single card to reach its own final tier', () => {
 const drops=demoDrops('2026-10-14').slice(0,4);
 const stages=Object.fromEntries(drops.map(d=>[dropKey(d),tierOf(d)]));
 assert.equal(packComplete(drops,stages),true);
 delete stages[dropKey(drops[1])];
 assert.equal(packComplete(drops,stages),false);
 assert.equal(packComplete([],{}),false);
});
test('historical replay and partial reveal never become eligible for today’s XP', () => {
 const drops=demoDrops('2026-10-13').slice(0,4);
 const stages=Object.fromEntries(drops.map(d=>[dropKey(d),tierOf(d)]));
 assert.equal(canClaimPack(drops,stages,'2026-10-13','2026-10-14'),false);
 assert.equal(canClaimPack(drops,{},'2026-10-13','2026-10-13'),false);
 assert.equal(canClaimPack(drops,stages,'2026-10-13','2026-10-13'),true);
});
