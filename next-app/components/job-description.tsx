import styles from "./job-description.module.css";

export default function JobDescription({ description, url, demo = false }: { description?: string; url?: string; demo?: boolean }) {
  let source: URL | undefined;
  try { const parsed = new URL(url || ""); if (["https:", "http:"].includes(parsed.protocol)) source = parsed; } catch {}
  if (!description) return <p className={styles.empty}>Full description not collected. Open the employer posting to verify responsibilities, requirements and availability.</p>;
  return <div className={styles.excerpt}>
    <div className={styles.source}>{demo ? "Fictional demo description" : "From the job posting"}{!demo && source && <a href={source.href} target="_blank" rel="noopener noreferrer">{source.hostname} ↗</a>}</div>
    <blockquote className={styles.text}>{description}</blockquote>
  </div>;
}
