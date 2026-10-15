'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { categories, skills } from '../_lib/catalog';
import styles from '../toolkit.module.css';
export default function ToolkitLibrary() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const readHash = () => {
      const value = location.hash.slice(1);
      setCategory(categories.some(item => item.id === value) ? value : 'all');
    };
    readHash(); window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);
  const search = query.trim().toLocaleLowerCase();
  const matching = skills.filter(skill => (category === 'all' || skill.category === category) &&
    (!search || [skill.title,skill.summary,...skill.examples,...skill.inputs,...(skill.locales || [])].join(' ').toLocaleLowerCase().includes(search)));
  const visibleCategories = categories.filter(item => matching.some(skill => skill.category === item.id));
  const selected = categories.find(item => item.id === category);
  return <>
    <div className={styles.searchRow}><label className={styles.search}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span className="sr-only">Search skills</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="What would you like help with?" /></label><p>Built on <a href="https://github.com/career-ops-hq/career-ops" target="_blank" rel="noreferrer">Career Ops</a>. Made for your agent.</p></div>
    <div className={styles.library}>
      <aside className={styles.sidebar}><nav aria-label="Skill categories"><a href="#all" onClick={() => setCategory('all')} aria-current={category === 'all' ? 'true' : undefined}><span>All skills</span><span>{skills.length}</span></a>{categories.map(item => <a key={item.id} href={`#${item.id}`} onClick={() => setCategory(item.id)} aria-current={category === item.id ? 'true' : undefined}><span>{item.title}</span><span>{skills.filter(skill => skill.category === item.id).length}</span></a>)}</nav><div className={styles.sidebarNote}><h2>Start with a conversation</h2><p>Every skill includes examples you can copy to your agent. Use the profile and applications you already have in Lookout.</p><Link href="/career-toolkit/profile-interview/">Build on your experience <span aria-hidden="true">→</span></Link></div></aside>
      <div className={styles.results}><div className={styles.resultHeading}><h2>{selected?.title || 'Explore the skills'}</h2><p role="status" aria-live="polite">{matching.length} {matching.length === 1 ? 'skill' : 'skills'}{search ? ' found' : ''}</p></div>
        {!matching.length && <div className={styles.empty}><h3>No skills match this search</h3><p>Try a task like “resume,” “interview,” or “schedule,” or explore all categories.</p><button type="button" onClick={() => { setQuery(''); setCategory('all'); history.replaceState(null,'','#all'); }}>Clear search &amp; filters</button></div>}
        {visibleCategories.map(item => <section key={item.id} className={styles.group} aria-labelledby={`category-${item.id}`}><div className={styles.groupHeading}><h3 id={`category-${item.id}`}>{item.title}</h3><p>{item.description}</p></div><ul>{matching.filter(skill => skill.category === item.id).map(skill => <li key={skill.id}><Link href={`/career-toolkit/${skill.id}/`} className={styles.skillRow} prefetch={false}><span><h4>{skill.title}</h4><p>{skill.summary}</p></span><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></Link></li>)}</ul></section>)}
        <p className={styles.libraryFoot}>Choose a skill to read its manual. Nothing runs until you ask your agent.</p>
      </div>
    </div>
  </>;
}
