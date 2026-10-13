// Private files are immutable versions. A new upload gets a new object and row;
// existing application approvals therefore keep referring to their exact bytes.
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const VARIANTS = ['Backend', 'Distributed Systems', 'ML Infrastructure', 'Master'];

export function validateResume(file, variant) {
  const extension = file?.name?.split('.').pop().toLowerCase();
  if (!TYPES[extension] || (file.type && file.type !== TYPES[extension])) throw Error('Choose a PDF or DOCX resume.');
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_RESUME_BYTES) throw Error('Resume files must be between 1 byte and 10 MB.');
  if (!VARIANTS.includes(variant)) throw Error('Choose a resume variant.');
  return { extension, contentType: TYPES[extension] };
}

export async function sha256(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function assertOwner(expected, current) {
  if (!expected || current !== expected) throw Error('Account changed. Choose the file again in your current account.');
}

// getOwner is checked around every asynchronous boundary. Supabase RLS remains
// authoritative even if a session changes between the check and the request.
export async function uploadResume({ client, getOwner, file, variant, version = 1 }) {
  const { extension, contentType } = validateResume(file, variant);
  const owner = getOwner(), check = () => assertOwner(owner, getOwner());
  check();
  const contentHash = await sha256(file);
  check();
  const id = crypto.randomUUID(), objectPath = `${owner}/${id}.${extension}`;
  const storage = client.storage.from('resumes');
  const uploaded = await storage.upload(objectPath, file, { contentType, upsert: false });
  if (uploaded.error) throw Error('Resume upload failed. Check your connection and try again.');
  let metadataSaved = false;
  try {
    check();
    const { data, error } = await client.from('resumes').insert({
      id, user_id: owner, name: file.name, variant, version,
      object_path: objectPath, reference_url: null, content_hash: contentHash
    }).select().single();
    if (error) throw Error('Resume details could not save. Try uploading again.');
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
  if (!resume.objectPath?.startsWith(`${owner}/`)) throw Error('This resume belongs to another account.');
  const { data, error } = await client.storage.from('resumes').createSignedUrl(resume.objectPath, 60);
  assertOwner(owner, getOwner());
  if (error || !data?.signedUrl) throw Error('Could not open the resume. Try again.');
  return data.signedUrl;
}

function mountResumeFiles() {
  const referenceForm = document.querySelector('#resume-form');
  if (!referenceForm || !window.JB) return;
  const form = document.createElement('form');
  form.id = 'resume-upload-form';
  form.className = 'workflow-form resume-upload-form';
  form.innerHTML = `<label>Variant<select name="variant">${VARIANTS.map(v => `<option>${v}</option>`).join('')}</select></label>
    <label>Private resume file<input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required></label>
    <button type="submit">Upload private resume</button>
    <p class="panel-note workflow-wide">PDF or DOCX, up to 10 MB. Each upload creates a new private version.</p>
    <p class="workflow-wide" role="status" aria-live="polite" data-upload-status></p>`;
  referenceForm.after(form);
  const status = form.querySelector('[data-upload-status]');
  const getOwner = () => JB.auth?.userId;
  let busy = false, accountGeneration = 0;
  function refresh() {
    form.querySelector('button').disabled = busy || !getOwner() || !JB.cloud?.ready;
    if (!busy) status.textContent = !getOwner() ? 'Sign in to store private resume files. Resume links remain available locally.' : !JB.cloud?.ready ? 'Waiting for your account to connect.' : '';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !getOwner() || !JB.cloud?.ready) return;
    const owner = getOwner(), generation = accountGeneration, variant = form.elements.variant.value;
    const operationOwner = () => generation === accountGeneration ? getOwner() : null;
    const version = Math.max(0, ...(JB.store.get('workflow.resumes') || []).filter(r => r.variant === variant).map(r => Number(r.version) || 1)) + 1;
    busy = true;
    refresh();
    status.textContent = 'Uploading private resume…';
    try {
      const row = await uploadResume({ client: JB.auth.client, getOwner: operationOwner, file: form.elements.file.files[0], variant, version });
      assertOwner(owner, operationOwner());
      JB.store.set('workflow.resumes', [...(JB.store.get('workflow.resumes') || []), {
        id: row.id, name: row.name, variant: row.variant, version: row.version,
        objectPath: row.object_path, contentHash: row.content_hash, url: ''
      }]);
      form.reset();
      status.textContent = 'Private resume uploaded. Select it when reviewing an application.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      form.querySelector('button').disabled = !getOwner() || !JB.cloud?.ready;
    }
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-open-resume]');
    if (!button) return;
    const resume = (JB.store.get('workflow.resumes') || []).find(r => r.id === button.dataset.openResume);
    if (!resume) return;
    // Open from the trusted click before awaiting a signed URL, including iOS.
    const generation = accountGeneration;
    const operationOwner = () => generation === accountGeneration ? getOwner() : null;
    const preview = window.open('about:blank', '_blank');
    if (preview) preview.opener = null;
    button.disabled = true;
    try {
      const url = await resumeDownloadUrl({ client: JB.auth.client, getOwner: operationOwner, resume });
      if (preview) preview.location.replace(url);
      else status.textContent = 'Allow pop-ups, then press Open private resume again.';
    } catch (error) {
      preview?.close();
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  document.addEventListener('workspace:account', () => {
    ++accountGeneration;
    form.reset();
    refresh();
  });
  document.addEventListener('workspace:hydrated', refresh);
  document.addEventListener('workspace:cloud-ready', refresh);
  JB.store.subscribe('workflow', refresh);
  refresh();
}

if (typeof document !== 'undefined') mountResumeFiles();
