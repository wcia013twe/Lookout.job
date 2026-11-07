export * from '../supabase/functions/agent-gateway/artifacts.mjs';
export const artifactLabels={weekly_prep:'Weekly prep',company_research:'Company context + motivation',interview_brief:'Round prep brief',read_up:'Read-up',explainer:'Explainer',practice:'Practice',decision_aid:'Decision aid',notes:'Notes',story_bank:'Story bank',interview_debrief:'Interview debrief',resource:'Online resource',mock_interview:'Mock interview',cover_letter:'Cover letter',application_template:'Application template'};

// Debrief retrieval markers are metadata, not reader-facing copy.
export const artifactPurpose=content=>content.purpose.replace(/^Interview debrief \[[^\]]+\]\s*/, 'Interview debrief · ');
