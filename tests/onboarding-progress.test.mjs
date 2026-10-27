import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingProgressKey as key,readOnboardingProgress as read,saveOnboardingProgress as save,clearOnboardingProgress as clear} from '../next-app/lib/onboarding-progress.mjs';
function storage(){const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('refresh resumes navigation, isolates accounts and demo, and reset clears it',()=>{
 const s=storage();save(s,key('alice'),'circles');
 assert.equal(read(s,key('alice')),'circles');
 assert.equal(read(s,key('bob')),'start');
 assert.equal(read(s,key('demo-1')),'start');
 clear(s,key('alice'));assert.equal(read(s,key('alice')),'start');
});
test('transient reveal resumes at preview and invalid or unavailable storage starts safely',()=>{
 const s=storage();save(s,key('alice'),'reveal');assert.equal(read(s,key('alice')),'first-role');
 s.setItem(key('alice'),'obsolete');assert.equal(read(s,key('alice')),'start');
 assert.equal(read(null,key('alice')),'start');assert.equal(save(null,key('alice'),'connect'),false);
 assert.doesNotThrow(()=>clear(null,key('alice')));
 assert.equal(key(null),null);
});
test('fictional demo checkpoints survive refresh and reset epochs start fresh',()=>{
 const s=storage();save(s,key('demo-3'),'connect');
 assert.equal(read(s,key('demo-3')),'connect');
 assert.equal(read(s,key('demo-4')),'start');
 assert.equal(read(s,key('alice')),'start');
});
