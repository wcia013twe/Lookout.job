// Startup contains routing only. Procedures live in named, versioned guides.
import contract from './instructions.json' with {type:'json'};
export const bootstrapInstructions = [
 contract.instructions[0],
 'Supporting tools: discover_tools(workflow or all, exact name), then call_discovered_tool. discover_toolkit finds guides.',
 'Read read_developer_context and relevant read_guide results. Setup: connection-schedules; stop after setup. Change wakes: change-resumption; refresh and resume authorized work. Repair: repair-recovery. For authorized work load agent-audit to record the run. Versions need retained content.',
].join('\n\n');
