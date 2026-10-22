"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import ProfileIcon from "./profile-icon";
import { ProfileCard } from "./profile-section";
import { useWorkspace } from "../lib/workspace";
import { uploadResume, resumeDownloadUrl, validateResume } from "../../lib/resume-model.mjs";
import { control, primary, secondary, Field, Notice } from "./ui";
import { errorMessage, type ResumeRecord } from "./profile-types";
type ResumeForm = HTMLFormElement & {
  elements: HTMLFormControlsCollection & {
    variant: HTMLSelectElement;
    name: HTMLSelectElement;
    file: HTMLInputElement;
    url: HTMLInputElement;
  };
};
const variants = [
  "Backend",
  "Distributed Systems",
  "ML Infrastructure",
  "Master",
];
export default function Resumes({onAssign,children,assignments={}}:{onAssign?:(resumeId:string)=>void;children?:ReactNode;assignments?:Record<string,string[]>}) {
  const w = useWorkspace(),
    resumes: ResumeRecord[] = w.state.workflow.resumes || [];
  const [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const [adding,setAdding]=useState(false),[source,setSource]=useState("file");
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as ResumeForm;
    setBusy(true);
    try {
      if(w.demo){
        const file=form.elements.file.files?.[0],variant=form.elements.variant.value;
        const {extension}=validateResume(file,variant);
        const id=crypto.randomUUID();
        w.store.update("workflow.resumes",(items:ResumeRecord[])=>[...items,{id,name:file!.name,variant,version:1,objectPath:`demo/${id}.${extension}`}]);
        form.reset();setAdding(false);onAssign?.(id);setFeedback("Demo resume added in memory. File bytes were not uploaded or saved.");return;
      }
      if (!w.user || !window.JB.cloud.ready)
        throw Error("Sign in and wait for your account to connect first.");
      const variant = form.elements.variant.value;
      const version =
        1 +
        Math.max(
          0,
          ...resumes
            .filter((r) => r.variant === variant)
            .map((r) => Number(r.version) || 1),
        );
      const row = await uploadResume({
        client: w.client,
        getOwner: () => window.JB.auth.userId,
        file: form.elements.file.files?.[0],
        variant,
        version,
      });
      w.store.update("workflow.resumes", (v: ResumeRecord[]) => [
        ...v,
        {
          id: row.id,
          name: row.name,
          variant: row.variant,
          version: row.version,
          objectPath: row.object_path,
          contentHash: row.content_hash,
          url: "",
        },
      ]);
      form.reset();
      setAdding(false);onAssign?.(row.id);
      setFeedback(
        "Private resume uploaded. Select it when reviewing an application.",
      );
    } catch (e) {
      setFeedback(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function reference(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as ResumeForm;
    const url = form.elements.url.value.trim();
    if (!(w.user ? /^https:\/\// : /^https?:\/\//).test(url)) {
      setFeedback("Use an HTTPS resume URL.");
      return;
    }
    const id=crypto.randomUUID();
    w.store.update("workflow.resumes", (v: ResumeRecord[]) => [
      ...v,
      {
        id,
        name: form.elements.name.value,
        variant: form.elements.name.value,
        url,
        version: 1,
      },
    ]);
    form.reset();
    setAdding(false);onAssign?.(id);
    setFeedback("Resume reference saved.");
  }
  async function open(r: ResumeRecord) {
    if (w.demo) {
      setFeedback("Private files are unavailable in demo mode.");
      return;
    }
    const popup = window.open("about:blank", "_blank");
    try {
      if (popup) popup.opener = null;
      const url = await resumeDownloadUrl({
        client: w.client,
        getOwner: () => window.JB.auth.userId,
        resume: r,
      });
      if (popup) popup.location.replace(url);
      else setFeedback("Allow pop-ups, then open the resume again.");
    } catch (e) {
      popup?.close();
      setFeedback(errorMessage(e));
    }
  }
  return (
    <ProfileCard title="Resumes" icon="file" actions={<button type="button" className={secondary} disabled={busy||w.locked} aria-expanded={adding} onClick={()=>{setAdding(!adding);setSource("file");}}> {adding?"Cancel":"Add resume"}</button>}>
      {!resumes.length && (
        <p className="mt-6 border-t border-board-line pt-5 text-sm text-board-muted">
          No resume variants saved yet.
        </p>
      )}
      <ul className="mt-5 divide-y divide-board-line">
        {resumes.map((r) => (
          <li
            className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={r.id}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3"><ProfileIcon name="file" width={20} height={20} className="mt-1 shrink-0 text-board-muted"/><div className="min-w-0"><strong className="break-words">
              {r.name}{" "}
              <small className="text-board-muted">v{r.version || 1}</small>
            </strong><p className="mt-1 text-xs text-board-muted">{assignments[r.id]?.join(" · ") || "No roles assigned in this profile"}</p></div></div>
            <div className="flex flex-wrap gap-2">
            {onAssign&&<button type="button" className={secondary} disabled={w.locked} onClick={()=>onAssign(r.id)}>Assign roles</button>}
            {w.demo ? <button type="button" className={secondary} disabled title="Demo files have no PDF attached">Preview</button> : r.objectPath ? (
              <button className={secondary} onClick={() => open(r)}>
                Preview
              </button>
            ) : (
              <a
                className={secondary}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview
              </a>
            )}
            </div>
          </li>
        ))}
      </ul>
      {adding&&<div className="mt-5 border-t border-board-line pt-5">
        <Field label="Resume source"><select className={`${control} mb-5`} value={source} disabled={busy} onChange={e=>setSource(e.target.value)}><option value="file">Upload a file</option><option value="link">Use a document link</option></select></Field>
        {source === "link" && <>
        <form
          onSubmit={reference}
          className="grid items-end gap-4 sm:grid-cols-2"
        >
          <Field label="Variant">
            <select name="name" className={control}>
              {variants.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Resume link">
            <input
              name="url"
              className={control}
              type="url"
              placeholder="https://…"
              required
            />
          </Field>
          <button className={secondary}>Add reference</button>
        </form>
        <p className="mt-3 text-xs text-board-muted">Use a direct PDF link for a PDF preview. Other document links open their saved destination.</p></>}
        {source === "file" && <>
        <form
          onSubmit={upload}
          className="grid items-end gap-4 sm:grid-cols-2"
        >
          <Field label="Private resume file (PDF or DOCX, up to 10 MB)">
            <input
              className={control}
              type="file"
              name="file"
              accept=".pdf,.docx"
              required
              disabled={(!w.user && !w.demo) || busy}
            />
          </Field>
          <Field label="File variant">
            <select className={control} name="variant">
              {variants.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <button className={primary} disabled={(!w.user && !w.demo) || busy}>
            {busy ? "Uploading…" : "Upload private resume"}
          </button>
        </form>
        </>}
        {!w.user && !w.demo && (
          <Notice>
            Sign in to upload private resume files. You can save references in
            this browser.
          </Notice>
        )}
      </div>}
      {children}
      <Notice>{feedback}</Notice>
    </ProfileCard>
  );
}
