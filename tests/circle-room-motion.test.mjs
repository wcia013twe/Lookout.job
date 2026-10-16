import test from 'node:test';
import assert from 'node:assert/strict';
import {routines,sampleRoutine,sampleTravel} from '../next-app/app/circles/_components/room-motion.ts';

test('Alfred returns to the application desk station after walking through the aisle',()=>{
 const routine=routines[0];
 assert.equal(routine.task,'type');
 assert.deepEqual(sampleRoutine(routine,0),{...routine.station,mode:'working',direction:1,frame:0,journey:''});
 const outbound=sampleRoutine(routine,20);
 assert.equal(outbound.mode,'walking');assert.ok(outbound.y>routine.station.y);
 assert.equal(sampleRoutine(routine,25).mode,'resting');
 assert.equal(sampleRoutine(routine,32).mode,'walking');
 assert.equal(sampleRoutine(routine,40).mode,'working');
 assert.deepEqual(sampleRoutine(routine,44),sampleRoutine(routine,0));
});
test('every routine stays continuous at walk, rest and station transitions',()=>{
 for(const routine of routines)for(const time of [17,24,29,37,44]){
  const a=sampleRoutine(routine,time-.0001),b=sampleRoutine(routine,time);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.01,`${routine.name} jumps at ${time}`);
 }
});
test('reduced motion presents the station pose throughout the cycle',()=>{
 for(const routine of routines)for(const time of [0,20,25,33,44]){
  const pose=sampleRoutine(routine,time,true);
  assert.equal(pose.mode,'working');assert.equal(pose.x,routine.station.x);assert.equal(pose.y,routine.station.y);
 }
});

test('gather travel reaches its destination continuously and clamps at both ends',()=>{
 const start={x:20,y:40},end={x:50,y:60};
 assert.deepEqual(sampleTravel(start,end,-1),{...start,direction:1});
 assert.deepEqual(sampleTravel(start,end,1),{...end,direction:1});
 assert.deepEqual(sampleTravel(start,end,.5),{x:35,y:50,direction:1});
 assert.equal(sampleTravel(end,start,.5).direction,-1);
});
