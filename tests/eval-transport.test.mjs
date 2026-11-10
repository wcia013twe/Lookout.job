import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('shared benchmark transport preserves case routing, isolation and lifecycle',()=>{
 const result=spawnSync('python3',['-B','-m','unittest','discover','-s','scripts/evals','-p','test_workspace_transport.py'],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr||result.error?.message);
});
