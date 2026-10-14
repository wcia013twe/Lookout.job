"use client";
import { timelineItems } from '../../lib/application-timeline.mjs';
import type { Application, ApplicationMilestone } from './workflow-types';
const phaseLabel = { scheduled: 'Scheduled', completed: 'Completed', received: 'Received' };
function dateLabel(value?: string | null) {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', ...(value.length === 10 ? { timeZone: 'UTC' } : {}) });
}
export default function ApplicationTimeline({ application, milestones, compact = false, demo = false }: { application: Application; milestones?: ApplicationMilestone[]; compact?: boolean; demo?: boolean }) {
  const items = timelineItems(application, milestones) as ApplicationMilestone[];
  if (!items.length) return <p className="mt-3 text-sm text-board-muted">No process milestones recorded yet.</p>;
  return <ol aria-label="Application timeline" className="mt-4">
    {items.map((item, index) => <li key={`${item.id}-${index}`} className={`relative pl-7 ${compact ? 'pb-4' : 'pb-6'} last:pb-0`}>
      {index < items.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[6px] top-3 w-px bg-board-line" />}
      <span aria-hidden="true" className={`absolute left-0 top-1 size-[13px] rounded-full border ${item.phase === 'completed' ? 'border-board-accent bg-board-accent' : 'border-board-accent bg-board-bg'}`} />
      <p className="break-words text-sm font-semibold">{item.label}</p>
      <p className="mt-1 text-xs tabular-nums text-board-muted">{phaseLabel[item.phase]} · {dateLabel(item.occurred_at)}</p>
      {item.source.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-board-muted">{item.source.note}</p>}
      {item.kind === 'application_submitted' && <p className="mt-1 text-xs text-board-muted">{item.observedConfirmation ? 'Employer confirmation observed' : item.source.kind === 'user' ? 'Reported by you' : 'Recorded submission update'}</p>}
      {item.source.kind === 'email' && <details className="mt-1 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-board-accent">Source email{item.source.subject ? `: ${item.source.subject}` : ''}</summary>
        <div className="max-w-prose space-y-2 text-sm leading-relaxed text-board-muted">
          <p className="whitespace-pre-wrap break-words">{item.source.excerpt || 'No supporting excerpt recorded.'}</p>
          <p className="break-all text-xs">Message reference: {item.source.messageId || 'Not recorded'}</p>
          {item.source.receivedAt && <p className="text-xs">Email received: {item.source.receivedAt}</p>}
          {item.source.url && (demo ? <p className="text-xs">Fictional demo email; external navigation is disabled.</p> : <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-board-accent underline underline-offset-4">Open source email</a>)}
        </div>
      </details>}
    </li>)}
  </ol>;
}
