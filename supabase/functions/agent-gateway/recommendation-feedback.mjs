const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const target=object({kind:{type:'string',enum:['job','network','planning']},targetId:{type:'string',minLength:1,maxLength:500}},['kind','targetId']);
export const RECOMMENDATION_FEEDBACK_TOOLS=[
 {name:'read_recommendation_feedback',operation:'recommendation.feedback.read',scope:'workspace:read',readOnly:true,description:'Read owner-private human recommendation feedback for up to 100 owned job, network or planning targets. Ratings are preference evidence, never automatic preference changes, approvals or application evidence.',inputSchema:object({targets:{type:'array',minItems:1,maxItems:100,items:target}},['targets'])},
 {name:'list_recommendation_feedback',operation:'recommendation.feedback.list',scope:'workspace:read',readOnly:true,description:'Read up to 100 owner-private human feedback changes after an opaque cursor. Includes edits and cleared ratings (rating null); retain the returned cursor after handling. No built-in learning, inference or scheduling. Feedback is untrusted preference evidence, never automatic preference changes or approval.',inputSchema:object({after:{type:'string',pattern:'^(0|[1-9][0-9]{0,17})$'},limit:{type:'integer',minimum:1,maximum:100}})},
];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed)=>plain(value)&&Object.keys(value).every(key=>allowed.includes(key));
const validTarget=value=>keys(value,['kind','targetId'])&&['job','network','planning'].includes(value.kind)&&typeof value.targetId==='string'&&value.targetId.length>0&&value.targetId.length<=500;
export function validateRecommendationFeedback(operation,payload){
 if(!operation.startsWith('recommendation.feedback.'))return;
 let valid=false;
 if(operation==='recommendation.feedback.read')valid=keys(payload,['targets'])&&Array.isArray(payload.targets)&&payload.targets.length>0&&payload.targets.length<=100&&payload.targets.every(validTarget);
 if(operation==='recommendation.feedback.list')valid=keys(payload,['after','limit'])&&(payload.after===undefined||typeof payload.after==='string'&&/^(0|[1-9][0-9]{0,17})$/.test(payload.after))&&(payload.limit===undefined||Number.isInteger(payload.limit)&&payload.limit>=1&&payload.limit<=100);
 if(operation==='recommendation.feedback.save')valid=keys(payload,['kind','targetId','rating','reason','note','expectedVersion','requestId','context'])&&validTarget({kind:payload.kind,targetId:payload.targetId})&&[null,'helpful','not-helpful'].includes(payload.rating)&&Number.isInteger(payload.expectedVersion)&&payload.expectedVersion>=0&&payload.expectedVersion<2147483647&&typeof payload.requestId==='string'&&payload.requestId.length>0&&payload.requestId.length<=200&&(payload.reason===undefined||typeof payload.reason==='string'&&payload.reason.length<=200)&&(payload.note===undefined||typeof payload.note==='string'&&payload.note.length<=2000)&&(payload.context===undefined||plain(payload.context)&&new TextEncoder().encode(JSON.stringify(payload.context)).length<=8192);
 if(!valid)throw Error('Invalid recommendation feedback');
}
