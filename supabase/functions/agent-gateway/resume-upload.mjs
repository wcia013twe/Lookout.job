// Storage capabilities derive only from an authenticated upload intent, never a caller path.
export async function resumeUploadDispatch({operation,payload,rpc,storage,cryptoApi=globalThis.crypto}) {
 const intent=await rpc('resumes.upload.context',{id:payload.id});
 if(intent.error)return intent;
 const data=intent.data;
 if(operation==='resumes.upload.begin') {
  if(data.completed)return {data:{id:data.id,completed:true,resume:data.resume}};
  const signed=await storage.createSignedUploadUrl(data.objectPath,{upsert:false});
  if(signed.error)return {error:{code:'22023'}};
  return {data:{id:data.id,objectPath:data.objectPath,upload:signed.data,expiresAt:data.expiresAt,completed:data.completed}};
 }
 if(data.completed)return {data:data.resume};
 const downloaded=await storage.download(data.objectPath);
 if(downloaded.error)return {error:{code:'P0002'}};
 const bytes=new Uint8Array(await downloaded.data.arrayBuffer());
 const pdf=bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
 const docx=bytes.length>=4&&bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4&&new TextDecoder().decode(bytes).includes('word/document.xml');
 const hash=Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(bytes.length!==data.sizeBytes||hash!==data.sha256||!(data.fileType==='pdf'?pdf:docx))return {error:{code:'22023'}};
 return rpc('resumes.upload.finalize',{id:data.id});
}
