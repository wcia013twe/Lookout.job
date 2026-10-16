const object=(value)=>value&&typeof value==='object'&&!Array.isArray(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const kinds=['scan','evaluation','analytics','ats','document','source_config','compensation'];
export function validateToolkit(operation,p) {
 const allowed=operation==='toolkit.context'?['applicationId']:operation==='toolkit.results'?['applicationId','kind','eventKey']:operation==='toolkit.record'?['applicationId','kind','eventKey','result']:operation==='toolkit.file.begin'?['applicationId','eventKey','kind','fileName','variant','sha256','bytes']:['fileId'];
 if(!object(p)||Object.keys(p).some(k=>!allowed.includes(k))||p.applicationId!==undefined&&!uuid(p.applicationId))throw Error('Invalid toolkit arguments');
 if(p.eventKey!==undefined&&(typeof p.eventKey!=='string'||!p.eventKey.trim()||p.eventKey.length>200))throw Error('Invalid event key');
 if(operation==='toolkit.results'&&p.kind!==undefined&&!kinds.includes(p.kind))throw Error('Unknown result kind');
 if(operation==='toolkit.record') {
  if(!kinds.includes(p.kind)||typeof p.eventKey!=='string'||!p.eventKey.trim()||p.eventKey.length>200||!object(p.result)||JSON.stringify(p.result).length>180000)throw Error('Bounded typed result and stable retry key required');
  if(p.kind==='source_config'&&(!object(p.result)||typeof p.result.targetId!=='string'||typeof p.result.provider!=='string'||!object(p.result.options)||Object.keys(p.result.options).some(k=>!['api','keywords'].includes(k))))throw Error('Saved target, provider and bounded options required');
  if(p.kind==='compensation'&&(!uuid(p.applicationId)||!['desired','advertised','actual','stated'].includes(p.result.type)||typeof p.result.amount!=='string'||p.result.amount.length>200||!/^([A-Z]{3}|UNKNOWN)$/.test(p.result.currency||'')||!/^\d{4}-\d{2}-\d{2}$/.test(p.result.date||'')||typeof p.result.source!=='string'||p.result.source.length>100))throw Error('Owned application and sourced compensation observation required');
  if(p.kind==='evaluation'&&(!uuid(p.applicationId)||!Number.isFinite(p.result.score)||p.result.score<1||p.result.score>5||!Array.isArray(p.result.requirements)||p.result.requirements.length>100||p.result.requirements.some(r=>!object(r)||typeof r.requirement!=='string'||!['met','partial','missing','unknown'].includes(r.match)||typeof r.evidence!=='string')))throw Error('Evaluation score, application and requirement evidence required');
 }
 if(operation==='toolkit.file.begin'&&(!['resume','cover_letter'].includes(p.kind)||typeof p.eventKey!=='string'||!p.eventKey.trim()||p.eventKey.length>200||typeof p.fileName!=='string'||p.fileName.length>200||!/^[^/\\\x00-\x1f]+\.pdf$/i.test(p.fileName)||!/^[a-f0-9]{64}$/.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||p.bytes<5||p.bytes>10485760||p.variant!==undefined&&!['Master','Backend','Distributed Systems','ML Infrastructure'].includes(p.variant)))throw Error('Bounded PDF metadata required');
 if(['toolkit.file.complete','toolkit.file.read'].includes(operation)&&!uuid(p.fileId))throw Error('File ID required');
}
export async function toolkitFileResponse({operation,data,storage,rpc,credentialHash,cryptoApi=globalThis.crypto}) {
 if(operation==='toolkit.file.read') {const signed=await storage.createSignedUrl(data.objectPath,60);if(signed.error)throw Error('Document unavailable');return {...data,url:signed.data.signedUrl};}
 if(data.completed)return data;
 if(operation==='toolkit.file.begin') {const signed=await storage.createSignedUploadUrl(data.objectPath,{upsert:false});if(signed.error)throw Error('Upload unavailable');return {...data,uploadUrl:signed.data.signedUrl,contentType:'application/pdf'};}
 const downloaded=await storage.download(data.objectPath);if(downloaded.error||downloaded.data.size!==data.bytes||downloaded.data.size>10485760)throw Error('Document size mismatch');
 const bytes=new Uint8Array(await downloaded.data.arrayBuffer());
 const digest=Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||digest!==data.sha256)throw Error('Document signature or checksum mismatch');
 const result=await rpc('agent_dispatch',{credential_hash:credentialHash,operation:'toolkit.file.finalize',payload:{fileId:data.fileId}});if(result.error)throw Error('Document finalization rejected');return result.data;
}
