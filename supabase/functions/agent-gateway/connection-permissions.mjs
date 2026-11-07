// Shared credential permission vocabulary; granting access remains human-only.
export const CONNECTION_SCOPES = ['knowledge:read','knowledge:write','answers:write','resumes:write','network:write','tracking:write','preferences:write','workspace:read','profile:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'];
export const sameScopes=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&[...a].sort().every((s,i)=>s===[...b].sort()[i]);
export function validScopes(value){return Array.isArray(value)&&value.length>0&&value.length<=CONNECTION_SCOPES.length&&new Set(value).size===value.length&&value.every(s=>CONNECTION_SCOPES.includes(s));}
export function validatePermissionEdit(p){
 if(!p||Object.keys(p).some(k=>!['id','scopes','expectedScopes'].includes(k))||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.id||'')||!validScopes(p.scopes)||!validScopes(p.expectedScopes))throw Error('Connection ID, current permissions and a nonempty supported permission selection required');
}
export const PERMISSIONS_HANDOFF_TOOL={name:'open_agent_permissions',operation:'workspace.agent_permissions_handoff',scope:'workspace:read',readOnly:true,description:'Open the signed-in human’s existing agent-connection permissions editor. The person can change access without replacing their token. This tool cannot edit permissions, reveal tokens, grant access or extend expiry.',inputSchema:{type:'object',properties:{},required:[],additionalProperties:false}};
export const permissionsHandoff={humanActionRequired:true,action:'edit_agent_permissions',url:'https://wcia013twe.github.io/codex-automated-job-board/profile/?section=agent#agent-connections',message:'Sign in, find your connection under My Agent, and choose Edit permissions. Save only the access you want. Your existing token and expiry stay the same. Ask the agent to refresh its tools after saving. No permissions have been changed by this tool.'};
export async function permissionHandoff(authorize){
 const result=await authorize();if(result.error)return result;
 if(!result.data?.scopes?.includes('workspace:read'))return {error:{code:'42501'}};
 return {data:structuredClone(permissionsHandoff)};
}
