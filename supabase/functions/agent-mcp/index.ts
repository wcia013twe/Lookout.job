import { createHandler } from './protocol.mjs';

// Custom opaque agent credentials are validated by the fixed gateway on every
// request. Platform JWT verification must be false; no service-role key here.
const gatewayUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/agent-gateway';
Deno.serve(createHandler(async (token: string, operation: string, payload: unknown) => {
  const response = await fetch(gatewayUrl, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, payload }),
  });
  const body = await response.json();
  return { status: response.status, data: body.data, error: body.error };
}));
