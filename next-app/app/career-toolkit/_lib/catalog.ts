import data from '../../../../integrations/career-ops/catalog.json';
export type ToolkitCategory = { id: string; title: string; description: string };
export type ToolkitSkill = {
  id: string; guideId: string; version: number; category: string; title: string;
  summary: string; whenToUse: string; inputs: string[]; steps: string[]; outputs: string[];
  examples: string[]; requirements: string; sources: string[]; sourceUrl: string;
  related: string[]; locales?: string[];
};
export const categories: ToolkitCategory[] = data.categories;
// Profile background is maintained directly on My Profile.
// Keep the agent guide available without publishing a separate manual page.
export const skills: ToolkitSkill[] = data.skills
  .filter(skill => skill.id !== 'profile-interview')
  .map(skill => ({ ...skill, related: skill.related.filter(id => id !== 'profile-interview') }));
export const skillById = (id: string) => skills.find(skill => skill.id === id);
