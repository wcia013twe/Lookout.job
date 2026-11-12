import {parseFitAnalysis, readMatchingSkills, type FitAnalysisBullet} from '../lib/fit-analysis';

const fitPanel = 'rounded-xl bg-[var(--role-preview-strength)] p-4';
const cautionPanel = 'rounded-xl bg-[var(--role-preview-caution)] p-4';
function AnalysisBullets({bullets, label}: {bullets: FitAnalysisBullet[]; label: string}) {
 return <ul aria-label={label} className="list-disc space-y-3 pl-5 text-sm leading-relaxed">
  {bullets.map(({label,text}) => <li key={label} className="max-w-prose whitespace-pre-line"><strong>{label}:</strong> {text}</li>)}
 </ul>;
}
export default function RoleFitAnalysis({whyItFits = '', materialGap = ''}: {whyItFits?: string; materialGap?: string}) {
 const analysis = parseFitAnalysis(whyItFits, materialGap);
 return <div className="space-y-4">
  <section aria-label="Why it’s here" className={fitPanel}>
   <h4 className="mb-2 text-sm font-semibold text-board-success">Why it’s here</h4>
   {analysis ? <>
    {analysis.intro && <p className="mb-3 max-w-prose whitespace-pre-line text-sm leading-relaxed">{analysis.intro}</p>}
    <AnalysisBullets bullets={analysis.bullets.slice(0,3)} label="Role fit analysis" />
   </> : <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{readMatchingSkills(whyItFits).narrative || 'No fit research collected yet.'}</p>}
  </section>
  {(analysis || materialGap) && <section aria-label="What to watch out for" className={cautionPanel}>
   <h4 className="mb-2 text-sm font-semibold text-board-warning">What to watch out for</h4>
   {analysis ? <AnalysisBullets bullets={analysis.bullets.slice(3)} label="Role fit cautions" /> : <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-board-muted">{materialGap}</p>}
  </section>}
 </div>;
}
