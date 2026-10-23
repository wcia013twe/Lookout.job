// Narrow partial edits. Arrays and supplied nested values replace that whole field.
import { profileFactsSchema } from './write-schemas.mjs';
import { ARTIFACT_TOOLS } from './artifacts.mjs';
const text={type:'string',maxLength:20000};
const fields=names=>Object.fromEntries(names.split(' ').map(k=>[k,text]));
const definitions=[
 ['update_profile_fields','profile.fields.update','profile:write','expectedUpdatedAt',profileFactsSchema.properties],
 ['update_company_workspace_fields','company_workspaces.fields.update','network:write','expectedRevision',{
  ...fields('name website priority interest targetTeams concerns research nextAction followUpDate'),
  sources:{type:'array',maxItems:30},contactIds:{type:'array',maxItems:1000},applicationIds:{type:'array',maxItems:1000},archived:{type:'boolean'}}],
 ['update_contact_fields','contacts.fields.update','network:write','expectedRevision',{
  ...fields('company contact name title role contactType linkedin email source sourceUrl status subject message notes followUpDate jobUrl employmentType link evidence whyThem ask followUp relationship location'),tags:{type:'array',maxItems:100}}],
 ['update_artifact_fields','artifacts.fields.update','drafts:write','expectedVersion',Object.fromEntries(Object.entries(ARTIFACT_TOOLS.find(t=>t.operation==='artifacts.save').inputSchema.properties).filter(([k])=>['title','purpose','body','sources','links','materials','preparedFor','weekOf','company'].includes(k)))],
];
export const FIELD_UPDATE_TOOLS=definitions.map(([name,operation,scope,version,properties])=>({name,operation,scope,
 description:'Edit only named fields on an existing owned record. Read current state first. Unspecified fields remain unchanged; supplied arrays/nested values replace that entire field, not individual items. Supply the exact current version; stale writes reject. No creation, approval, verification, sending or submission. Freeform text can contain agent analysis, clearly labeled with evidence and unknowns; profile facts must be source-backed. Read current state after an uncertain response before retrying.',
 inputSchema:{type:'object',additionalProperties:false,required:[...(version==='expectedUpdatedAt'?[]:['id']),version,'fields'],properties:{
 ...(version==='expectedUpdatedAt'?{}:{id:{type:'string',minLength:1,maxLength:200}}),
 [version]:version==='expectedUpdatedAt'?{type:'string',format:'date-time'}:{type:'integer',minimum:version==='expectedVersion'?1:0,maximum:2147483646},
 fields:{type:'object',additionalProperties:false,minProperties:1,properties}}}}));
function check(value,schema) {
 if(schema.type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>Object.hasOwn(schema.properties,k)&&check(value[k],schema.properties[k]));
 if(schema.type==='array')return Array.isArray(value)&&value.length<=(schema.maxItems??1000)&&(!schema.items||value.every(v=>check(v,schema.items)));
 if(schema.type==='integer')return Number.isSafeInteger(value)&&value>=(schema.minimum??Number.MIN_SAFE_INTEGER)&&value<=(schema.maximum??Number.MAX_SAFE_INTEGER);
 return typeof value===schema.type&&(schema.type!=='string'||value.length<=(schema.maxLength??20000)&&value.length>=(schema.minLength??0));
}
export function validateFieldUpdate(operation,payload) {
 const tool=FIELD_UPDATE_TOOLS.find(t=>t.operation===operation);if(!tool)return false;
 const s=tool.inputSchema;
 if(!check(payload,s)||s.required.some(k=>!Object.hasOwn(payload,k))||!Object.keys(payload.fields).length||JSON.stringify(payload).length>200000)throw Error('Named editable fields and current version required');
 if(operation==='profile.fields.update'&&!Number.isFinite(Date.parse(payload.expectedUpdatedAt)))throw Error('Current profile timestamp required');
 if(operation==='artifacts.fields.update'&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.id))throw Error('Artifact UUID required');
 return true;
}
