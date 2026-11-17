import RoleMatchPreview from './role-match-preview';
import type {MatchPreview} from './role-match-preview';
export default function ApplicationFitAssessment({assessment,demo=false}:{assessment?:MatchPreview;demo?:boolean}){
 return <div className="application-overview-context"><RoleMatchPreview sample={assessment} demo={demo} expanded /></div>;
}
