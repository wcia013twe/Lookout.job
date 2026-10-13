import { createHandler } from '../supabase/functions/agent-mcp/protocol.mjs';
import { createGatewayClient } from './gateway-client.mjs';
import { LOCAL_TOOLS, createLocalRuntime, createBrowserProvider } from './runtime.mjs';
import { pathToFileURL } from 'node:url';

// Reuse the authenticated data protocol over newline-delimited stdio. Serial
// processing prevents two applications from sharing/mutating the browser page.
export async function serveStdio({ input, output, token, runtime }) {
  const handler = createHandler(runtime.forward, [], LOCAL_TOOLS);
  let pending = Buffer.alloc(0);
  for await (const chunk of input) {
    pending = Buffer.concat([pending, Buffer.from(chunk)]);
    while (pending.includes(10)) {
      const end = pending.indexOf(10), line = pending.subarray(0, end);
      pending = pending.subarray(end + 1);
      if (line.length > 262144) throw new Error('MCP request too large');
      if (!line.length) continue;
      const response = await handler(new Request('http://localhost/mcp', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: line,
      }));
      if (response.status !== 202) output.write(await response.text() + '\n');
    }
    if (pending.length > 262144) throw new Error('MCP request too large');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let runtime;
  try {
    const token = process.env.JOB_BOARD_AGENT_TOKEN;
    const gateway = createGatewayClient({ token });
    const browser = createBrowserProvider();
    runtime = createLocalRuntime({ gateway, ...browser });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.close(); process.exit(0); });
    await serveStdio({ input: process.stdin, output: process.stdout, token, runtime });
  } catch { process.stderr.write('Job board runner stopped. Check private credential, dependencies and MCP configuration.\n'); process.exitCode = 1; }
  finally { await runtime?.close(); }
}
