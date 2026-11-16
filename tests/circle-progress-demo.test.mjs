import test from 'node:test';
import assert from 'node:assert/strict';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';

test('fictional progress consent is explicit, revisioned, replay-safe and resettable',()=>{
 const demo=createCircleKnowledgeDemo(),circleId='demo-circle';
 const read=()=>demo.action('circles.read',{circleId});
 assert.equal(read().progressSettings.shared,false);
 assert.equal(read().members.find(m=>m.self).progress,null);
 assert.deepEqual(read().members.find(m=>m.id==='demo-peer').progress,{careerStage:'interviewing',applications:3,interviews:1});
 const choice={circleId,shared:true,careerStage:'exploring',expectedRevision:0,eventKey:'consent'};
 assert.deepEqual(demo.action('circles.progress',choice),{revision:1});
 assert.deepEqual(demo.action('circles.progress',choice),{revision:1});
 assert.deepEqual(read().members.find(m=>m.self).progress,{careerStage:'exploring',applications:0,interviews:0});
 assert.throws(()=>demo.action('circles.progress',{...choice,eventKey:'stale'}),/changed/);
 assert.throws(()=>demo.action('circles.progress',{...choice,eventKey:'invalid',expectedRevision:1,careerStage:'new_grad'}),/Invalid/);
 demo.action('circles.progress',{circleId,shared:false,careerStage:null,expectedRevision:1,eventKey:'off'});
 assert.equal(read().members.find(m=>m.self).progress,null);
 assert.throws(()=>demo.action('circles.progress',choice),/changed/);
 assert.equal(createCircleKnowledgeDemo().action('circles.read',{circleId}).progressSettings.shared,false);
});
