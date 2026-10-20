import {withGatewayCors} from './cors.mjs';
import {prepareSearch,searchResponse} from './search.mjs';
import { toolkitFileResponse } from './toolkit.mjs';
import { resumeUploadDispatch } from './resume-upload.mjs';
import { resumeSetupResponse } from './profile-setup.mjs';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { SCOPES, validateRequest, generateToken, hashToken } from './contract.mjs';
import { guideDispatch } from './guides.mjs';
import { contextResponse } from './context.mjs';
import { applicationPolicy } from './application-policy.mjs';
import { submissionDispatch } from './submission-dispatch.mjs';
import { museFeatureDispatch } from './muse-features.mjs';

// Platform JWT verification is disabled because agents use opaque credentials.
// Every request is verified here: Supabase getUser for people; hash + expiry +
// revocation + scope checks in one database transaction for agent operations.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
Deno.serve(withGatewayCors(async request => {
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
    let { operation, payload } = validateRequest(JSON.parse(new TextDecoder().decode(body)));
    if(operation.startsWith('search.')) payload=prepareSearch(operation,payload);
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
      return respond(token ? { connection: data, token } : { data, ...(operation === 'connections.list' ? {supportedScopes: SCOPES} : {}) });
    }
    if (!/^jb_agent_[a-f0-9]{64}$/.test(bearer)) return respond({ error: 'Agent credential required' }, 401);
    if (operation === 'guides.read') {
      const awaitHash = await hashToken(bearer);
      const result = await guideDispatch(payload.id, (op, args) => admin.rpc('agent_dispatch', {credential_hash: awaitHash, operation: op, payload: args}));
      if (result.error) return respond({error: 'Guide access rejected'}, result.error.code === '28000' ? 401 : result.error.code === '42501' ? 403 : result.error.code === 'P0002' ? 404 : 400);
      return respond({data: result.data});
    }
    if (operation.startsWith('outreach.')) {
      const {data,error} = await admin.rpc('agent_outreach_dispatch',{credential_hash:await hashToken(bearer),operation,payload});
      if(error) return respond({error: error.code==='40001'?'Outreach changed; reload before retrying':'Outreach operation rejected'},error.code==='28000'?401:error.code==='42501'?403:error.code==='40001'?409:400);
      return respond({data});
    }
    if (operation.startsWith('resumes.upload.')) {
      const credentialHash=await hashToken(bearer);
      const rpc=(op: string,args: unknown)=>admin.rpc('agent_dispatch',{credential_hash:credentialHash,operation:op,payload:args});
      if(operation==='resumes.upload.begin') {
        const prepared=await rpc(operation,payload);
        if(prepared.error)return respond({error:'Upload intent rejected'},prepared.error.code==='42501'?403:400);
      }
      const result=await resumeUploadDispatch({operation,payload,rpc,storage:admin.storage.from('resumes')});
      if(result.error)return respond({error:'Resume upload rejected'},result.error.code==='42501'?403:result.error.code==='P0002'?404:400);
      return respond({data:result.data});
    }
    if (operation.startsWith('submission.')) {
      const result = await submissionDispatch({operation,payload,credentialHash:await hashToken(bearer),rpc:(name,args)=>admin.rpc(name,args)});
      return respond(result.status===200 ? {data:result.data} : {error:result.error},result.status);
    }
    if (['preparation.planner.read','preparation.budget','preparation.session.complete','preparation.read','preparation.update','preparation.complete','selection.record','selection.read','notifications.read','notifications.ack','applications.record','selection.reconsider','quiet.read','quiet.update','applications.human_action','applications.timeline','applications.milestone'].includes(operation)) {
      const credentialHash = await hashToken(bearer);
      const result = await museFeatureDispatch({operation,payload,
        rpc:(op: string, args: unknown)=>admin.rpc('agent_dispatch',{credential_hash:credentialHash,operation:op,payload:args}),
        loadJob:async (id: string)=>{const {data}=await admin.from('jobs').select('id,employer').eq('id',id).maybeSingle();return data;},
      });
      if(result.error) {
        const code=result.error.code;
        return respond({error:code==='28000'?'Credential expired, revoked, or invalid':code==='40001'?'Record or settings changed; reload before saving':code==='42501'?'Scope required':code==='P0002'?'Owned record not found':'Operation rejected'},code==='28000'?401:code==='40001'?409:code==='42501'?403:code==='P0002'?404:400);
      }
      return respond({data:result.data});
    }
    const policyRequest = operation === 'applications.policy';
    const { data, error } = await admin.rpc('agent_dispatch', {
      credential_hash: await hashToken(bearer), operation: policyRequest ? 'context.personal' : operation, payload: policyRequest ? {} : payload,
    });
    if (error) {
      const messages: Record<string, [number, string]> = {
        '28000': [401, 'Credential expired, revoked, or invalid'],
        '42501': [403, 'Scope required'],
        '40001': [409, 'Record or settings changed; reload current context'],
        '40P01': [409, 'Concurrent edit; reload current context'],
        'P0002': [404, 'Owned record not found'],
        '22023': [400, 'Invalid payload'],
      };
      const [status, message] = messages[error.code] ?? [400, 'Operation rejected'];
      return respond({ error: message }, status);
    }
    if (policyRequest) {
      const { data: job, error: jobError } = await admin.from('jobs').select('id,employer').eq('id', payload.jobId).maybeSingle();
      if (jobError || !job) return respond({ error: 'Job not found' }, 404);
      return respond({ data: { jobId: job.id, personalVersion: data.personalVersion,
        ...applicationPolicy({ preferences: data.settings.preferences, job: job.employer }),
        execution: { automaticSubmission: 'supported-greenhouse-native-forms', bundledRunnerRequiresApproval: false, importantMatchesRequireApproval: true } } });
    }
    if (['resumes.begin_upload','resumes.complete_upload'].includes(operation)) {
      try {
        return respond({data:await resumeSetupResponse({operation,data,storage:admin.storage.from('resumes'),rpc:(name,args)=>admin.rpc(name,args),credentialHash:await hashToken(bearer)})});
      } catch { return respond({error:'Resume upload or verification incomplete; retry the same upload'},400); }
    }
    if (['toolkit.file.begin','toolkit.file.complete','toolkit.file.read'].includes(operation)) {
      return respond({data:await toolkitFileResponse({operation,data,storage:admin.storage.from('resumes'),rpc:(name,args)=>admin.rpc(name,args),credentialHash:await hashToken(bearer)})});
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
    return respond({ data: operation.startsWith('search.') ? searchResponse(operation,data) : contextResponse(operation, data) });
  } catch { return respond({ error: 'Invalid request' }, 400); }
}));
