import { VARIANTS, validateResume, uploadResume, resumeDownloadUrl } from './resume-model.mjs';
export { MAX_RESUME_BYTES, validateResume, sha256, assertOwner, uploadResume, resumeDownloadUrl } from './resume-model.mjs';

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
