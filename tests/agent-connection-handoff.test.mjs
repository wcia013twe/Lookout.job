import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionClipboardText,AGENT_MCP_URL} from '../next-app/lib/agent-connection-handoff.mjs';
test('default chat handoff never contains the connection token or bearer configuration',()=>{
 const secret='jb_agent_'+'a'.repeat(64);
 for(const token of [secret,'another-private-value','']){
  const text=connectionClipboardText(token);
  assert.ok(text.includes(AGENT_MCP_URL));assert.ok(text.includes('secure credential form'));
  if(token)assert.ok(!text.includes(token));
  assert.ok(!text.includes('Bearer '));assert.ok(!text.includes('jb_agent_'));
 }
 assert.equal(connectionClipboardText(secret),connectionClipboardText('different-secret'));
});
test('only an explicit secure token copy returns the raw credential, without JSON or a Bearer prefix',()=>{
 const secret='jb_agent_'+'b'.repeat(64);
 assert.equal(connectionClipboardText(secret,true),secret);
});
