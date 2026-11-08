export * from '../supabase/functions/agent-gateway/job-assessment.mjs';

// Use only saved assessment text; scores never synthesize a fit verdict.
export function savedRoleLabel(role) {
 const label=typeof role?.fitLabel==='string'?role.fitLabel.trim():'';
 if(label&&label.length<=80)return label;
 return ['Apply Now','Strong Consider','Skip Unless Team Fit'].includes(role?.priority)?role.priority:null;
}
