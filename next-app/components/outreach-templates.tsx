"use client";
import {useId, useState} from "react";
import OutreachFrame from "./outreach-frame";
import {OUTREACH_TAGS} from "../../lib/outreach-model.mjs";
import annotationStyles from "./annotated-message.module.css";
import styles from "./outreach-templates.module.css";
import OutreachExamples from "./outreach-examples";
import {control, secondary} from "./ui";
import library from "../../supabase/functions/agent-gateway/skills/outreach-templates.json";
const labels = ["Recruiter", "Existing connection", "Alumni", "Founder", "Followup"];

export default function OutreachTemplates({ initiallyOpen = false, carouselOnly = false, embedded = false, compact = false }: { initiallyOpen?: boolean; carouselOnly?: boolean; embedded?: boolean; compact?: boolean }) {
  const noteId=useId();
  const [activeTag,setActiveTag]=useState<string|null>(null);
  const [selected, setSelected] = useState(0);
  const [highlights,setHighlights]=useState(true);
  const template = library.templates[selected];
  const carousel = <section className={embedded?styles.embedded:styles.preview} aria-label="Outreach template preview" aria-roledescription="carousel">
    <header className={styles.toolbar}>
      <h3 className="text-sm font-semibold">Template preview</h3>
      <div className={styles.navigation}>
        <button type="button" className={secondary} aria-label="Previous outreach template" onClick={()=>setSelected(index=>(index+labels.length-1)%labels.length)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
        <label className="min-w-0"><span className="sr-only">Outreach template</span><select className={control} value={selected} onChange={event=>setSelected(Number(event.target.value))}>{labels.map((label,index)=><option key={label} value={index}>{label}</option>)}</select></label>
        <button type="button" className={secondary} aria-label="Next outreach template" onClick={()=>setSelected(index=>(index+1)%labels.length)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
      </div>
    </header>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{labels[selected]} · {selected+1} of {labels.length}</p>
    <p className="mb-4 text-sm"><span className="font-semibold">Subject: </span>{template.subject}</p>
    <OutreachFrame message={template.message} name={labels[selected]} highlights={highlights}/>
    <div className={styles.messageFooter}><p>Template preview · replace bracketed fields with verified details.</p><button type="button" className={secondary} aria-pressed={highlights} onClick={()=>setHighlights(!highlights)}>Highlights: {highlights?"On":"Off"}</button></div>
    {highlights&&<>
      <div className={styles.key} aria-label="Six-tag message key">{OUTREACH_TAGS.map(({kind}:{kind:string})=><button type="button" key={kind} className={annotationStyles.category} data-kind={kind} aria-pressed={activeTag===kind} aria-describedby={activeTag===kind?noteId:undefined} onClick={()=>setActiveTag(activeTag===kind?null:kind)}><span className={annotationStyles.swatch} aria-hidden="true"/>{kind}</button>)}</div>
      <p id={noteId} className={styles.keyHelp} role="status">{activeTag?`${activeTag}: ${OUTREACH_TAGS.find((tag:{kind:string})=>tag.kind===activeTag)?.description}`:"Select a label to see what it means."}</p>
    </>}

  </section>;
  if (carouselOnly) return carousel;
  return <details className={compact ? "border-t border-board-line py-4" : "mt-8 border-y border-board-line py-5"} open={initiallyOpen}>
    <summary className={compact ? "cursor-pointer py-2 text-sm font-medium text-board-muted hover:text-board-text" : "cursor-pointer text-lg font-bold"}>{compact ? "Browse outreach templates" : `Outreach templates · ${library.templates.length}`}</summary>
    <div className="mt-5">{carousel}</div>
    <OutreachExamples/>
  </details>;
}
