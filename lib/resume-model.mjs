import {validatePlatformPayload} from '../supabase/functions/agent-gateway/platform-tools.mjs';
// Private files are immutable versions. A new upload gets a new object and row;
// existing application approvals therefore keep referring to their exact bytes.
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const VARIANTS = [
  "Backend",
  "Distributed Systems",
  "ML Infrastructure",
  "Master",
];

export function validateResume(file, variant) {
  const extension = file?.name?.split(".").pop().toLowerCase();
  if (!TYPES[extension] || (file.type && file.type !== TYPES[extension]))
    throw Error("Choose a PDF or DOCX resume.");
  if (
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > MAX_RESUME_BYTES
  )
    throw Error("Resume files must be between 1 byte and 10 MB.");
  if (!VARIANTS.includes(variant)) throw Error("Choose a resume variant.");
  return { extension, contentType: TYPES[extension] };
}

export async function sha256(file) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function assertOwner(expected, current) {
  if (!expected || current !== expected)
    throw Error(
      "Account changed. Choose the file again in your current account.",
    );
}

// getOwner is checked around every asynchronous boundary. Supabase RLS remains
// authoritative even if a session changes between the check and the request.
export async function uploadResume({
  client,
  getOwner,
  file,
  variant,
  version = 1,
}) {
  const { extension, contentType } = validateResume(file, variant);
  const owner = getOwner(),
    check = () => assertOwner(owner, getOwner());
  check();
  const contentHash = await sha256(file);
  check();
  const id = crypto.randomUUID(),
    objectPath = `${owner}/${id}.${extension}`;
  const storage = client.storage.from("resumes");
  const uploaded = await storage.upload(objectPath, file, {
    contentType,
    upsert: false,
  });
  if (uploaded.error)
    throw Error("Resume upload failed. Check your connection and try again.");
  let metadataSaved = false;
  try {
    check();
    const { data, error } = await client
      .from("resumes")
      .insert({
        id,
        user_id: owner,
        name: file.name,
        variant,
        version,
        object_path: objectPath,
        reference_url: null,
        content_hash: contentHash,
      })
      .select()
      .single();
    if (error)
      throw Error("Resume details could not save. Try uploading again.");
    metadataSaved = true;
    check();
    return data;
  } catch (error) {
    // If metadata saved, keep the valid old-account record. Failed metadata gets
    // best-effort object cleanup; never report success or adopt it locally.
    if (!metadataSaved) await storage.remove([objectPath]).catch(() => {});
    throw error;
  }
}

export async function resumeDownloadUrl({ client, getOwner, resume }) {
  const owner = getOwner();
  assertOwner(owner, getOwner());
  if (!resume.objectPath?.startsWith(`${owner}/`))
    throw Error("This resume belongs to another account.");
  const { data, error } = await client.storage
    .from("resumes")
    .createSignedUrl(resume.objectPath, 60);
  assertOwner(owner, getOwner());
  if (error || !data?.signedUrl)
    throw Error("Could not open the resume. Try again.");
  return data.signedUrl;
}

export async function replaceResumeSource({client,getOwner,resumeId,replacementId,expectedVersion}) {
 const payload={resumeId,replacementId,expectedVersion};
 validatePlatformPayload('resumes.source.replace',payload);
 const owner=getOwner();assertOwner(owner,getOwner());
 const {data,error}=await client.rpc('replace_resume_source',{payload});
 assertOwner(owner,getOwner());
 if(error)throw Error('Source could not be replaced. Reload before retrying; your original file is kept.');
 return data;
}

// Same narrow references as the server transaction; used by isolated demo state.
export function remapResumePreferences(preferences,oldId,newId) {
 const next=structuredClone(preferences);
 if(next.defaultResumeId===oldId)next.defaultResumeId=newId;
 if(Array.isArray(next.resumeRules))next.resumeRules=next.resumeRules.map(rule=>rule.resumeId===oldId?{...rule,resumeId:newId}:rule);
 const escaped=oldId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 if(Array.isArray(next.profiles))next.profiles=next.profiles.map(profile=>{
  const previous=profile.instructions||'';
  const instructions=previous.replace(new RegExp('(- Default resume ID: *)'+escaped+'(\\s|$)','g'),(_,prefix,suffix)=>prefix+newId+suffix).replace(new RegExp('("resumeId"\\s*:\\s*")'+escaped+'(")','g'),(_,prefix,suffix)=>prefix+newId+suffix);
  return previous===instructions?profile:{...profile,instructions,version:(profile.version||0)+1};
 });
 return next;
}
