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
import DiscoveredRoleWidget,{SavedRoleTag} from './discovered-role-widget';
import {savedRoleLabel} from '../../lib/job-assessment.mjs';
import ApplicationActions from './application-actions';
import RoleJobFacts from './role-job-facts';
import {type MatchPreview} from './role-match-preview';
export {CompanyLogo} from './company-logo';

export default function RoleCard({role,onPreview}:{role:Role;onPreview?:(role:Role)=>void}) {
 const priorityWithType=savedRoleLabel(role)==='Strong Consider';
 return <DiscoveredRoleWidget hideSavedLabel={priorityWithType} role={role} onPreview={onPreview?()=>onPreview(role):undefined}>
  <RoleJobFacts role={role} priorityTag={priorityWithType?<SavedRoleTag role={role}/>:undefined}/>
  <ApplicationActions role={role} onPreview={onPreview}/>
 </DiscoveredRoleWidget>;
}
