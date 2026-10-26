import test from 'node:test';
import assert from 'node:assert/strict';
import {checkLocalEdge} from '../scripts/check-local-edge.mjs';

test('local edge verifier refuses hosted or ambiguous origins before creating accounts',async()=>{
  for(const url of ['https://project.supabase.co','http://remote.example','http://localhost/path','http://user:secret@localhost','http://127.0.0.1?target=remote']) {
    let called=false;
    await assert.rejects(()=>checkLocalEdge({url,anonKey:'anon',serviceKey:'secret',request:()=>{called=true;}}),/loopback/);
    assert.equal(called,false);
  }
});
