import { trackerProgress } from './tracker-display.mjs';

const outcomes = [
 ['waiting', 'Awaiting response'], ['screen', 'Screening'], ['interview', 'Interviewing'],
 ['offer', 'Offers'], ['rejected', 'Rejected'], ['withdrawn', 'Withdrawn'],
];
// Use the tracker's deduplicated native/imported list and progress rules. This
// summarizes current outcomes, not a fabricated sequence of past hiring steps.
export function applicationFlow(applications, trackerItems = {}) {
 const counts = new Map(outcomes.map(([id]) => [id, 0]));
 let total = 0;
 for (const application of applications) {
  const progress = trackerProgress(application, trackerItems[application.id]);
  if (progress.level < 1) continue;
  const id = progress.status === 'Rejected' ? 'rejected' : progress.status === 'Withdrawn' ? 'withdrawn'
   : progress.level === 4 ? 'offer' : progress.level === 3 ? 'interview' : progress.level === 2 ? 'screen' : 'waiting';
  counts.set(id, (counts.get(id) || 0) + 1); total++;
 }
 const destinations = outcomes.filter(([id]) => counts.get(id) > 0).map(([id, label]) => ({id, label, count: counts.get(id) || 0}));
 return {total, destinations, nodes: total ? [{id:'applied', name:'Applications'}, ...destinations.map(({id,label}) => ({id,name:label}))] : [],
  links: destinations.map(({id,count}) => ({source:'applied',target:id,value:count}))};
}
