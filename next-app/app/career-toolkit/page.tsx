import ToolkitLibrary from './_components/toolkit-library';
import styles from './toolkit.module.css';
export const metadata = { title: 'Career Toolkit · Lookout', description: 'Explore career skills and learn how to use them with your personal agent.' };
export default function CareerToolkitPage() {
  return <div className={styles.surface}>
    <header className={styles.heading}><h1>Career Toolkit</h1><p>Practical skills for every step of your career. Choose one to learn how to use it with your agent.</p></header>
    <ToolkitLibrary />
  </div>;
}
