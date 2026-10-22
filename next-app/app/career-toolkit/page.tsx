import ToolkitLibrary from './_components/toolkit-library';
import styles from './toolkit.module.css';
export const metadata = { title: 'Career Toolkit · Lookout', description: 'Explore career workflows your connected agent can discover and use automatically.' };
export default function CareerToolkitPage() {
  return <div className={styles.surface}>
    <header className={styles.heading}><h1>Career Toolkit</h1><p>Practical workflows for every step of your career. Once Lookout is connected, describe what you need normally and your agent can choose the relevant workflows automatically.</p></header>
    <ToolkitLibrary />
  </div>;
}
