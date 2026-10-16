"use client";
import { useState } from "react";
import { outreachDemoMessages } from "../lib/outreach-demo.mjs";
import AnnotatedMessage from "./annotated-message";
import { Notice, primary, secondary } from "./ui";

export default function OutreachExamples() {
  const [selected, setSelected] = useState(0);
  const [messages, setMessages] = useState(() => outreachDemoMessages.map(example => example.message));
  const [feedback, setFeedback] = useState("");
  const example = outreachDemoMessages[selected];
  return <section className="my-6 border-y border-board-line py-5" aria-labelledby="outreach-examples-heading">
    <h3 id="outreach-examples-heading" className="text-base font-bold">Try a demo message</h3>
    <p className="mt-2 text-sm text-board-muted">Fictional people, experience and timelines. Edits stay in this preview.</p>
    <div className="mt-4 flex flex-wrap gap-2">{outreachDemoMessages.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} className={selected === index ? primary : secondary} onClick={() => { setSelected(index); setFeedback(""); }}>{item.label}</button>)}</div>
    <AnnotatedMessage key={example.id} contact={{ ...example, message: messages[selected] }} name={example.name} onChange={message => { setMessages(previous => previous.map((value, index) => index === selected ? message : value)); setFeedback(""); }}/>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={primary} disabled={!messages[selected].trim()} onClick={async () => { try { await navigator.clipboard.writeText(messages[selected]); setFeedback("Example copied."); } catch { setFeedback("Select the text and copy it manually."); } }}>Copy example</button><button type="button" className={secondary} onClick={() => { setMessages(outreachDemoMessages.map(item => item.message)); setFeedback("Examples reset."); }}>Reset examples</button></div>
    <Notice>{feedback}</Notice>
  </section>;
}
