// Candidate setup is preparation, never a human verification or application approval.
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0);
const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
const variants = ['Backend','Distributed Systems','ML Infrastructure','Master'];
const scalars = ['name','firstName','lastName','email','phone','location','linkedin','github','portfolio','otherUrl','authorization','headline','currentEmployer','jobSearchStatus','skills','preferredSkills','languages','introduction'];
const records = {workExperience:['title','company','location','employmentType','startDate','endDate','current','description'],education:['school','degree','fieldOfStudy','gpa','startDate','endDate','description'],projects:['name','role','url','startDate','endDate','description']};
export function validateProfileSetup(operation, p) {
  if (operation === 'connections.profile_setup') {
    if (!keys(p,['id','enabled']) || !uuid(p.id) || typeof p.enabled !== 'boolean') throw Error('Connection ID and enabled boolean required');
    return;
  }
  if (operation === 'profile.import') {
    if (!keys(p,['eventKey','expectedPersonalVersion','facts','answers','defaultResumeId','source']) || !text(p.eventKey,200) || !Number.isSafeInteger(p.expectedPersonalVersion) || p.expectedPersonalVersion < 1 || (p.source !== undefined && !text(p.source,200))) throw Error('Import key and current settings version required');
    if (p.facts === undefined && p.answers === undefined && p.defaultResumeId === undefined) throw Error('Profile facts, answers or default resume required');
    if (p.facts !== undefined && (!keys(p.facts,[...scalars,...Object.keys(records)]) || Object.entries(p.facts).some(([key,value]) => scalars.includes(key) ? !text(value,20000,true) : !Array.isArray(value) || value.length > 50 || value.some(row => !keys(row,records[key]) || Object.entries(row).some(([field,v]) => field==='current' ? typeof v!=='boolean' : !text(v,20000,true)))))) throw Error('Invalid candidate facts; verification cannot be imported');
    if (p.answers !== undefined && (!Array.isArray(p.answers) || p.answers.length > 50 || p.answers.some(answer => !keys(answer,['id','expectedVersion','question','answer','companyScope','requestedPolicy']) || !text(answer.question,2000) || !text(answer.answer,20000) || (answer.id !== undefined && (!uuid(answer.id) || !Number.isSafeInteger(answer.expectedVersion) || answer.expectedVersion<1)) || (answer.id===undefined && answer.expectedVersion!==undefined) || (answer.companyScope !== undefined && !text(answer.companyScope,200,true)) || (answer.requestedPolicy!==undefined && !['ask','auto'].includes(answer.requestedPolicy))))) throw Error('Invalid proposed answers; human verification cannot be imported');
    if (p.defaultResumeId !== undefined && !uuid(p.defaultResumeId)) throw Error('Owned resume ID required');
    return;
  }
  if (operation === 'resumes.begin_upload') {
    if (!keys(p,['eventKey','fileName','variant','sha256','bytes']) || !text(p.eventKey,200) || !text(p.fileName,200) || !/^[^/\\\x00-\x1f]+\.(pdf|docx)$/i.test(p.fileName) || !variants.includes(p.variant) || !/^[a-f0-9]{64}$/.test(p.sha256 || '') || !Number.isSafeInteger(p.bytes) || p.bytes<1 || p.bytes>10*1024*1024) throw Error('PDF/DOCX metadata, SHA-256 and size up to 10 MB required');
    return;
  }
  if (operation === 'resumes.complete_upload' && (!keys(p,['uploadId']) || !uuid(p.uploadId))) throw Error('Upload ID required');
}
function isDocx(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===bytes.length) {end=i;break;}
  if(end<0 || view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0) return false;
  const count=view.getUint16(end+10,true), size=view.getUint32(end+12,true); let offset=view.getUint32(end+16,true);
  if(count>2048 || offset+size>end) return false;
  const names=new Set();
  for(let i=0;i<count;i++) {
    if(offset+46>end || view.getUint32(offset,true)!==0x02014b50 || (view.getUint16(offset+8,true)&1)) return false;
    const length=view.getUint16(offset+28,true), extra=view.getUint16(offset+30,true), comment=view.getUint16(offset+32,true);
    if(offset+46+length+extra+comment>end) return false;
    names.add(new TextDecoder().decode(bytes.slice(offset+46,offset+46+length)));
    offset+=46+length+extra+comment;
  }
  return names.has('[Content_Types].xml') && names.has('word/document.xml');
}
export async function verifyResumeBytes(blob, plan) {
  if (blob.size !== plan.bytes || blob.size > 10*1024*1024) throw Error('Resume size mismatch');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdf = plan.extension === 'pdf';
  if (pdf ? new TextDecoder().decode(bytes.slice(0,5)) !== '%PDF-' : (![0x50,0x4b,0x03,0x04].every((byte,i)=>bytes[i]===byte) || !isDocx(bytes))) throw Error('Resume file format mismatch');
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  const hash = Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if (hash !== plan.sha256) throw Error('Resume checksum mismatch');
  return {hash,bytes:bytes.length};
}
export async function resumeSetupResponse({operation,data,storage,rpc,credentialHash}) {
  if (data.resume) return {resume:data.resume,personalVersion:data.personalVersion,reused:true};
  if (operation === 'resumes.begin_upload') {
    const signed = await storage.createSignedUploadUrl(data.objectPath,{upsert:false});
    if (signed.error || !signed.data?.signedUrl) throw Error('Resume upload URL unavailable');
    return {uploadId:data.uploadId,uploadUrl:signed.data.signedUrl,method:'PUT',contentType:data.extension==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',expiresAt:data.expiresAt};
  }
  const downloaded = await storage.download(data.objectPath);
  if (downloaded.error || !downloaded.data) throw Error('Resume has not uploaded');
  const verified = await verifyResumeBytes(downloaded.data,data);
  const result = await rpc('finish_agent_resume_upload',{credential_hash:credentialHash,upload_id:data.uploadId,actual_hash:verified.hash,actual_bytes:verified.bytes});
  if (result.error) throw Error('Resume registration rejected');
  return result.data;
}
