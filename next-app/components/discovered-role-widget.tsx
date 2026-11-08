"use client";
import type {ReactNode} from 'react';
import {CompanyLogo} from './company-logo';
import type {Role} from './role-card';
import styles from './discovered-role-widget.module.css';

/** An opportunity preview. Application progress belongs to the application widget. */
export default function DiscoveredRoleWidget({role,onPreview,children}:{role:Role;onPreview?:(role:Role)=>void;children:ReactNode}) {
 return <article className={styles.widget} data-discovered-role={role.id} aria-label={`${role.title} at ${role.company}`}>
  <header className={styles.header}>
   <CompanyLogo company={role.company}/>
   <p>{role.company}</p>
  </header>
  <h3 className={styles.title}>{onPreview?<button type="button" onClick={()=>onPreview(role)} aria-haspopup="dialog">{role.title}</button>:role.title}</h3>
  <div className={styles.content}>{children}</div>
 </article>;
}
