import {ASSESSMENT_DIMENSIONS,assessmentFactors} from '../../lib/job-assessment.mjs';
import type {MatchPreview} from './role-match-preview';
export default function ApplicationFitAssessment({assessment}:{assessment?:MatchPreview}){
 const saved=assessmentFactors(assessment);
 return <section className="application-overview-context" aria-label="Fit assessment">
  <h3>Fit assessment</h3>
  <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
   {ASSESSMENT_DIMENSIONS.map(([,label])=>{
    const factor=saved.find((item:{label:string})=>item.label===label);
    const value=factor?.value;
    return <div key={label}><dt className="text-sm text-board-muted">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{typeof value==='number'?`${value}/100`:'N/A'}</dd>{factor?.reason&&<details className="mt-1 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-board-accent">Reason</summary><p className="max-w-prose text-board-muted">{factor.reason}</p></details>}</div>;
   })}
  </dl>
 </section>;
}
