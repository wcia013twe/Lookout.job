"use client";
export type Role = {
  id: string; company: string; title: string; employmentType: string;
  location: string; category: string; priority: string; postedDate?: string | null;
  description?: string; matchPreview?: MatchPreview; matchAssessment?: MatchPreview;
  fitLabel?: string; materialGap?: string; rankingProfile?: any; searchProfileId?: string; evaluatedProfileVersion?: number;
  postingObservation?: {checkedAt:string;liveness:string;postedAt:string|null;description:string};
  compensation?: string; workSetting?: string; sponsorship?: string;
  reviewPreview?: { question: string; answer: string; reason: string }[];
  discoveredDate: string; sourceFreshness: string; whyItFits: string; applicationUrl: string;
};
import {useWorkspace} from '../lib/workspace';
import DiscoveredRoleWidget from './discovered-role-widget';
import ApplicationActions from './application-actions';
import RoleJobFacts from './role-job-facts';
import RoleMatchPreview, {type MatchPreview} from './role-match-preview';
export {CompanyLogo} from './company-logo';

export default function RoleCard({role,onPreview}:{role:Role;onPreview?:(role:Role)=>void}) {
 const w=useWorkspace();
 const assessment=w.demo?role.matchPreview:role.matchAssessment;
 return <DiscoveredRoleWidget role={role} onPreview={onPreview?()=>onPreview(role):undefined}>
  <RoleJobFacts role={role} compact/>
  <p className="line-clamp-3 text-sm leading-relaxed text-board-muted">{role.whyItFits}</p>
  {onPreview?<details className="border-t border-board-line pt-1 text-sm">
   <summary className="min-h-11 cursor-pointer py-3 font-semibold text-board-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent">{typeof assessment?.percent==='number'?`${assessment.percent}% job match · View details`:'View match details'}</summary>
   <RoleMatchPreview sample={assessment} demo={w.demo}/>
  </details>:<details className="border-t border-board-line pt-1 text-sm">
   <summary className="flex min-h-11 cursor-pointer items-center text-board-accent">View analysis</summary>
   <p className="mt-3 leading-relaxed text-board-muted">{role.whyItFits}</p>
   <p className="mt-3 text-xs text-board-muted">{role.category} · Posted {role.postedDate||'Not listed'} · {role.sourceFreshness}</p>
  </details>}
  <ApplicationActions role={role} onPreview={onPreview}/>
 </DiscoveredRoleWidget>;
}
