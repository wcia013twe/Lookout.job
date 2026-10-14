import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT_URL } from './gateway-client.mjs';
import { validateProfileSetup, verifyResumeBytes } from '../supabase/functions/agent-gateway/profile-setup.mjs';

// Dedicated bounded resume-file tool; no general file reader or caller upload URL.
export async function uploadProfileResume({filePath,variant,eventKey,gateway,fetchImpl=fetch}) {
  if (typeof filePath !== 'string' || !/\.(pdf|docx)$/i.test(filePath)) throw Error('Choose a local PDF/DOCX resume');
  const handle=await open(filePath,'r');
  let bytes;
  try {
    const info=await handle.stat();
    if (!info.isFile() || info.size<1 || info.size>10*1024*1024) throw Error('Resume must be a file up to 10 MB');
    // Allocate at most the inspected size; growth during reading cannot exceed the cap.
    const buffer=Buffer.alloc(info.size);
    let offset=0;
    while(offset<buffer.length) { const read=await handle.read(buffer,offset,buffer.length-offset,offset); if(!read.bytesRead) throw Error('Resume changed while reading'); offset+=read.bytesRead; }
    bytes=buffer;
  } finally { await handle.close(); }
  const metadata={eventKey,fileName:basename(filePath),variant,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  validateProfileSetup('resumes.begin_upload',metadata);
  await verifyResumeBytes(new Blob([bytes]),{...metadata,extension:metadata.fileName.split('.').pop().toLowerCase()});
  const plan=await gateway.call('resumes.begin_upload',metadata);
  if(plan.resume) return plan;
  const url=new URL(plan.uploadUrl);
  if(url.origin!==PROJECT_URL || !/^\/storage\/v1\/object\/upload\/sign\/resumes\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|docx)$/.test(decodeURIComponent(url.pathname)) || url.username || url.password || url.hash || !url.searchParams.has('token')) throw Error('Invalid private upload URL');
  const response=await fetchImpl(url.href,{method:'PUT',headers:{'Content-Type':plan.contentType,'x-upsert':'false'},body:bytes,redirect:'error',signal:AbortSignal.timeout(60000)});
  // An uncertain PUT may already have succeeded. Server verification, not a second
  // overwrite, resolves duplicate-object responses from safe retries.
  if(!response.ok && ![400,409].includes(response.status)) throw Error('Resume upload incomplete; retry the same event key');
  return gateway.call('resumes.complete_upload',{uploadId:plan.uploadId});
}
