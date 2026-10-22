import type { ReactNode } from 'react';
const paths: Record<string, ReactNode> = {
  folder: <><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></>,
  play: <><path d="m9 5 11 7-11 7Z"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  all: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  documents: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
  interviews: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10a9.5 9.5 0 0 1 19 0Z"/><path d="M7 10h9M7 14h6"/></>,
  outreach: <><circle cx="8" cy="7" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M17 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 5 5v1"/></>,
  growth: <><path d="M5 21v-6h4v6M10 21V9h4v12M15 21V3h4v18M3 21h18"/></>,
  offers: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a23 23 0 0 0 18 0M10 13v2h4v-2"/></>,
  automation: <><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/><path d="M12 8v4l3 2"/></>,
  book: <><path d="M12 5C9 3 6 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z"/><path d="M12 5v15"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3"/></>,
  check: <><path d="m8 12 3 3 6-7"/><path d="M20 11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></>,
  compare: <><path d="M9 3v18M15 3v18M3 7h6M15 7h6M3 17h6M15 17h6M6 4 3 7l3 3M18 14l3 3-3 3"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
};
export function ToolkitIcon({name,size=20}: {name:string;size?:number}) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.book}</svg>;
}
export function skillIcon(id: string, category: string) {
  if (id.includes('compare') || id.includes('calibrate')) return 'compare';
  if (id.includes('plan') || id.includes('recurring')) return 'calendar';
  if (id.includes('check') || id.includes('triage') || id.includes('evaluate')) return 'check';
  if (id === 'regional-search') return 'globe';
  return category;
}
