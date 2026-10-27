// Shared browser/Node contract. Parsing produces proposals, never verified facts.
export const RESUME_PARSE_TOOL = {
 name:'parse_profile_resume', operation:'resumes.parse', scope:'profile:write', requiredScopes:['workspace:read','resumes:read'],
 description:'On an explicit user request, send one owned uploaded resume to APILayer for profile extraction. Returns unverified proposed facts and quality warnings, never saves profile changes. Review conflicts and preserve existing history before using update_profile_fields with the returned profile timestamp. For an absent profile (null timestamp), use save_profile_facts with expectedUpdatedAt null. Requires configured Node API and APILayer key; not available on the Edge-only endpoint. Do not send reference links, owner IDs or file paths.',
 inputSchema:{type:'object',additionalProperties:false,required:['resumeId'],properties:{resumeId:{type:'string',format:'uuid'}}},
};
export function validateResumeParse(payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==1||typeof payload.resumeId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.resumeId))throw Error('One uploaded resume ID is required.');
 return payload;
}
