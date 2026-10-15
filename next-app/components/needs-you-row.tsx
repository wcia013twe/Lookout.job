import type { ReactNode } from "react";
import styles from "./needs-you.module.css";

const tones = [styles.navy, styles.plum, styles.oxblood, styles.indigo];

export default function NeedsYouRow({sequence,title,context,reason,children}: {sequence:number;title:string;context:string;reason:string;children:ReactNode}) {
 const tone = tones[(sequence - 1) % tones.length];
 return <li className={`${styles.card} ${tone}`}>
  <div className={styles.meta}>
   <span aria-hidden="true" className={styles.sequence}>{String(sequence).padStart(2,"0")}</span>
   <span className={styles.context}>{context}</span>
  </div>
  <div className={styles.copy}>
   <h2 className={styles.title}>{title}</h2>
   <p className={styles.reason}>{reason}</p>
  </div>
  <div className={styles.actions}>{children}</div>
 </li>;
}
