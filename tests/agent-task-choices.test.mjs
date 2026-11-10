import test from 'node:test';
import assert from 'node:assert/strict';
import {batchPublishingIssue,taskConnectionChoices} from '../lib/agent-connections.mjs';
import {demoPackConnections} from '../lib/card-pack-demo.mjs';
const now=Date.parse('2026-11-10T12:00:00Z');
const active={id:'active',name:'Muse',scopes:['batches:write'],expires_at:'2099-01-01T00:00:00Z'};
test('task picker hides obsolete/unusable connections without mutating history',()=>{
 const revoked={...active,id:'revoked',revoked_at:'2026-01-01T00:00:00Z'};
 const expired={...active,id:'expired',expires_at:'2020-01-01T00:00:00Z'};
 const readOnly={...active,id:'reader',scopes:['workspace:read']};
 const invalid={...active,id:'invalid',expires_at:'invalid'};
 const connections=[active,revoked,expired,readOnly,invalid];
 assert.deepEqual(taskConnectionChoices(connections,[],now),[active]);
 assert.equal(connections.length,5);
 assert.equal(batchPublishingIssue(revoked,now),'Revoked');
 assert.equal(batchPublishingIssue(expired,now),'Expired');
 assert.equal(batchPublishingIssue(readOnly,now),'Batch access required');
 assert.equal(batchPublishingIssue(invalid,now),'Expired');
 assert.deepEqual(taskConnectionChoices(connections,['revoked','reader'],now),[active,revoked,readOnly]);
 assert.deepEqual(taskConnectionChoices([revoked,expired],[],now),[]);
});
test('detached demo includes retired history but offers only the active agent',()=>{
 assert.equal(demoPackConnections.length,3);
 assert.deepEqual(taskConnectionChoices(demoPackConnections,[],now).map(c=>c.name),['Personal agent (demo)']);
});
