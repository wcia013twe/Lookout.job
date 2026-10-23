import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStage, canClaimPack, demoDrops, MEGA_DROP_MAX, dropKey, groupPack, packComplete, tierOf } from '../next-app/lib/drop-pack.ts';
import { PACK_TEXTURES, resolvePackStyle, resolvePackTexture, selectPackStyle } from '../next-app/styles/templates/pack-styles.ts';

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
test('pack reveal styles select dynamically and unknown styles fail to the restrained template', () => {
 assert.equal(selectPackStyle(['rare','epic']),'prismatic');
 assert.equal(selectPackStyle(['rare','legendary']),'supernova');
 assert.equal(selectPackStyle(['mythic']),'supernova');
 assert.equal(resolvePackStyle('supernova').motion.finalRevealDuration,1.28);
 assert.equal(resolvePackStyle('unknown').id,'prismatic');
});
test('pack textures expose the original plus five named choices and reject unknown preferences', () => {
 assert.deepEqual(PACK_TEXTURES.map(texture=>texture.id),['base','aurora','solar','ultraviolet','lagoon','spectrum']);
 assert.equal(resolvePackTexture('lagoon').image,'textures/pack-lagoon.jpg');
 assert.equal(resolvePackTexture('unknown').id,'base');
});
