import BrandMark from "./brand-mark";
import ProfileIcon, { type ProfileIconName } from "./profile-icon";
import styles from "./landing-workflow.module.css";

const steps = [
  { title: "Connect", copy: "Bring your own agent. Free." },
  { title: "Ask", copy: "One message. Your next move." },
  { title: "Watch it work", copy: "See the progress. Step in when you want." },
];
const activity: { text: string; icon: ProfileIconName; pending?: boolean }[] = [
  { text: "Researched Google SWE opportunity", icon: "check" },
  { text: "Prepared Bloomberg interview brief", icon: "check" },
  { text: "Networking follow-up awaiting review", icon: "clock", pending: true },
];

/** Illustrative workflow only: no account data, controls or persistence. */
export default function LandingWorkflow() {
  return (
    <section className={styles.section} aria-labelledby="workflow-title">
      <h2 id="workflow-title">Your agent does the work.<br />You're always in control.</h2>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.title}>
            <div className={styles.stepTitle}><span aria-hidden="true">0{index + 1}</span><h3>{step.title}</h3></div>
            <p>{step.copy}</p>
          </li>
        ))}
      </ol>
      <div className={styles.workspace} aria-label="Illustrative Lookout workspace for Watch it work">
        <header className={styles.header}>
          <div className={styles.brand}><BrandMark /><strong>Lookout Workspace</strong></div>
          <span className={styles.example}>Example</span>
        </header>
        <div className={styles.body}>
          <dl className={styles.metrics}>
            <div><dt>Roles found</dt><dd>12</dd></div>
            <div><dt>Reviewed</dt><dd>4</dd></div>
            <div><dt>Need approval</dt><dd>2</dd></div>
          </dl>
          <div className={styles.activity}>
            <h3>Recent activity</h3>
            <ul>{activity.map(item => <li key={item.text} className={item.pending ? styles.pending : undefined}><ProfileIcon name={item.icon} /><span>{item.text}</span></li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}
