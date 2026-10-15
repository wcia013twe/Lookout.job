'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useWorkspace } from '../../../lib/workspace';
import { buildToolkitRequest } from '../../../../lib/career-toolkit.mjs';
import styles from '../toolkit.module.css';
type SavedApplication = {id:string;company:string;title:string};
export default function AgentRequest({skillId,examples}: {skillId:string;examples:string[]}) {
  const w = useWorkspace();
  const [example,setExample] = useState(0);
  const [applicationId,setApplicationId] = useState('');
  const [message,setMessage] = useState('');
  const [editedRequest,setEditedRequest] = useState<string | null>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const applications = Object.values(w.state?.workflow?.applications || {}).filter((value): value is SavedApplication => {
    const app = value as Partial<SavedApplication> | null;
    return Boolean(app && typeof app.id === 'string' && typeof app.company === 'string' && typeof app.title === 'string');
  });
  const application = applications.find(app => app.id === applicationId) || null;
  const generated = buildToolkitRequest(skillId,example,application,Boolean(w.demo));
  const prompt = editedRequest ?? generated;
  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setMessage(w.demo ? 'Fictional practice request copied. Paste it into your agent.' : 'Request copied. Paste it into your agent to begin.'); }
    catch { text.current?.focus(); text.current?.select(); setMessage('Automatic copying is unavailable. The request is selected; copy it using your browser or keyboard.'); }
  }
  return <div className={styles.agentRequest}>
    {w.demo && <p className={styles.demoNotice}>Demo mode: examples are fictional practice. No account changes or external actions.</p>}
    <fieldset className={styles.examples}><legend>Try asking</legend>{examples.map((value,index) => <label key={value}><input type="radio" name={`example-${skillId}`} checked={example === index} onChange={() => {setExample(index);setEditedRequest(null);setMessage('');}}/><span>“{value}”</span></label>)}</fieldset>
    {applications.length > 0 && <label className={styles.applicationPicker}>Use a saved application <span>(optional)</span><select value={application?.id || ''} onChange={event => {setApplicationId(event.target.value);setEditedRequest(null);setMessage('');}}><option value="">Choose in the conversation</option>{applications.map(app => <option key={app.id} value={app.id}>{app.company} — {app.title}</option>)}</select></label>}
    <label className={styles.promptLabel}>Your agent request<textarea ref={text} value={prompt} onChange={event => {setEditedRequest(event.target.value);setMessage('');}} rows={9} aria-describedby="request-help"/></label>
    <div className={styles.requestActions}><button type="button" onClick={copy}>Copy agent request</button><Link href="/profile/">Agent setup in Profile <span aria-hidden="true">↗</span></Link></div>
    <p id="request-help" className={styles.smallNote}>Copying prepares a request; it does not run the skill. To check your connection, open Profile → My agent. If your agent cannot load the guide, ask it to refresh its Lookout connection. The request also includes the original source.</p>
    <p role="status" aria-live="polite" className={styles.copyStatus}>{message}</p>
  </div>;
}
