"use client";
import type {ReactNode} from 'react';
import {savedRoleLabel} from '../../lib/job-assessment.mjs';
import {CompanyLogo} from './company-logo';
import type {Role} from './role-card';
import styles from './discovered-role-widget.module.css';

/** An opportunity preview. Application progress belongs to the application widget. */
export default function DiscoveredRoleWidget({role,onPreview,children,compact=false}:{role:Pick<Role,'id'|'company'|'title'> & Partial<Pick<Role,'priority'|'fitLabel'>>;onPreview?:()=>void;children?:ReactNode;compact?:boolean}) {
 return <article className={styles.widget} data-discovered-role={role.id} data-compact={compact} aria-label={`${role.title} at ${role.company}`}>
  <header className={styles.header}>
   <CompanyLogo company={role.company}/>
   <div className={styles.identity}>
    <h3 className={styles.title}>{onPreview?<button type="button" onClick={onPreview} aria-haspopup="dialog">{role.title}</button>:role.title}</h3>
    <p>{role.company}</p>
   </div>
   {savedRoleLabel(role)&&<span className={styles.savedLabel} title="Saved assessment label">{savedRoleLabel(role)}</span>}
  </header>
  {children&&<div className={styles.content}>{children}</div>}
 </article>;
}
