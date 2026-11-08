import {parseFitAnalysis} from '../lib/fit-analysis';
export default function RoleFitAnalysis({whyItFits = '', materialGap = ''}: {whyItFits?: string; materialGap?: string}) {
 const analysis = parseFitAnalysis(whyItFits, materialGap);
 if (analysis) return <div className="space-y-4">
  {analysis.intro && <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{analysis.intro}</p>}
  <ul aria-label="Role fit analysis" className="list-disc space-y-3 pl-5 text-sm leading-relaxed">
   {analysis.bullets.map(({label,text}) => <li key={label} className="max-w-prose whitespace-pre-line"><strong>{label}:</strong> {text}</li>)}
  </ul>
 </div>;
 return <div className="space-y-5">
  <div><h4 className="mb-2 text-sm font-semibold text-board-success">Why it’s here</h4><p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{whyItFits || 'No fit research collected yet.'}</p></div>
  {materialGap && <div><h4 className="mb-2 text-sm font-semibold text-board-warning">What needs a closer look</h4><p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-board-muted">{materialGap}</p></div>}
 </div>;
}
