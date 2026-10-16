"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { OUTREACH_TAGS, outreachSentences } from "../../lib/outreach-model.mjs";
import styles from "./annotated-message.module.css";

type Annotation = { text: string; kind: string | null; start: number; end: number };
type Props = { contact: { message?: string; connection?: string; evidence?: string }; name: string; onChange: (message: string) => void };
const notes: Record<string, string> = Object.fromEntries(OUTREACH_TAGS.map(tag => [tag.kind, tag.note]));

export default function AnnotatedMessage({ contact, name, onChange }: Props) {
  const value = contact.message || "";
  const [selected, setSelected] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const noteId = useId();
  let offset = 0;
  const sentences: Annotation[] = outreachSentences(contact).map((sentence: { text: string; kind: string | null }) => {
    const start = offset; offset += sentence.text.length;
    return { ...sentence, start, end: offset };
  });
  const active = selected === null ? null : sentences.find(sentence => sentence.kind && selected >= sentence.start && selected < sentence.end);
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const resize = () => { element.style.height = "auto"; element.style.height = `${element.scrollHeight + 2}px`; };
    resize();
    // Observe width independently of the textarea's auto-sized height.
    const container = element.parentElement!;
    let width = container.clientWidth;
    const widthObserver = new ResizeObserver(() => { if (container.clientWidth !== width) { width = container.clientWidth; resize(); } });
    widthObserver.observe(container);
    return () => widthObserver.disconnect();
  }, [value]);
  function selectSentence() { if (input.current) setSelected(input.current.selectionStart); }
  return <div>
    <div className={styles.legend} aria-label="Six-tag message key">{OUTREACH_TAGS.map(({ kind, description }) => <span key={kind} className={styles.category} data-kind={kind}><span className={styles.swatch} aria-hidden="true"/><span><strong>{kind}</strong><span className={styles.keyDescription}>{description}</span></span></span>)}</div>
    <div className={styles.layout}>
    <div className={styles.editor}>
      <div ref={backdrop} className={styles.highlights} aria-hidden="true">{sentences.map((sentence, index) => sentence.kind
        ? <mark key={index} data-kind={sentence.kind} className={`${styles.category} ${active === sentence ? styles.active : ""}`}>{sentence.text}</mark>
        : <span key={index}>{sentence.text}</span>)}{"\n"}</div>
      <textarea ref={input} className={styles.input} name="message" aria-label={`Message for ${name}`} aria-describedby={noteId} value={value}
        placeholder="Paste your message from Muse here." spellCheck={false}
        onChange={event => { setSelected(null); onChange(event.target.value); }}
        onClick={selectSentence} onKeyUp={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) selectSentence(); }}
        onKeyDown={event => { if (event.key === "Escape") { setSelected(null); event.stopPropagation(); } }}
        onScroll={event => { if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop; }}/>
    </div>
    <aside id={noteId} data-kind={active?.kind || undefined} className={`${styles.note} ${styles.category}`} aria-label={active ? `${active.kind} note` : "Sentence note"}>
      {active ? <>
      <div className="flex items-center justify-between gap-3"><h4 className="inline-flex items-center gap-2 text-sm font-bold"><span className={styles.swatch} aria-hidden="true"/>{active.kind}</h4><button type="button" className="min-h-11 min-w-11 rounded-md text-board-muted hover:bg-board-tag hover:text-board-text" aria-label="Close sentence note" onClick={() => { setSelected(null); input.current?.focus(); }}><svg className="mx-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
      <p className="mt-2 text-sm leading-relaxed text-board-muted">{notes[active.kind!]}</p>
      </> : <p className={styles.empty}>Click a highlighted sentence to see its note.</p>}
    </aside>
    </div>
  </div>;
}
