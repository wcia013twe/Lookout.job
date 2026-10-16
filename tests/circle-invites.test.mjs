import test from 'node:test';
import assert from 'node:assert/strict';
import {activeCircleInvites,createCircleInviteOnce} from '../next-app/lib/circle-invites.mjs';
const now=Date.parse('2026-10-16T12:00:00Z');
const active={id:'active',expires_at:'2026-10-23T12:00:00Z'};
test('Circle invite creation coalesces rapid clicks and reuses an active invite',async()=>{
 let calls=0,finish;const created=new Promise(resolve=>{finish=resolve;});const create=createCircleInviteOnce();
 const run=()=>{calls++;return created;};
 const requests=[create([],run,now),create([],run,now),create([],run,now)];
 await Promise.resolve();assert.equal(calls,1);assert.equal(requests[0],requests[1]);finish();await Promise.all(requests);
 await create([active],run,now);assert.equal(calls,1);
 assert.deepEqual(activeCircleInvites([active,{id:'expired',expires_at:'2026-10-15T12:00:00Z'},{...active,id:'revoked',revoked_at:'2026-10-16T11:00:00Z'}],now),[active]);
});
test('expired or revoked invites allow a new invite, and failures release the click guard',async()=>{
 const create=createCircleInviteOnce();let calls=0;
 await assert.rejects(create([],async()=>{calls++;throw Error('network failure');},now),/network failure/);
 await create([{...active,revoked_at:'2026-10-16T11:00:00Z'}],async()=>{calls++;},now);
 await create([{...active,expires_at:'2026-10-15T00:00:00Z'}],async()=>{calls++;},now);
 assert.equal(calls,3);
});
