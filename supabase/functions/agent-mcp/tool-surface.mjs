// Presentation only: scopes, validators and execution stay in protocol.mjs.
export const DEFAULT_TOOL_NAMES = new Set([
  'check_context_versions','read_developer_context','read_personal_context','read_guide','discover_toolkit',
  'read_search_context','save_search_document','submit_backend_job','read_backend_jobs','cancel_backend_job',
  'submit_search_leads','publish_batch','read_batch','remove_discover_job',
  'queue_application_job','read_action_inbox','read_application_record','record_application_progress','request_human_action',
  'update_profile_fields','edit_work_experience','save_saved_answer','delete_saved_answer',
  'save_resume_preferences','begin_resume_upload','complete_resume_upload',
  'list_contacts','save_contact','delete_contact','list_company_workspaces','save_company_workspace',
  'read_agent_schedule','save_notification_preferences','read_muse_changes','acknowledge_muse_changes',
  'start_agent_audit_run','append_agent_audit_events','read_agent_audit_run','append_activity',
  'record_search_progress','report_agent_task_result','report_application_failure','report_submission_result',
  'report_bug','get_bug_status',
  // Runtime additions are listed only when registered and authorized.
  'parse_profile_resume','upload_profile_resume','submit_application','submit_application_batch',
]);
export const WORKFLOWS = ['search','applications','profile','network','agent','toolkit','recovery','all'];
const object = (properties,required) => ({type:'object',properties,required,additionalProperties:false});
export const ACCESS_TOOLS = [
  {name:'discover_tools',description:'Discover executable Lookout tools and exact input schemas for a workflow, including supporting steps hidden from tools/list. Only authorized tools installed in this runtime are returned. Use optional exact name lookup for a tool mentioned by a guide; workflow all searches every category. This is discovery, not execution or authorization. Career guides use discover_toolkit and read_guide.',
   inputSchema:object({workflow:{type:'string',enum:WORKFLOWS},name:{type:'string',minLength:1,maxLength:200}},['workflow']),
   annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
  {name:'call_discovered_tool',description:'Call one registered Lookout tool using its exact name and arguments from discover_tools. Uses the same permission, ownership, version and input validation as a direct named call. No new approval or authority; submissions and uncertain outcomes retain their existing rules. Discovery need not be repeated while the schema is retained.',
   inputSchema:object({name:{type:'string',minLength:1,maxLength:200},arguments:{type:'object'}},['name','arguments']),
   annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:true}},
];
export function toolWorkflow(tool) {
  const op=tool.operation;
  if (/^(toolkit\.|artifacts\.|mock\.|learning\.|local\.career\.)/.test(op)) return 'toolkit';
  if (op==='imports.update') return 'applications';
  if (/^(search\.|backend\.jobs\.|imports\.|jobs\.|batches\.|selection\.|preferences\.(targets|profile)\.)/.test(op)) return 'search';
  if (/^(applications\.|drafts\.|approvals\.|submission\.|runner\.|preparation\.|human\.|local\.(inspect|resume|try|submit|submit_batch)$)/.test(op)) return 'applications';
  if (/^(profile\.|answers\.|resumes\.|preferences\.resumes\.|local\.profile_resume$)/.test(op)) return 'profile';
  if (/^(contacts\.|companies\.|company_workspaces\.|outreach\.)/.test(op)) return 'network';
  if (/^(onboarding\.|tasks\.|automation\.|changes\.|quiet\.|notifications\.|preferences\.notifications\.)/.test(op)) return 'agent';
  return 'recovery';
}
export function publicTool({operation,scope,requiredScopes,readOnly,destructive,openWorld,...tool}) {
  return {...tool,annotations:{readOnlyHint:!!readOnly,destructiveHint:!!destructive||tool.name==='prepare_draft',openWorldHint:!!openWorld||['report_bug','get_bug_status'].includes(tool.name)}};
}
export function validAccessArguments(name,args) {
  if (!args || typeof args!=='object' || Array.isArray(args)) return false;
  const schema=ACCESS_TOOLS.find(tool=>tool.name===name)?.inputSchema;
  if (!schema || Object.keys(args).some(key=>!Object.hasOwn(schema.properties,key)) || schema.required.some(key=>!Object.hasOwn(args,key))) return false;
  if (name==='discover_tools' && !WORKFLOWS.includes(args.workflow)) return false;
  if (Object.hasOwn(args,'name') && (typeof args.name!=='string'||!args.name.trim()||args.name.length>200)) return false;
  if (name==='call_discovered_tool' && (!args.arguments||typeof args.arguments!=='object'||Array.isArray(args.arguments))) return false;
  return true;
}
