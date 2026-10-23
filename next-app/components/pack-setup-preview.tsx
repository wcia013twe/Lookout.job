"use client";
import { useState } from "react";
import { secondary } from "./ui";
import styles from "./daily-drops.module.css";

export default function PackSetupPreview({title}:{title:string}) {
  const [open,setOpen]=useState(false);
  return <aside aria-label="Card pack preview" className="min-w-0 pt-2">
    <h3 className="font-semibold">Preview on Discover</h3>
    <p className="mt-1 text-sm leading-relaxed text-board-muted">Fictional example. Previewing does not save cards or change your progress.</p>
    <div className={styles.strip}>
      <div className={styles.header}>
        <div className={styles.info}>
          <h4 className={styles.title} style={{overflowWrap:"anywhere"}}>{title.trim()||"My discovery pack"}</h4>
          <div className={styles.banner}><strong>Sample day</strong><span>2 drops</span><span className={styles.newMarker}>2 new</span></div>
        </div>
        <button type="button" className={`${secondary} ${styles.packButton}`} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?"Close preview":"Preview cards"}</button>
      </div>
      <p className={styles.dropdownSummary}>Your agent’s finds, ready to review.</p>
      {open&&<div className={styles.full}>
        <div className={styles.rows}>
          {[["Example Compute","Backend Engineer","added","Verified employer link and a fit note would appear here."],["Example Data","Systems Internship","pending","Your agent can flag details that still need checking."]].map(([company,role,status,note])=><div className={styles.row} key={company}>
            <div className={styles.rowSummary}>
              <div className={styles.rowTitle}><strong>{company}</strong><span>{role}</span></div>
              <span className={styles.status} data-status={status}>{status}</span>
            </div>
            <div className={styles.rowDetails}><p className={styles.note}>{note}</p><p className={styles.meta}>Fictional opportunity · no application link</p></div>
          </div>)}
        </div>
      </div>}
    </div>
  </aside>;
}
