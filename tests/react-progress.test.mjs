import test from 'node:test';
import assert from 'node:assert/strict';
import {awardStatus,claimPack,dayStamp,streak} from '../next-app/lib/progress.mjs';
function store(){const state={progress:{xp:0,xpAwards:{},streakDays:[]},drops:{packRewards:{},packStamps:{}}};return {state,get(path){return path.split('.').reduce((v,k)=>v?.[k],state)},set(path,value){const keys=path.split('.'),last=keys.pop();keys.reduce((v,k)=>v[k] ||= {},state)[last]=value;},update(path,fn){this.set(path,fn(this.get(path)));}};}
test('React tracker preserves milestone XP without rewarding repeated or lower statuses',()=>{const s=store();awardStatus(s,'a','Applied');assert.equal(s.state.progress.xp,50);awardStatus(s,'a','Applied');awardStatus(s,'a','New');assert.equal(s.state.progress.xp,50);awardStatus(s,'a','Interview');assert.equal(s.state.progress.xp,250);});
test('React pack shares existing reward keys so replay and migration cannot duplicate XP',()=>{const s=store();assert.equal(claimPack(s),true);assert.equal(claimPack(s),false);assert.equal(s.state.progress.xp,25);s.set(`drops.packRewards.${dayStamp()}`,true);assert.equal(claimPack(s),false);assert.equal(s.state.progress.xp,25);});
test('streak includes yesterday when today has no activity',()=>{assert.equal(streak(['2026-10-11','2026-10-12'],new Date(2026,9,13)),2);});
