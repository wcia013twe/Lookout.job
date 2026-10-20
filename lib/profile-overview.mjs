import {trackerProgress} from './tracker-display.mjs';
// Read-only account totals use the same recorded stages as the application tracker.
export function profileOverviewStats(state) {
 const tracker=state.tracker||{}, applications=state.workflow?.applications||{};
 const ids=[...new Set([...(tracker.ids||[]),...Object.keys(applications)])];
 const progress=ids.map(id=>trackerProgress(applications[id]||{},tracker.items?.[id]||{}));
 const active=progress.filter(p=>!['Rejected','Withdrawn'].includes(p.status));
 return {tracked:ids.length,applied:progress.filter(p=>p.level>=1).length,interviewing:active.filter(p=>p.level===3).length,offers:active.filter(p=>p.level===4).length};
}

// Preferred names affect presentation only; shared factual names remain unchanged.
export function profileDisplayName(facts, preferredFirst = '', preferredLast = '') {
 const first=preferredFirst.trim(),last=preferredLast.trim();
 if (!first && !last) return facts.name || '';
 return [first || facts.firstName,last || facts.lastName].filter(Boolean).join(' ');
}
