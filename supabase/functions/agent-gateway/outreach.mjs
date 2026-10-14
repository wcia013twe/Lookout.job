const fields = ['id','expectedRevision','company','contact','contactType','title','linkedin','link','connection','evidence','reason','subject','message','sourceUrl'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value,max=10000) => typeof value === 'string' && value.trim().length && value.length<=max;
export function validateOutreach(operation,payload) {
  if(operation==='outreach.read') { if(Object.keys(payload).length) throw Error('No outreach read arguments'); return; }
  if(!object(payload) || Object.keys(payload).some(k=>!['requestId','eventKey','contacts'].includes(k)) || !/^[a-f0-9-]{36}$/i.test(payload.requestId || '') || !text(payload.eventKey,200) || !Array.isArray(payload.contacts) || !payload.contacts.length || payload.contacts.length>100) throw Error('Request, retry key and 1–100 contacts required');
  const keys=new Set();
  for(const r of payload.contacts) {
    if(!object(r) || Object.keys(r).some(k=>!fields.includes(k)) || !text(r.company,200) || !text(r.contact,200) || !text(r.message) || /\[[^\]]+\]/.test(r.message)) throw Error('Complete contact and copy-ready message required');
    if(r.id!==undefined && (!text(r.id,200) || !Number.isInteger(r.expectedRevision) || r.expectedRevision<0)) throw Error('Existing contacts require current revision');
    if(r.id===undefined && r.expectedRevision!==undefined) throw Error('Revision needs contact ID');
    if(!['recruiter','engineer','senior','manager','alumni','other'].includes(r.contactType)) throw Error('Contact type required');
    for(const field of fields.filter(f=>!['id','expectedRevision'].includes(f))) if(r[field]!==undefined && (typeof r[field]!=='string' || r[field].length>10000)) throw Error('Invalid contact field');
    for(const field of ['linkedin','link','sourceUrl']) if(r[field]) { const u=new URL(r[field]); if(u.protocol!=='https:' || u.username || u.password || (field==='linkedin' && (!['linkedin.com','www.linkedin.com'].includes(u.hostname) || !/^\/in\/[\w%-]+\/?$/.test(u.pathname)))) throw Error('Valid HTTPS contact URLs required'); }
    const key=r.company.trim().toLowerCase()+'|'+r.contact.trim().toLowerCase(); if(keys.has(key)) throw Error('Duplicate contact'); keys.add(key);
  }
}
