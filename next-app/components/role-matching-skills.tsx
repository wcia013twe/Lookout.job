import {readMatchingSkills} from '../lib/fit-analysis';

export default function RoleMatchingSkills({whyItFits}: {whyItFits?: string}) {
 const skills = readMatchingSkills(whyItFits).skills;
 if (!skills.length) return null;
 return <div aria-label="Matching skills" className="break-words text-xs leading-relaxed text-board-muted">
  <span className="font-semibold text-board-accent">Matching skills: </span>{skills.join(' · ')}
 </div>;
}
