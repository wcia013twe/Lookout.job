// Offline boundary prototype. Not imported by the runtime or exposed as a route.
import {jwtVerify} from 'jose';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function verifyMcpOAuth(token,{key,issuer,resource,clientId,resolveBinding,now=new Date()}) {
  if(!issuer?.startsWith('https://')||!resource?.startsWith('https://')||!uuid.test(clientId))throw Error('Invalid OAuth configuration');
  const {payload}=await jwtVerify(token,key,{algorithms:['ES256'],issuer,audience:resource,currentDate:now,
    requiredClaims:['sub','exp','iat','session_id','client_id','role','lookout_connection_id']});
  if(payload.aud!==resource||payload.role!=='lookout_mcp_no_database'||payload.client_id!==clientId||
    !uuid.test(payload.sub)||!uuid.test(payload.session_id)||!uuid.test(payload.lookout_connection_id)||
    !Number.isSafeInteger(payload.iat)||payload.iat>Math.floor(now.getTime()/1000))throw Error('Invalid MCP identity');
  // Must re-read authoritative state on every use; no success cache, no JWT-only authority.
  const binding=await resolveBinding(payload);
  if(!binding||binding.connection_id!==payload.lookout_connection_id||binding.resource!==resource||
    !Number.isFinite(Date.parse(binding.expires_at))||Date.parse(binding.expires_at)<=now.getTime()||
    payload.exp>Math.floor(Date.parse(binding.expires_at)/1000))throw Error('Inactive MCP binding');
  return Object.freeze({connectionId:binding.connection_id,sessionId:payload.session_id,clientId,scopes:binding.scopes});
}
