import { trackerProgress } from './tracker-display.mjs';

// Accept the same deduplicated native/imported applications displayed by the tracker.
export function applicationStats(applications, trackerItems = {}) {
 const progress = applications.map(application => trackerProgress(application, trackerItems[application.id]));
 const active = progress.filter(item => !['Rejected', 'Withdrawn'].includes(item.status));
 return {tracked: applications.length, applied: progress.filter(item => item.level >= 1).length,
  interviewing: active.filter(item => item.level === 3).length, offers: active.filter(item => item.level === 4).length};
}
