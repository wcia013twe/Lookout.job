import styles from './action-attention.module.css';

/** A passive indicator of pending human input. The owning decision clears it. */
export default function ActionAttention({count,compact=false}:{count:number;compact?:boolean}) {
 if(count<1)return null;
 const label=count===1?'1 action needs your input':`${count} actions need your input`;
 return <span className={styles.indicator} title={label}>
  <span className={styles.dot} aria-hidden="true"/>
  <span className={compact?'sr-only':undefined}>{label}</span>
 </span>;
}
