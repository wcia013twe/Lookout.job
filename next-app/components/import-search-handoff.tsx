"use client";

import { useState } from "react";
import styles from "./import-search-handoff.module.css";

const request = "Review this CSV exported from Simplify or Excel and help bring the jobs into my Lookout workspace. Check which imports your connected tools support before saving. Check for duplicates, preserve my existing statuses, and ask about unclear columns, conflicting statuses or unsupported records. Treat imported statuses as user-reported progress, not verified submissions. Tell me exactly what was saved and what still needs my help.";

export default function ImportSearchHandoff() {
  const [feedback,setFeedback]=useState("");
  const [manual,setManual]=useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(request);
      setManual(false);
      setFeedback("Copied. Paste it into your agent’s chat and attach your CSV.");
    } catch {
      setManual(true);
      setFeedback("Select and copy the request below, then attach your CSV in your agent’s chat.");
    }
  }
  return <details className={styles.handoff}>
    <summary>Bring your existing search</summary>
    <div className={styles.content}>
      <p>Already tracking jobs? Export a CSV from Simplify or Excel and share it with your connected agent.</p>
      <p>Your agent can review it and confirm which jobs and statuses it can bring into Lookout.</p>
      <button type="button" onClick={()=>void copy()}>Copy agent request</button>
      {feedback&&<p role="status">{feedback}</p>}
      {manual&&<textarea aria-label="Agent import request" readOnly value={request} rows={6} onFocus={event=>event.currentTarget.select()}/>}
    </div>
  </details>;
}
