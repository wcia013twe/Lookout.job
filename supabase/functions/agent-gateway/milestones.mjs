export const MILESTONE_KINDS = ['submitted','recruiter_call','technical_round','interview','offer','rejected','withdrawn'];
const timestamp = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const bounded = (value,max) => typeof value==='string' && value.trim() && value.length<=max;
export function validateMilestone(payload) {
 const s=payload.source;
 if(!bounded(payload.eventKey,200)||!bounded(payload.label,300)||!MILESTONE_KINDS.includes(payload.kind)||!['scheduled','completed','received'].includes(payload.phase)
  ||!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['kind','messageId','subject','excerpt','receivedAt','timestampConfirmed','note'].includes(k))
  ||s.kind!=='email'||!bounded(s.messageId,200)||!bounded(s.subject,300)||!bounded(s.excerpt,2000)||!timestamp(s.receivedAt)
  ||(s.note!==undefined&&(typeof s.note!=='string'||s.note.length>2000))
  ||(payload.occurredAt!==undefined&&payload.occurredAt!==null&&(!timestamp(payload.occurredAt)||s.timestampConfirmed!==true)))
  throw Error('An owned milestone needs email evidence; leave uncertain dates null or supply a confirmed timestamp with timezone.');
}
