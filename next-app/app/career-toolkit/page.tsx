import {Suspense} from 'react';
import ToolkitWorkspace from './_components/toolkit-workspace';
import styles from './toolkit.module.css';
export const metadata = { title: 'Interview Prep · Lookout', description: 'Prepare by interview pipeline, reusable answers, and focused practice.' };
export default function CareerToolkitPage() {
  return <div className={styles.surface}>
    <Suspense fallback={<p>Loading workspace…</p>}><ToolkitWorkspace /></Suspense>
  </div>;
}
