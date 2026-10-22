'use client';
import { useState, type CSSProperties } from 'react';
import styles from './themes.module.css';

const themes = [
  { id: 'lookout', name: 'Lookout', category: 'Minimal', background: '#101a2b', panel: '#1b2940', ink: '#f4f2fa', muted: '#bcc8dc', accent: '#f3b8d7', description: 'The familiar midnight workspace, softened with cotton candy pink.' },
  { id: 'botanical', name: 'Botanical', category: 'Cozy', background: '#edf0e4', panel: '#fbfcf4', ink: '#283f30', muted: '#50694e', accent: '#45674b', description: 'Garden greens and warm paper for a quieter place to focus.' },
  { id: 'afterhours', name: 'After hours', category: 'Dark', background: '#211c30', panel: '#30283f', ink: '#f5eafc', muted: '#d0b8da', accent: '#e8b3f3', description: 'Plum surfaces and orchid accents for your late-night plans.' },
  { id: 'coast', name: 'Coast', category: 'Minimal', background: '#e6eff1', panel: '#f7fbfc', ink: '#203f4d', muted: '#4d6873', accent: '#22617a', description: 'Clear ocean blues with room to breathe.' },
  { id: 'peach', name: 'Peach paper', category: 'Pastel', background: '#f6e9e3', panel: '#fff8f1', ink: '#57372f', muted: '#805c50', accent: '#9b4d39', description: 'Soft peach, cream, and terracotta for a little everyday warmth.' },
  { id: 'graphite', name: 'Graphite', category: 'Dark', background: '#202426', panel: '#2e3437', ink: '#f0f4f2', muted: '#bac9c4', accent: '#b1dcc9', description: 'Charcoal and mint with a crisp, understated finish.' },
];
type Theme = typeof themes[number];
function palette(theme: Theme): CSSProperties { return { '--preview-bg': theme.background, '--preview-panel': theme.panel, '--preview-ink': theme.ink, '--preview-muted': theme.muted, '--preview-accent': theme.accent } as CSSProperties; }
function Preview({ theme, surface, small = false }: { theme: Theme; surface: string; small?: boolean }) {
  return <div className={`${styles.preview} ${small ? styles.thumbnail : ''}`} style={palette(theme)} aria-hidden={small || undefined}>
    <div className={styles.previewBar}><strong>Lookout</strong><span>{surface}</span><span className={styles.avatar}>JD</span></div>
    <div className={styles.previewBody}>
      <aside className={styles.previewNav}><b>{surface === 'Dashboard' ? 'Your workspace' : 'Your circle'}</b><span>{surface === 'Dashboard' ? 'Discover' : 'Clubhouse'}</span><span>{surface === 'Dashboard' ? 'Applications' : 'Conversations'}</span><span>{surface === 'Dashboard' ? 'Career Toolkit' : 'Knowledge'}</span></aside>
      <div className={styles.previewContent}><h2>{surface === 'Dashboard' ? 'Make your next move.' : 'Better, together.'}</h2><p>{surface === 'Dashboard' ? 'A little progress, every day.' : 'A place to share the next step.'}</p>
        <div className={styles.previewNote}><b>{surface === 'Dashboard' ? 'Your focus today' : 'The weekly check-in'}</b><p>{surface === 'Dashboard' ? 'Prepare for your next conversation.' : 'What helped you move forward this week?'}</p></div>
        <div className={styles.sampleGrid}>{(surface === 'Dashboard' ? ['Explore opportunities', 'Build your skills', 'Keep in touch'] : ['Interview prep', 'Something to celebrate', 'Resources we love']).map((title, i) => <div key={title} className={styles.sampleCard}><div className={styles.sampleArtwork}><svg viewBox="0 0 100 55" fill="none" aria-hidden="true"><path d={i === 0 ? 'M10 45 35 15 55 35 80 8' : i === 1 ? 'M15 40V20h20v20h20V10h25v30' : 'M15 15h70v28H15z M30 8v14 M70 8v14'} stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/></svg></div><b>{title}</b><p>{surface === 'Dashboard' ? 'Find your next step' : 'Start a conversation'}</p></div>)}</div>
      </div>
    </div>
  </div>;
}
export default function ThemeMarketplace() {
  const [surface, setSurface] = useState('Dashboard');
  const [selected, setSelected] = useState(themes[0]);
  const [collection, setCollection] = useState('Browse');
  const [saved, setSaved] = useState<string[]>([]);
  const results = themes.filter(t => collection === 'Browse' || saved.includes(t.id));
  return <section className={styles.marketplace}>
    <header className={styles.heading}><div><h1>Make yourself at home.</h1><p>Explore a new look for your Dashboard and Circles.</p></div><div className={styles.switcher} aria-label="Preview surface">{['Dashboard', 'Circles'].map(s => <button key={s} type="button" aria-pressed={surface === s} onClick={() => setSurface(s)}>{s}</button>)}</div></header>
    <div className={styles.layout}>
      <section className={styles.stage} aria-label={`${surface} theme preview`}><div className={styles.stageHeading}><h2>{surface} preview</h2><span>Fictional sample content</span></div><Preview theme={selected} surface={surface}/><div className={styles.selection}><div><h2>{selected.name}</h2><p>{selected.description}</p></div><button type="button" aria-pressed={saved.includes(selected.id)} onClick={() => setSaved(current => current.includes(selected.id) ? current.filter(id => id !== selected.id) : [...current, selected.id])}>{saved.includes(selected.id) ? 'Saved for this visit' : 'Save for this visit'}</button></div><p className={styles.previewHelp}>Theme concepts · Preview only. Your workspace appearance stays as it is.</p></section>
      <aside className={styles.gallery} aria-label="Theme marketplace"><div className={styles.switcher}>{['Browse', 'Saved'].map(tab => <button type="button" key={tab} aria-pressed={collection === tab} onClick={() => setCollection(tab)}>{tab}{tab === 'Saved' ? ` (${saved.length})` : ''}</button>)}</div><p className={styles.resultCount} aria-live="polite">{results.length} theme concepts for {surface}</p><div className={styles.themeGrid}>{results.map(theme => <button type="button" key={theme.id} className={styles.themeCard} aria-pressed={selected.id === theme.id} onClick={() => setSelected(theme)}><Preview theme={theme} surface={surface} small/><span className={styles.cardCaption}><strong>{theme.name}</strong><span>{selected.id === theme.id ? 'Previewing' : theme.category}</span></span></button>)}</div>{!results.length && <div className={styles.empty}><h2>Keep a few favorites.</h2><p>Save a theme from the preview to compare it here during this visit.</p><button type="button" onClick={() => setCollection('Browse')}>Browse all themes</button></div>}</aside>
    </div>
  </section>;
}
