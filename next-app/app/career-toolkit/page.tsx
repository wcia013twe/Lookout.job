import {Suspense} from 'react';
import ToolkitWorkspace from './_components/toolkit-workspace';
import styles from './toolkit.module.css';
export const metadata = { title: 'Career Toolkit · Lookout', description: 'Your saved prep, reading materials and career tools.' };
export default function CareerToolkitPage() {
  return <div className={styles.surface}>
    <header className={styles.heading}><h1>Career Toolkit</h1><p>Your workspace for weekly prep, useful reading, and the tools to move your career forward.</p></header>
    <Suspense fallback={<p>Loading workspace…</p>}><ToolkitWorkspace /></Suspense>
  </div>;
}
