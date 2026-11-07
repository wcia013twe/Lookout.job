// Startup contains routing only. Procedures live in named, versioned guides.
import contract from './instructions.json' with {type:'json'};
export const bootstrapInstructions = [
 contract.instructions[0],
 'Read read_developer_context for the small core and workflow index; load only relevant read_guide results. For connection setup load connection-schedules and stop after configuring saved routines. For change wakes load change-resumption, follow current record pointers and resume existing authorized work. For repair load repair-recovery. For authorized Discover, Applications, Networking or Career Toolkit work load agent-audit to record the run. Version numbers without retained content are not a cache.',
].join('\n\n');
