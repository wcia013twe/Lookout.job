import library from "../../supabase/functions/agent-gateway/skills/outreach-templates.json";

export default function OutreachTemplates({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  return <details className="mt-8 border-y border-board-line py-5" open={initiallyOpen}>
    <summary className="cursor-pointer text-lg font-bold">Outreach templates · {library.templates.length}</summary>
    <p className="mt-3 max-w-prose text-sm leading-relaxed text-board-muted">Your agent uses the Nick Singh outreach skill to tailor these starting points to your experience, the person, and the role. Bracketed fields are filled before a draft is ready.</p>
    <div className="mt-5 divide-y divide-board-line">
      {library.templates.map(template => <details key={template.id} className="py-4">
        <summary className="cursor-pointer text-sm font-semibold">{template.name}</summary>
        <div className="mt-3 max-w-prose space-y-4 text-sm leading-relaxed">
          <p className="text-board-muted">{template.whenToUse}</p>
          <p><span className="font-semibold">Details needed: </span>{template.requiredEvidence.join("; ")}.</p>
          <p><span className="font-semibold">Email subject: </span>{template.subject}</p>
          <p className="whitespace-pre-line rounded-lg bg-board-panel p-4">{template.message}</p>
        </div>
      </details>)}
    </div>
    <p className="mt-4 text-xs leading-relaxed text-board-muted">Use Prepare with Muse to request personalized drafts. You review and send the final message.</p>
  </details>;
}
