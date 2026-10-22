export * from '../supabase/functions/agent-gateway/artifacts.mjs';
export const artifactLabels={weekly_prep:'Weekly prep',company_research:'Company research',interview_brief:'Interview brief',read_up:'Read-up',explainer:'Explainer',practice:'Practice',decision_aid:'Decision aid',notes:'Notes',cover_letter:'Cover letter',application_template:'Application template'};

// Debrief retrieval markers are metadata, not reader-facing copy.
export const artifactPurpose=content=>content.purpose.replace(/^Interview debrief \[[^\]]+\]\s*/, 'Interview debrief · ');
