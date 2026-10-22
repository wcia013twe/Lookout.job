import Link from 'next/link';
import { notFound } from 'next/navigation';
import { categories, skills, skillById } from '../_lib/catalog';
import AgentRequest from '../_components/agent-request';
import { ToolkitIcon } from '../_components/toolkit-icon';
import styles from '../toolkit.module.css';
export const dynamicParams = false;
export function generateStaticParams() { return skills.map(skill => ({skill:skill.id})); }
export async function generateMetadata({params}: {params:Promise<{skill:string}>}) {
  const skill = skillById((await params).skill);
  return {title:`${skill?.title || 'Skill'} · Career Toolkit · Lookout`,description:skill?.summary};
}
export default async function SkillManual({params}: {params:Promise<{skill:string}>}) {
  const skill = skillById((await params).skill);
  if (!skill) notFound();
  const category = categories.find(item => item.id === skill.category)!;
  return <div className={styles.surface}>
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/career-toolkit/">Career Toolkit</Link></nav>
    <header className={styles.skillOverview}><div className={styles.manualTitle}><ToolkitIcon name={category.id} size={28}/><h1>{skill.title}</h1></div><p>{skill.summary}</p></header>
    <section className={styles.skillDocument} aria-label="Skill document"><h2>Skill.md</h2><iframe title={`${skill.title} — Skill.md`} src={`/skill-documents/${skill.id}.html`} sandbox="allow-same-origin" /></section>
    <AgentRequest key={skill.id} skillId={skill.id}/>
  </div>;
}
