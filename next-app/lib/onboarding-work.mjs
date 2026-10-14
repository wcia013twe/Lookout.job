// Rendering decisions must follow the selected policy, never an unrelated old task.
export function onboardingWork(session) {
 const executionKind=session.data.policy==='prepare'?'prepare_application':session.data.policy==='auto_apply_requested'?'validate_auto_apply':'discover';
 const activeKind=session.step==='first_match_pending'?'discover':executionKind;
 const pending=session.tasks.find(t=>t.kind===activeKind&&['queued','claimed','running'].includes(t.state));
 const uncertain=session.tasks.find(t=>t.kind===activeKind&&t.state==='uncertain');
 const completed=session.tasks.find(t=>t.kind===executionKind&&t.state==='completed');
 return {executionKind,pending,uncertain,completed};
}
export function onboardingTaskKey(session,kind) {
 const latestFailure=session.tasks.find(t=>t.kind===kind&&['failed','needs_user'].includes(t.state));
 return `ob-${session.revision}-${kind}-${latestFailure?.id || 'first'}`;
}
