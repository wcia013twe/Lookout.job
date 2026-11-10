import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('communication design scores distinct outcomes and serializes balanced pairs',()=>{
 const r=spawnSync('python3',['-B','-m','unittest','discover','-s','scripts/communication','-p','test_design.py'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
});
