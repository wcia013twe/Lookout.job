import styles from "./landing-mascot.module.css";

/** Full-body idle pose from the existing Buddy motion study; only the eyes move. */
export default function LandingMascot({ className = "", paused = false }: { className?: string; paused?: boolean }) {
  return (
    <span className={`${styles.mascot} ${className}`} data-paused={paused || undefined} aria-hidden="true">
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/lookout-buddy-idle.webp`}
        alt=""
        width={1536}
        height={1024}
        draggable={false}
        className={styles.artwork}
      />
      <span className={`${styles.eye} ${styles.left}`}><span className={styles.sclera}><span className={styles.pupil} /></span></span>
      <span className={`${styles.eye} ${styles.right}`}><span className={styles.sclera}><span className={styles.pupil} /></span></span>
    </span>
  );
}
