'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { categories, skills } from '../_lib/catalog';
import { ToolkitIcon, skillIcon } from './toolkit-icon';
import styles from '../toolkit.module.css';
export default function ToolkitLibrary() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const readHash = () => {
      const value = location.hash.slice(1);
      setCategory(categories.some(item => item.id === value) ? value : 'all');
    };
    readHash(); window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);
  function selectCategory(id: string, focusResults = false) {
    setCategory(id); history.pushState(null,'',`#${id}`);
    if (focusResults) requestAnimationFrame(() => {
      resultHeading.current?.focus({preventScroll:true});
      resultHeading.current?.scrollIntoView({block:'start'});
    });
  }
  const search = query.trim().toLocaleLowerCase();
  const matching = skills.filter(skill => (category === 'all' || skill.category === category) &&
    (!search || [skill.title,skill.summary,...skill.examples,...skill.inputs,...(skill.locales || [])].join(' ').toLocaleLowerCase().includes(search)));
  const visibleCategories = categories.filter(item => matching.some(skill => skill.category === item.id));
  const selected = categories.find(item => item.id === category);
  const overview = category === 'all' && !search;
  const SkillHeading = overview || !selected ? 'h4' : 'h3';
  return <>
    <div className={styles.searchRow}><label className={styles.search}><ToolkitIcon name="search"/><span className="sr-only">Search skills</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search skills, like resume or interview…" /></label></div>
    <div className={styles.library}>
      <aside className={styles.sidebar}>
        <div className={styles.mobileCategory}><label htmlFor="toolkit-category">Category</label><select id="toolkit-category" value={category} onChange={event => selectCategory(event.target.value)}><option value="all">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
        <nav className={styles.categoryNav} aria-label="Skill categories"><a href="#all" onClick={() => setCategory('all')} aria-current={category === 'all' ? 'true' : undefined}><ToolkitIcon name="all"/><span>Overview</span><span>{skills.length}</span></a>{categories.map(item => <a key={item.id} href={`#${item.id}`} onClick={() => setCategory(item.id)} aria-current={category === item.id ? 'true' : undefined}><ToolkitIcon name={item.id}/><span>{item.title}</span><span>{skills.filter(skill => skill.category === item.id).length}</span></a>)}</nav>
      </aside>
      <div className={styles.results}>
        <div className={styles.resultHeading}><div><h2 ref={resultHeading} tabIndex={-1}>{selected?.title || (search ? 'Search results' : 'Browse by category')}</h2>{selected && <p className={styles.categoryDescription}>{selected.description}</p>}</div><p role="status" aria-live="polite">{overview ? `${categories.length} categories · ${skills.length} skills` : `${matching.length} ${matching.length === 1 ? 'skill' : 'skills'}${search ? ' found' : ''}`}</p></div>
        {!matching.length && <div className={styles.empty}><h3>No skills match this search</h3><p>Try a task like “resume,” “interview,” or “schedule,” or explore all categories.</p><button type="button" onClick={() => { setQuery(''); selectCategory('all'); }}>Clear search &amp; filters</button></div>}
        <div className={overview ? styles.overviewGrid : undefined}>{visibleCategories.map(item => {
          const groupSkills = matching.filter(skill => skill.category === item.id);
          const shown = overview ? groupSkills.slice(0,2) : groupSkills;
          return <section key={item.id} className={`${styles.group} ${overview ? styles.overviewGroup : ''}`} aria-label={item.title}>
            {(overview || !selected) && <div className={styles.groupHeading}><span className={styles.categorySymbol}><ToolkitIcon name={item.id} size={22}/></span><div><h3>{item.title}</h3><p>{item.description}</p></div></div>}
            <ul>{shown.map(skill => <li key={skill.id}><Link href={`/career-toolkit/${skill.id}/`} className={`${styles.skillRow} ${overview ? styles.compactRow : ''}`} prefetch={false}><span className={styles.skillSymbol}><ToolkitIcon name={skillIcon(skill.id,skill.category)} size={18}/></span><div className={styles.skillText}><SkillHeading>{skill.title}</SkillHeading>{!overview && <p>{skill.summary}</p>}</div><ToolkitIcon name="chevron" size={16}/></Link></li>)}</ul>
            {overview && <a className={styles.viewCategory} href={`#${item.id}`} aria-label={`View all ${item.title.toLowerCase()} skills`} onClick={event => {event.preventDefault();selectCategory(item.id,true);}}>View all {groupSkills.length} skills <span aria-hidden="true">→</span></a>}
          </section>;
        })}</div>
        <p className={styles.libraryFoot}><ToolkitIcon name="book" size={17}/><span>Every skill includes a guide and examples to use with your agent.</span></p>
      </div>
    </div>
  </>;
}
