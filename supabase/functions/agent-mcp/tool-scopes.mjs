// Additional mandatory scopes enforced by the existing SQL/gateway paths.
// Keep discovery truthful without granting any authority beyond database checks.
const workspaceWrites=[
  'artifacts.fields.update','artifacts.save','artifacts.archive','learning.save',
  'search.document.save','search.run.start','search.progress','search.discoveries.save','search.screening.save','search.run.finish','search.request',
  'drafts.prepare','toolkit.record','toolkit.file.begin','toolkit.file.complete',
  'onboarding.submit_step','tasks.create','tasks.claim','tasks.report_result',
  'preparation.update','preparation.complete','selection.record','outreach.prepare',
];
const knowledgeWrites=['knowledge.propose','knowledge.publish','knowledge.withdraw','knowledge.report','knowledge.cite','knowledge.retract'];
export const ADDITIONAL_TOOL_SCOPES={
  ...Object.fromEntries(workspaceWrites.map(operation=>[operation,['workspace:read']])),
  ...Object.fromEntries(knowledgeWrites.map(operation=>[operation,['knowledge:read']])),
  'resumes.source.replace':['preferences:write'],
  'submission.finish':['workspace:read','approvals:read','resumes:read'],
};
// These conditions are known from the request itself. Row-dependent requirements
// (prepare_application task claims/reports and resume upload completion) remain
// database-enforced because taskId/fileId alone does not identify their kind.
export const CONDITIONAL_TOOL_SCOPES={
  'toolkit.record':[{field:'kind',value:'source_config',scopes:['preferences:write']}],
  'toolkit.file.begin':[{field:'kind',value:'resume',scopes:['profile:write']}],
};
export function requiredToolScopes(tool,payload=undefined) {
  const scopes=[tool.scope,...(tool.requiredScopes||[]),...(ADDITIONAL_TOOL_SCOPES[tool.operation]||[])];
  if(payload!==undefined)for(const rule of CONDITIONAL_TOOL_SCOPES[tool.operation]||[]) {
    if(payload?.[rule.field]===rule.value)scopes.push(...rule.scopes);
  }
  return [...new Set(scopes)];
}
export function completeToolScopes(tool) {
  const requiredScopes=requiredToolScopes(tool).filter(scope=>scope!==tool.scope);
  return requiredScopes.length?{...tool,requiredScopes}:tool;
}
