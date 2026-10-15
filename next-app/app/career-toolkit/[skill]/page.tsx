import Link from 'next/link';
import { notFound } from 'next/navigation';
import { categories, skills, skillById } from '../_lib/catalog';
import AgentRequest from '../_components/agent-request';
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
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/career-toolkit/">Career Toolkit</Link><span aria-hidden="true">/</span><Link href={`/career-toolkit/#${category.id}`}>{category.title}</Link></nav>
    <header className={styles.manualHeading}><h1>{skill.title}</h1><p>{skill.summary}</p><a href="#use-with-agent">Use with your agent <span aria-hidden="true">↓</span></a></header>
    <div className={styles.manualLayout}><article className={styles.manual}>
      <section id="before-you-start"><h2>What you’ll need</h2><ul>{skill.inputs.map(input => <li key={input}>{input}</li>)}</ul><p>Use what you already have in Lookout. Your agent should ask for missing details rather than make you start again.</p></section>
      <section id="how-it-works"><h2>How it works</h2><ol className={styles.steps}>{skill.steps.map(step => <li key={step}>{step}</li>)}</ol></section>
      <section id="what-you-get"><h2>What you’ll get</h2><ul>{skill.outputs.map(output => <li key={output}>{output}</li>)}</ul></section>
      <section id="use-with-agent"><h2>Use with your agent</h2><p>Choose an example, adjust it to your situation, then copy it into your agent’s conversation.</p><AgentRequest key={skill.id} skillId={skill.id} examples={skill.examples}/></section>
      <section id="requirements"><h2>Tools &amp; setup</h2><p>{skill.requirements}</p>{skill.locales && <><h3>Language and market context</h3><p>Career Ops includes guidance for {skill.locales.join(', ')}. Tell your agent both where you want to search and which language you want to use.</p></>}<p className={styles.smallNote}>This manual provides instructions. Access to files, browsing, rendering, scheduling and connected services comes from your agent’s available tools.</p></section>
      <section className={styles.attribution}><h2>Adapted from Career Ops</h2><p>This skill reuses Career Ops’ open-source workflows with Lookout’s profile, applications and permission boundaries.</p><a href={skill.sourceUrl} target="_blank" rel="noreferrer">Read the original workflow <span aria-hidden="true">↗</span></a><p>MIT licensed · Source version 1.36.0 · Pinned revision c78e14c</p></section>
    </article><aside className={styles.manualSidebar}><nav aria-label="On this page"><h2>In this manual</h2><a href="#before-you-start">What you’ll need</a><a href="#how-it-works">How it works</a><a href="#what-you-get">What you’ll get</a><a href="#use-with-agent">Use with your agent</a><a href="#requirements">Tools &amp; setup</a></nav><div className={styles.related}><h2>Keep going</h2>{skill.related.map(id => {const related = skillById(id);return related && <Link key={id} href={`/career-toolkit/${id}/`} prefetch={false}>{related.title}<span aria-hidden="true">→</span></Link>;})}<Link href="/career-toolkit/">Browse all skills<span aria-hidden="true">→</span></Link></div></aside></div>
  </div>;
}
