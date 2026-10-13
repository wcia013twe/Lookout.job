// Run with JOB_BOARD_AGENT_TOKEN in the local process environment. Never print
// credentials, private tool results, or signed resume URLs.
const url = 'https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp';
const token = process.env.JOB_BOARD_AGENT_TOKEN;
if (!/^jb_agent_[a-f0-9]{64}$/.test(token ?? '')) throw new Error('Set JOB_BOARD_AGENT_TOKEN in your local secret environment');
async function call(method, params) {
  const response = await fetch(url, {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error('MCP HTTP ' + response.status);
  const body = await response.json();
  if (body.error) throw new Error('MCP protocol error ' + body.error.code);
  return body.result;
}
const initialization = await call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'job-board-smoke', version: '1.0.0' } });
if (initialization.protocolVersion !== '2025-11-25') throw new Error('Unexpected protocol negotiation');
const discovered = await call('tools/list');
if (!Array.isArray(discovered.tools)) throw new Error('Invalid tool list');
console.log('Authenticated MCP initialize and scope-filtered discovery passed (' + discovered.tools.length + ' tools).');
