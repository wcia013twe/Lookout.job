'use client';
import { useRef, useState } from 'react';
import { useWorkspace } from '../../../lib/workspace';
import { buildSkillInvocation } from '../../../../lib/career-toolkit.mjs';
import styles from '../toolkit.module.css';
export default function AgentRequest({skillId}: {skillId:string}) {
  const w = useWorkspace();
  const [message,setMessage] = useState('');
  const [fallback,setFallback] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);
  const prompt = buildSkillInvocation(skillId,Boolean(w.demo));
  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setFallback(false); setMessage('Copied. Paste it into your agent to invoke this skill.'); }
    catch { setFallback(true); setMessage('Copying is unavailable. Select and copy the request below.'); }
  }
  return <div className={styles.skillInvocation}>
    <div className={styles.requestActions}><button type="button" onClick={copy} title="Copy the invocation to paste into your agent">Use Skill</button></div>
    <p role="status" aria-live="polite" className={styles.copyStatus}>{message}</p>
    {fallback && <label className={styles.promptLabel}>Skill invocation<textarea ref={text} readOnly value={prompt} rows={6} onFocus={event => event.target.select()} autoFocus /></label>}
  </div>;
}
