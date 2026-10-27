export const ACTION_INBOX_TOOL = {
 name:'read_action_inbox',operation:'applications.inbox.read',scope:'workspace:read',readOnly:true,
 description:'Read your durable application handoffs and retained resolution history. Pending entries can have a future available_at for stalled submission checks. Use existing exact-version human review/resolve tools; this read never clears a blocker, grants consent, submits or wakes a runner.',
 inputSchema:{type:'object',properties:{state:{type:'string',enum:['pending','resolved','all']},offset:{type:'integer',minimum:0,maximum:100000}},additionalProperties:false}
};
export function validateActionInbox(payload) {
 if(!payload || typeof payload!=='object' || Array.isArray(payload) || Object.keys(payload).some(k=>!['state','offset'].includes(k)) || (payload.state!==undefined&&!['pending','resolved','all'].includes(payload.state)) || (payload.offset!==undefined&&(!Number.isInteger(payload.offset)||payload.offset<0||payload.offset>100000)))throw Error('Expected inbox state and bounded offset');
}
