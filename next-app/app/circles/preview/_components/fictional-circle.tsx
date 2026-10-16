'use client';

import {useCallback, useState} from 'react';
import Link from 'next/link';
import {createCircleKnowledgeDemo} from '../../../../../lib/circle-knowledge-demo.mjs';
import {secondary} from '../../../../components/ui';
import {KnowledgeSurface} from '../../_components/knowledge';
import type {Request} from '../../_lib/types';

function PreviewSession() {
  const [service] = useState(() => createCircleKnowledgeDemo());
  const request: Request = useCallback(async <Result,>(operation: string, payload: Record<string, unknown> = {}) => service.action(operation, payload) as Result, [service]);
  return <KnowledgeSurface request={request} demo/>;
}

export default function FictionalCircle() {
  const [epoch, setEpoch] = useState(0);
  function reset() {
    const url = new URL(location.href);
    url.searchParams.delete('circle');
    url.searchParams.delete('thread');
    history.replaceState(null, '', url);
    setEpoch(previous => previous + 1);
  }
  return <>
    <section aria-label="Fictional preview controls" className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-board-line pb-6">
      <div className="max-w-prose"><p className="text-lg font-bold">Fictional Circle preview</p><p className="mt-2 text-sm leading-relaxed text-board-muted">Start from Your circles: open a Circle, manage its settings, or create one. Join with demo-invite. Reset clears your changes and returns home. Inside a Circle, click a clubhouse companion to open their activity bubble; Alex has a longer update to explore. Try Escape or click outside to close it, and check the bottom sheet on mobile. Try the clubhouse’s Share activity switch, browse Experiences, and open a chat bubble. Review, share, or withdraw fictional contributions. Everything stays in this page’s memory; no account records are changed.</p></div>
      <div className="flex flex-wrap gap-3"><button className={secondary} onClick={reset}>Reset fictional Circle</button><Link className={secondary} href="/circles/">Back to Circles</Link></div>
    </section>
    <PreviewSession key={epoch}/>
  </>;
}
