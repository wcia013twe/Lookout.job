// Explicit live smoke test: one fictional PDF may consume one APILayer request.
// Uses only loopback Supabase/API and removes its disposable account and file.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {uploadResume} from '../lib/resume-model.mjs';
import {createBackend} from '../backend/client.mjs';
function fictionalPdf(){
 const lines=['Jordan Example','jordan.example@example.com','Software Engineer','EXPERIENCE','Example Systems - Software Engineer','June 2024 - Present','Built backend APIs using TypeScript and PostgreSQL.','EDUCATION','Example University - Bachelor of Science in Computer Science','2020 - 2024','SKILLS','TypeScript, PostgreSQL, Python, Docker'];
 const escape=value=>value.replace(/[\\()]/g,c=>'\\'+c);
 const stream='BT /F1 12 Tf 50 750 Td 18 TL '+lines.map((line,i)=>(i?'T* ':'')+'('+escape(line)+') Tj').join(' ')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream'];
 let pdf='%PDF-1.4\n'+'% Fictional smoke-test metadata; no real personal data.\n'.repeat(640);const offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';}const start=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';return new File([pdf],'fictional-resume.pdf',{type:'application/pdf'});
}
if(process.argv.includes('--write-fixture')){
 const file=fictionalPdf();await writeFile('/private/tmp/lookout-live-resume-fixture.pdf',new Uint8Array(await file.arrayBuffer()));console.log('Wrote fictional PDF fixture ('+file.size+' bytes).');process.exit(0);
}
const base=process.env.LOOKOUT_RESUME_API_URL||'http://127.0.0.1:8081';
const loopback=value=>{const u=new URL(value);assert.ok(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.pathname==='/'&&!u.username&&!u.password&&!u.search&&!u.hash,'Only loopback service origins allowed');};loopback(base);
assert.ok((await fetch(base+'/healthz',{signal:AbortSignal.timeout(5000)})).ok,'Local Node API unavailable');
const raw=execFileSync(process.env.SUPABASE_CLI||'supabase',['status','-o','env'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const env=Object.fromEntries(raw.split('\n').map(line=>line.match(/^([A-Z_]+)="(.*)"$/)).filter(Boolean).map(([,k,v])=>[k,v]));
const url=env.API_URL||'http://127.0.0.1:54321';loopback(url);
const admin=createClient(url,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
const ok=({data,error})=>{if(error)throw Error('Local fixture operation rejected: '+error.code);return data;};
let user,path;const cleanup=[];
try{
 const email='live-resume-'+randomUUID()+'@example.test',password=randomUUID()+'aA!9';user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 const client=createClient(url,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),session=ok(await client.auth.signInWithPassword({email,password})).session;
 const resume=await uploadResume({client,getOwner:()=>user.id,file:fictionalPdf(),variant:'Master'});path=resume.object_path;
 console.log('Uploaded a valid fictional PDF to the disposable local account.');
 const response=await fetch(base+'/v1/resume-import',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({resumeId:resume.id}),signal:AbortSignal.timeout(60000)});const parsed=await response.json();
 if(!response.ok)throw Error('Live resume import failed (HTTP '+response.status+'): '+(parsed.error||'no safe error returned'));
 const proposal=parsed.data;assert.equal(proposal.provider,'apilayer');assert.ok(!Object.hasOwn(proposal.facts,'name')||typeof proposal.facts.name==='string','Unsupported name field');assert.equal(proposal.facts.email?.toLowerCase(),'jordan.example@example.com','Vendor did not extract the fictional email');assert.ok(proposal.facts.workExperience?.length,'Vendor did not extract fictional work experience');
 console.log('Live APILayer returned email, skills and '+proposal.facts.workExperience.length+' experience entry/entries. Name extracted: '+Boolean(proposal.facts.name)+'. All values require review.');
 const backend=createBackend(client,user.id);const saved=proposal.profileUpdatedAt===null?await backend.performPlatformAction('profile.save',{facts:proposal.facts,expectedUpdatedAt:null}):await backend.updateFields('profile.fields.update',{fields:proposal.facts,expectedUpdatedAt:proposal.profileUpdatedAt});assert.equal(saved.verified_at,null);
 const token='jb_agent_'+randomBytes(32).toString('hex');ok(await admin.rpc('manage_agent_connection',{owner_id:user.id,operation:'connections.issue',payload:{name:'Disposable live resume smoke test',scopes:['workspace:read','resumes:read','profile:write'],expiresInDays:1,tokenHash:createHash('sha256').update(token).digest('hex')}}));
 const mcp=await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'parse_profile_resume',arguments:{resumeId:resume.id}}}),signal:AbortSignal.timeout(60000)});const body=await mcp.json();assert.ok(!body.error&&!body.result?.isError,'MCP parse failed');const cached=JSON.parse(body.result.content[0].text);assert.deepEqual(cached.facts,proposal.facts);assert.equal(cached.profileUpdatedAt,saved.updated_at);
 const persisted=ok(await client.from('profiles').select('facts,verified_at').eq('user_id',user.id).single());assert.equal(persisted.facts.email,'jordan.example@example.com');assert.equal(persisted.verified_at,null);
 console.log('PASS: running Docker API -> private local Storage -> live APILayer -> versioned profile save -> scoped MCP cached proposal. One fictional document sent; no real user resume used.');
}finally{
 if(path){const result=await admin.storage.from('resumes').remove([path]);if(result.error)cleanup.push('private file');}
 if(user){const result=await admin.auth.admin.deleteUser(user.id);if(result.error)cleanup.push('test account');}
 if(cleanup.length)throw Error('Cleanup requires attention: '+cleanup.join(', '));
 console.log('Disposable local account and resume removed.');
}
