import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { validateRequest, generateToken, hashToken } from './contract.mjs';
import { contextResponse } from './context.mjs';

// Platform JWT verification is disabled because agents use opaque credentials.
// Every request is verified here: Supabase getUser for people; hash + expiry +
// revocation + scope checks in one database transaction for agent operations.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = {
  'Access-Control-Allow-Origin': 'https://wcia013twe.github.io',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond({ error: 'Use POST' }, 405);
  const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return respond({ error: 'Authentication required' }, 401);
  try {
    // Bound request parsing, including clients without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return respond({ error: 'JSON body required' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 262144) { await reader.cancel(); return respond({ error: 'Request too large' }, 413); }
      chunks.push(value);
    }
    const body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const { operation, payload } = validateRequest(JSON.parse(new TextDecoder().decode(body)));
    if (operation.startsWith('connections.')) {
      if (bearer.startsWith('jb_agent_')) return respond({ error: 'Human sign-in required' }, 403);
      const { data: { user }, error } = await admin.auth.getUser(bearer);
      if (error || !user || user.is_anonymous) return respond({ error: 'Sign in required' }, 401);
      const token = operation === 'connections.issue' ? generateToken() : null;
      const { data, error: dbError } = await admin.rpc('manage_agent_connection', {
        owner_id: user.id, operation, payload: {
          ...payload,
          ...(token ? { tokenHash: await hashToken(token) } : {}),
        },
      });
      if (dbError) return respond({ error: 'Connection request rejected' }, 400);
      return respond(token ? { connection: data, token } : { data });
    }
    if (!/^jb_agent_[a-f0-9]{64}$/.test(bearer)) return respond({ error: 'Agent credential required' }, 401);
    const { data, error } = await admin.rpc('agent_dispatch', {
      credential_hash: await hashToken(bearer), operation, payload,
    });
    if (error) {
      const messages: Record<string, [number, string]> = {
        '28000': [401, 'Credential expired, revoked, or invalid'],
        '42501': [403, 'Scope required'],
        '40001': [409, 'Draft changed; fetch current revision'],
        'P0002': [404, 'Owned record not found'],
        '22023': [400, 'Invalid payload'],
      };
      const [status, message] = messages[error.code] ?? [400, 'Operation rejected'];
      return respond({ error: message }, status);
    }
    if (operation === 'resumes.read') {
      let url = data.reference_url;
      if (data.object_path) {
        const { data: signed, error: signingError } = await admin.storage.from('resumes').createSignedUrl(data.object_path, 60);
        if (signingError) return respond({ error: 'Resume file unavailable' }, 404);
        url = signed.signedUrl;
      }
      return respond({ data: { resume: data, url } });
    }
    return respond({ data: contextResponse(operation, data) });
  } catch { return respond({ error: 'Invalid request' }, 400); }
});
