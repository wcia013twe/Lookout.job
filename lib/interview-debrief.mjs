// Debriefs reuse private versioned notes; the marker is a retrieval convention,
// never an ownership or approval boundary. Existing services enforce both.
export const debriefMarker = applicationId => `Interview debrief [${applicationId}]`;
export function debriefPayload(application, {id, version = 0, round, summary}) {
  if (!round?.trim() || !summary?.trim()) throw Error('Choose a round and add a summary.');
  return {id, expectedVersion: version, title: `${application.company} · ${round.trim()}`.slice(0,200),
    purpose: `${debriefMarker(application.backendId || application.id)} ${round.trim()}`.slice(0,1000),
    kind: 'notes', format: 'markdown', body: summary.trim(), company: application.company.slice(0,200), sources: [], links: []};
}
export function debriefForumContent(application, debrief, body = debrief.content.body) {
  if (!body?.trim() || body.length > 12000) throw Error('Forum summaries need 1–12,000 characters.');
  return {type:'interview_report', title:debrief.content.title.slice(0,200), body:body.trim(),
    company:application.company.slice(0,200), role:application.title.slice(0,200),
    stage:debrief.content.purpose.slice(debriefMarker(application.backendId || application.id).length).trim().slice(0,200),
    sources:[], provenance:'unknown', personalDisclosure:true};
}
