import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStage, canClaimPack, demoDrops, dropKey, groupPack, packComplete, tierOf } from '../next-app/lib/drop-pack.ts';

test('Next pack pairs tracks by company without losing extra roles or crossing companies', () => {
 const drops=demoDrops('2026-10-14').slice(0,4);
 const extra={...drops[0],title:'Additional role'};
 const groups=groupPack([...drops,extra]);
 assert.equal(groups.length,4);
 assert.deepEqual(groups[0].drops.map(d=>d.type),['FT','Internship']);
 assert.deepEqual(groups.flatMap(g=>g.drops).map(dropKey).sort(),[...drops,extra].map(dropKey).sort());
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
