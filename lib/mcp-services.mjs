// Domain ownership and execution location are separate: most existing services
// remain in the gateway while the Node API hosts the shared MCP transport.
const service=(owner,handler,execution)=>Object.freeze({owner,handler,execution});
export const MCP_SERVICES=Object.freeze({
  interviewIntelligence:service('permitted posting discussions','credential-rpc','immediate'),
  profileFields:service('private profile field updates','credential-rpc','immediate'),
  resumeParsing:service('private resume extraction','node-parser','immediate'),
  backendJobs:service('backend execution','queue-rpc','worker'),
  guides:service('versioned skill library','guide','immediate'),
  credentials:service('connection authentication','credential-rpc','immediate'),
  identity:service('human connection management','edge','human-only'),
  context:service('private career context','edge','immediate'),
  searchPipeline:service('verified discovery intake and profile screening','node','bounded-service'),
  search:service('discovery records and checkpoints','edge','agent-executed'),
  inbox:service('external agent task inbox','edge','agent-executed'),
  catalog:service('catalog and private batches','edge','immediate'),
  documents:service('private documents and learning resources','edge','immediate'),
  toolkit:service('toolkit evidence and generated document storage','edge','immediate'),
  network:service('company, contact and outreach records','edge','immediate'),
  knowledge:service('Circle knowledge and consent','edge','immediate'),
  tracker:service('application records and milestones','edge','immediate'),
  planning:service('preparation plans and reported progress','edge','immediate'),
  delivery:service('delivery preferences and acknowledgments','edge','policy-only'),
  submissions:service('guarded submission transitions and receipts','edge','runner-executed'),
  approvals:service('human approval records','edge','read-only'),
  handoff:service('human action handoff','edge','human-only'),
});
const prefixes=Object.freeze({
  changes:'context',imports:'catalog',workspace:'context',brief:'context',profile:'context',company_workspaces:'network',contacts:'network',artifacts:'documents',learning:'documents',search:'search',toolkit:'toolkit',circles:'knowledge',knowledge:'knowledge',onboarding:'inbox',tasks:'inbox',preferences:'context',resumes:'documents',companies:'network',applications:'tracker',answers:'context',jobs:'catalog',batches:'catalog',leaderboard:'tracker',selection:'tracker',human:'handoff',guides:'guides',quiet:'delivery',preparation:'planning',notifications:'delivery',outreach:'network',submission:'submissions',runner:'submissions',context:'context',drafts:'tracker',activity:'tracker',approvals:'approvals',connections:'identity',
});
export function operationService(operation){
  if(operation==='knowledge.interview')return MCP_SERVICES.interviewIntelligence;
  if(['search.source.leads','search.leads.submit','search.discoveries.screen'].includes(operation))return MCP_SERVICES.searchPipeline;
  if(operation==='profile.work_experience.edit')return MCP_SERVICES.context;
  if(operation==='profile.fields.update')return MCP_SERVICES.profileFields;
  if(operation==='resumes.parse')return MCP_SERVICES.resumeParsing;
  if(operation==='credentials.verify')return MCP_SERVICES.credentials;
  if(operation==='workspace.reset_handoff'||operation==='applications.human_action')return MCP_SERVICES.handoff;
  if(operation.startsWith('backend.jobs.'))return MCP_SERVICES.backendJobs;
  const id=prefixes[operation.split('.')[0]];
  return id?MCP_SERVICES[id]:null;
}
