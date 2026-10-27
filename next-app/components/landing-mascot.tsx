import styles from "./landing-mascot.module.css";

/** The existing Buddy artwork, with only its eyes animated. No account state. */
export default function LandingMascot({ className = "", paused = false }: { className?: string; paused?: boolean }) {
  return (
    <span className={`${styles.mascot} ${className}`} data-paused={paused || undefined} aria-hidden="true">
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/lookout-mark.png`}
        alt=""
        width={192}
        height={128}
        draggable={false}
        className={styles.artwork}
      />
      <span className={`${styles.eye} ${styles.left}`}><span className={styles.sclera}><span className={styles.pupil} /></span></span>
      <span className={`${styles.eye} ${styles.right}`}><span className={styles.sclera}><span className={styles.pupil} /></span></span>
    </span>
  );
}
