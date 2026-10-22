"use client";
import {useState} from "react";
import OutreachFrame from "./outreach-frame";
import {OUTREACH_TAGS} from "../../lib/outreach-model.mjs";
import annotationStyles from "./annotated-message.module.css";
import styles from "./outreach-templates.module.css";
import OutreachExamples from "./outreach-examples";
import {secondary} from "./ui";
import library from "../../supabase/functions/agent-gateway/skills/outreach-templates.json";
const labels = ["Recruiter", "Existing connection", "Alumni", "Founder", "Followup"];

export default function OutreachTemplates({ initiallyOpen = false, carouselOnly = false }: { initiallyOpen?: boolean; carouselOnly?: boolean }) {
  const [selected, setSelected] = useState(0);
  const [highlights,setHighlights]=useState(true);
  const template = library.templates[selected];
  const carousel = <section className={styles.preview} aria-label="Outreach template preview" aria-roledescription="carousel">
    <header className="mb-5 flex items-center justify-between gap-3">
      <button type="button" className={secondary} aria-label="Previous outreach template" onClick={() => setSelected(index => (index + labels.length - 1) % labels.length)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
      <div className="min-w-0 text-center" aria-live="polite" aria-atomic="true"><h3 className="text-lg font-semibold">{labels[selected]}</h3><p className="mt-1 text-xs text-board-muted">{selected + 1} of {labels.length}</p></div>
      <button type="button" className={secondary} aria-label="Next outreach template" onClick={() => setSelected(index => (index + 1) % labels.length)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
    </header>
    <p className="mb-4 text-sm leading-relaxed text-board-muted">{template.whenToUse}</p>
    <p className="mb-4 text-sm"><span className="font-semibold">Subject: </span>{template.subject}</p>
    <div className="mb-4 flex items-center justify-between gap-3"><span className="text-xs text-board-muted">Message preview</span><button type="button" className={secondary} aria-pressed={highlights} onClick={()=>setHighlights(!highlights)}>Highlights: {highlights ? "On" : "Off"}</button></div>
    <OutreachFrame message={template.message} name={labels[selected]} highlights={highlights}/>
    {highlights && <div className={`${annotationStyles.legend} ${styles.key}`} aria-label="Six-tag message key">{OUTREACH_TAGS.map(({kind,description}:{kind:string;description:string})=><span key={kind} className={annotationStyles.category} data-kind={kind}><span className={annotationStyles.swatch} aria-hidden="true"/><span><strong>{kind}</strong><span className={annotationStyles.keyDescription}>{description}</span></span></span>)}</div>}
    <p className="mt-5 text-xs leading-relaxed text-board-muted">Template preview. Replace bracketed fields with verified details before sending. Writing settings guide your agent’s personalized draft.</p>
  </section>;
  if (carouselOnly) return carousel;
  return <details className="mt-8 border-y border-board-line py-5" open={initiallyOpen}>
    <summary className="cursor-pointer text-lg font-bold">Outreach templates · {library.templates.length}</summary>
    <div className="mt-5">{carousel}</div>
    <OutreachExamples/>
  </details>;
}
