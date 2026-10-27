import styles from "./landing-mascot.module.css";

/** Full-body idle pose from the existing Buddy motion study; only the eyes move. */
export default function LandingMascot({ className = "", paused = false }: { className?: string; paused?: boolean }) {
  return (
    <span className={`${styles.mascot} ${className}`} data-paused={paused || undefined} aria-hidden="true">
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/lookout-buddy-purple-idle.webp`}
        alt=""
        width={1536}
        height={1024}
        draggable={false}
        className={styles.artwork}
      />
      <svg className={styles.observationMarks} data-observation-marks viewBox="0 0 1536 1024" fill="none" focusable="false">
        <path d="m1184 164 28-72" stroke="#4fc4f4" />
        <path d="m1260 188 50-54" stroke="#b28af0" />
        <path d="m1312 246 66-25" stroke="#f58fbc" />
      </svg>
      <span className={`${styles.eye} ${styles.left}`}><span className={styles.sclera}><span className={styles.pupil} /></span></span>
      <span className={`${styles.eye} ${styles.right}`}><span className={styles.sclera}><span className={styles.pupil} /></span></span>
    </span>
  );
}
