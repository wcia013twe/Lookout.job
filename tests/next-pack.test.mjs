import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceStage, APPLY_NOW_COOLDOWN_MS, applyNowCooldownRemaining, applyNowDrops, applyNowPackStamp, canClaimPack, demoDrops, MEGA_DROP_MAX, dropKey, groupPack, packComplete, tierOf} from '../next-app/lib/drop-pack.ts';

test('Apply Now animation cooldown lasts exactly 24 hours, not until midnight', () => {
 const last=Date.parse('2026-11-12T23:59:00Z');
 assert.equal(APPLY_NOW_COOLDOWN_MS,86400000);
 assert.equal(applyNowCooldownRemaining(undefined,last),0);
 assert.equal(applyNowCooldownRemaining(null,last),0);
 assert.equal(applyNowCooldownRemaining(last,last),86400000);
 assert.equal(applyNowCooldownRemaining(last,last+60000),86340000);
 assert.equal(applyNowCooldownRemaining(last,last+86400000-1),1);
 assert.equal(applyNowCooldownRemaining(last,last+86400000),0);
 assert.equal(applyNowCooldownRemaining(last,last+86400001),0);
});

test('the first-open pack maps only Apply Now recommendations without inventing job facts', () => {
 const role={id:'job-one',priority:'Apply Now',company:'Example Systems',title:'Backend Engineer',employmentType:'FT',discoveredDate:'2026-11-10',location:'Remote',applicationUrl:'https://example.com/jobs/one',whyItFits:'Saved recommendation',searchProfileId:'general',recommendedAt:'2026-11-10T12:00:00Z'};
 assert.deepEqual(applyNowDrops([role,{...role,id:'consider',priority:'Strong Consider'},{...role,id:'skip',priority:'Skip Unless Team Fit'}],Date.parse(role.recommendedAt)),[{
  packId:'job-one',company:role.company,title:role.title,type:'FT',dateSeen:role.discoveredDate,location:role.location,url:role.applicationUrl,note:role.whyItFits,recommendedAt:role.recommendedAt,searchProfileId:'general',status:'added',
 }]);
 assert.deepEqual(applyNowDrops([]),[]);
 const duplicates=applyNowDrops([role,{...role,id:'job-two'}],Date.parse(role.recommendedAt));
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

test('Apply Now packs expire exactly 24 hours after recommendation arrival',()=>{
 const now=Date.parse('2026-11-17T12:00:00Z');
 const role={id:'one',priority:'Apply Now',company:'Example',title:'Engineer',employmentType:'FT',discoveredDate:'2026-11-16',location:'Remote',applicationUrl:'https://example.com',whyItFits:'Fit',recommendedAt:new Date(now-86400000+1).toISOString()};
 assert.equal(applyNowDrops([role],now).length,1);
 assert.equal(applyNowDrops([role],now+1).length,0);
 assert.equal(applyNowDrops([{...role,recommendedAt:undefined},{...role,recommendedAt:'invalid'}],now).length,0);
});
