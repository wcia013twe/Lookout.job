// Shared presentation rules for publication age; availability checks never reset it.
export const postingAgeOptions = [
  ['any', 'Any time'], ['1', 'Last 24 hours'], ['3', 'Last 3 days'],
  ['7', 'Last week'], ['14', 'Last 2 weeks'], ['30', 'Last month'],
  ['unknown', 'Posting date unknown'],
];
function timestamp(value) { return value ? Date.parse(value) : NaN; }
export function postingDate(role) {
  // A current observation can explicitly say that no publication date is disclosed.
  return role.postingObservation ? role.postingObservation.postedAt : role.postedDate;
}
export function matchesPostingAge(role, value = 'any', now = Date.now()) {
  if (value === 'any') return true;
  const date = timestamp(postingDate(role));
  if (value === 'unknown') return !Number.isFinite(date);
  const days = Number(value), age = now - date;
  return [1, 3, 7, 14, 30].includes(days) && Number.isFinite(date) && age >= 0 && age <= days * 86400000;
}
export function formatPostedDate(role, now = Date.now()) {
  const date = timestamp(postingDate(role));
  if (!Number.isFinite(date)) return 'Not disclosed';
  const label = new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}).format(date);
  const days = Math.floor((now - date) / 86400000);
  const age = days < 0 ? '' : days === 0 ? 'today' : days === 1 ? '1 day ago' : days < 7 ? `${days} days ago` : `${Math.floor(days / 7)} ${days < 14 ? 'week' : 'weeks'} ago`;
  return age ? `${label} · ${age}` : label;
}
export function formatAvailabilityCheck(role) {
  const date = timestamp(role.postingObservation?.checkedAt);
  if (!Number.isFinite(date)) return 'Not checked';
  return new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short'}).format(date);
}
export function postingStatus(role) {
  if (!Number.isFinite(timestamp(role.postingObservation?.checkedAt))) return 'Unverified';
  return ({active:'Live', expired:'Closed', uncertain:'Unverified'})[role.postingObservation?.liveness] || 'Unverified';
}
