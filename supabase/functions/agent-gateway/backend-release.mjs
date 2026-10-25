// This is a reviewed operator attestation, not a live Supabase probe or a claim
// that a reproduction passed. GitHub content, never issue prose, is authoritative.
export const EVIDENCE_PATH='backend/releases/current.json';
const project='umhqfqzpwmszhcknwtrs';
const identities={'agent-gateway':'dfc5f49c-280e-48f5-ad2b-8c013050a1da','agent-mcp':'fe2b7a80-96bb-475d-b281-e05bb1d7fa50'};
const hex40=s=>/^[a-f0-9]{40}$/.test(s??'');
const runtime=p=>p.startsWith('supabase/functions/agent-gateway/')||p.startsWith('supabase/functions/agent-mcp/')||p==='lib/search-profile.mjs';
const ancestor=c=>['ahead','identical'].includes(c?.status);
const decode=c=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(c.replace(/\s/g,'')),x=>x.charCodeAt(0))));
export async function verifyBackendRelease({api,run,pr,files,evidenceId}) {
  try {
    if(files.some(f=>[f.filename,f.previous_filename].some(p=>p?.startsWith('supabase/migrations/'))))return null;
    const published=await api(`/contents/${EVIDENCE_PATH}?ref=${run.head_sha}`);
    const current=await api(`/contents/${EVIDENCE_PATH}?ref=main`);
    if(!hex40(published.sha)||published.sha!==current.sha||(evidenceId&&evidenceId!==published.sha)||published.encoding!=='base64')return null;
    const e=decode(published.content);
    if(e.schemaVersion!==1||e.status!=='verified'||e.provenance!=='operator-attested-supabase-source-readback'||e.verification!=='point-in-time'||e.projectId!==project||!hex40(e.sourceCommit)||!e.operator||!Array.isArray(e.functions)||e.functions.length!==2)return null;
    const observed=Date.parse(e.observedAt),released=Date.parse(run.updated_at);
    if(!Number.isFinite(observed)||!Number.isFinite(released)||observed>released||observed>Date.now())return null;
    if(!ancestor(await api(`/compare/${pr.merge_commit_sha}...${e.sourceCommit}`))||!ancestor(await api(`/compare/${e.sourceCommit}...${run.head_sha}`)))return null;
    const tree=await api(`/git/trees/${e.sourceCommit}?recursive=1`);
    const latest=await api('/git/trees/main?recursive=1');
    if(tree.truncated||latest.truncated||!Array.isArray(tree.tree)||!Array.isArray(latest.tree))return null;
    const blobs=new Map(tree.tree.filter(x=>x.type==='blob').map(x=>[x.path,x.sha]));
    const now=new Map(latest.tree.filter(x=>x.type==='blob').map(x=>[x.path,x.sha]));
    // A newer runtime merge invalidates the snapshot until the next deployment
    // is observed and reviewed. Evidence-only commits do not create a cycle.
    for(const p of new Set([...blobs.keys(),...now.keys()]))if(runtime(p)&&blobs.get(p)!==now.get(p))return null;
    const names=new Set(),covered=new Set();
    for(const f of e.functions){
      if(!['agent-gateway','agent-mcp'].includes(f.name)||names.has(f.name)||f.status!=='ACTIVE'||f.verifyJwt!==false||!Number.isSafeInteger(f.version)||f.version<1||f.id!==identities[f.name]||!Array.isArray(f.files)||!f.files.length)return null;
      names.add(f.name);
      const paths=new Set();
      for(const file of f.files){
        if(!runtime(file.path)||paths.has(file.path)||!hex40(file.gitBlobSha)||!/^[a-f0-9]{64}$/.test(file.sha256??'')||blobs.get(file.path)!==file.gitBlobSha)return null;
        paths.add(file.path);covered.add(file.path);
      }
      if(!paths.has(`supabase/functions/${f.name}/index.ts`)||!paths.has(`supabase/functions/${f.name}/deno.json`))return null;
    }
    // Deployment records for other services/schema changes cannot bless them.
    if(files.some(f=>[f.filename,f.previous_filename].filter(Boolean).some(p=>(p.startsWith('supabase/')||p==='lib/search-profile.mjs')&&!covered.has(p))))return null;
    return {id:published.sha,sourceCommit:e.sourceCommit,observedAt:e.observedAt,provenance:e.provenance,functions:e.functions.map(({name,version})=>({name,version}))};
  } catch {return null;}
}
