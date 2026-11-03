// The preserved quickstart and watcher guide are the canonical source text.
// Assemble them once for both MCP startup and developer-context reads.
import contract from './instructions.json' with {type:'json'};
import agentPackage from './skills/agent-package.json' with {type:'json'};
const q=contract.quickstart;
export const operatingGuide={
 title:'Lookout workspace operating guide',
 lifecycle:'Read read_developer_context when connecting, retain its guide per connection, and check_context_versions on later work runs. Refresh developer context and tools/list when developerVersion changes, after account change, or if context is lost. Read once per version, not once forever. Detailed contracts are in the same response; task guides are references.',
 sections:[
  {id:'role',title:'Your role and authority',instructions:[q[0],q[2]]},
  {id:'connect',title:'Connect and configure saved schedules',instructions:[q[1]]},
  {id:'first-value',title:'Onboard for the first requested work',instructions:[q[5]]},
  {id:'run',title:'Start every authorized work run',instructions:[q[3],q[4],q[9]]},
  {id:'watch',title:'Set up optional background watching',instructions:[agentPackage.instructions]},
  {id:'workspace',title:'Read, write and preserve workspace state',instructions:[q[6],q[7],q[8]]},
  {id:'search',title:'Execute searches and publish useful results',instructions:[q[10]]},
  {id:'applications',title:'Prepare and handle applications',instructions:[q[12]]},
  {id:'career',title:'Maintain the rest of the workspace',instructions:[q[13]]},
  {id:'recover',title:'Recover, verify and report',instructions:[q[11]]},
 ],
};
