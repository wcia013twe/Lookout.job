import {PROFILE_RECORDS} from './write-schemas.mjs';
const properties=Object.fromEntries(PROFILE_RECORDS.workExperience.map(key=>[key,key==='current'?{type:'boolean'}:{type:'string',maxLength:20000}]));
export const WORK_EXPERIENCE_TOOL={name:'edit_work_experience',operation:'profile.work_experience.edit',scope:'profile:write',
 description:'Add, update or remove one work-history entry without replacing the section. Read the current profile and its updated_at first. For update/remove, entryIndex is the zero-based position in that exact profile version. Add appends fields; update merges only supplied fields, preserving every other field/entry. Remove requires an explicit user request. Stale versions reject, including retries of successful adds/removals: read back before any retry. Facts must be user-provided or source-backed. Changes clear profile verification; no approval, answer reuse or submission permission is granted. Use full-array imports only for explicit section replacement.',
 inputSchema:{type:'object',additionalProperties:false,required:['action','expectedUpdatedAt'],properties:{
  action:{type:'string',enum:['add','update','remove']},
  expectedUpdatedAt:{type:'string',format:'date-time',description:'Exact updated_at from the current owned profile.'},
  entryIndex:{type:'integer',minimum:0,maximum:49},
  fields:{type:'object',additionalProperties:false,minProperties:1,properties},
 }}};
export function validateWorkExperience(payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!Object.hasOwn(WORK_EXPERIENCE_TOOL.inputSchema.properties,k))||!['add','update','remove'].includes(payload.action)||typeof payload.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(payload.expectedUpdatedAt)))throw Error('Work-history action and current profile timestamp required');
 const {action,entryIndex,fields}=payload;
 if(action==='add'?entryIndex!==undefined:!Number.isInteger(entryIndex)||entryIndex<0||entryIndex>49)throw Error('Use the entry position from the current profile for update/remove only');
 if(action==='remove') {if(fields!==undefined)throw Error('Remove accepts no replacement fields');return true;}
 if(!fields||typeof fields!=='object'||Array.isArray(fields)||!Object.keys(fields).length||Object.entries(fields).some(([key,value])=>!Object.hasOwn(properties,key)||(key==='current'?typeof value!=='boolean':typeof value!=='string'||value.length>20000))||JSON.stringify(payload).length>200000)throw Error('Only supported work-history fields are editable');
 if(action==='add'&&!Object.entries(fields).some(([key,value])=>key!=='current'&&value.trim()))throw Error('An added entry needs source-backed work-history details');
 return true;
}
// Used only by the detached fictional demo. Account writes use the SQL function.
export function editedWorkExperience(history,payload) {
 validateWorkExperience(payload);
 if(!Array.isArray(history)||history.length>50)throw Error('Invalid existing work history');
 if(payload.action==='add') {if(history.length===50)throw Error('Work-history limit reached');return [...history,structuredClone(payload.fields)];}
 if(payload.entryIndex>=history.length)throw Error('Work-history entry not found');
 return history.flatMap((entry,index)=>index!==payload.entryIndex?[structuredClone(entry)]:payload.action==='remove'?[]:[{...structuredClone(entry),...payload.fields}]);
}
