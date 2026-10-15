import type { ReactNode } from "react";
import styles from "./needs-you.module.css";

type RoleMeta = { company:string; roleTitle:string; roleType:string; date:string; status:string; workflow:string };
const tones = [styles.navy, styles.plum, styles.oxblood, styles.indigo];

export default function NeedsYouRow({sequence,title,context,reason,children,role}: {sequence:number;title:string;context:string;reason:string;children:ReactNode;role?:RoleMeta}) {
 const tone = tones[(sequence - 1) % tones.length];
 const cardContext = role ? `${role.company} · ${role.roleTitle}` : context;
 return <li className={`${styles.card} ${tone}`}>
  <div className={styles.meta}>
   <span aria-hidden="true" className={styles.sequence}>{String(sequence).padStart(2,"0")}</span>
   <span className={styles.context}>{cardContext}</span>
  </div>
  <div className={styles.copy}>
   <h2 className={styles.title}>{title}</h2>
   <p className={styles.reason}>{reason}</p>
   {role && <div className={styles.roleDetails}>
    <div className={styles.roleChips}><span>{role.roleType}</span><span>{role.date}</span><span>{role.status}</span></div>
    <span className={styles.workflow}>{role.workflow}</span>
   </div>}
  </div>
  <div className={styles.actions}>{children}</div>
 </li>;
}
