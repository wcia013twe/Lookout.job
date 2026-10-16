import catalog from '../integrations/career-ops/catalog.json' with { type: 'json' };
export const toolkitCategories = catalog.categories;
export const toolkitSkills = catalog.skills;
export function findToolkitSkill(id) { return toolkitSkills.find(skill => skill.id === id) || null; }
// Copy-only handoff. No personal facts, credentials, private URLs or execution flags.
/** @param {string} id @param {number} [exampleIndex] @param {{company:string,title:string}|null} [application] @param {boolean} [demo] */
export function buildToolkitRequest(id, exampleIndex = 0, application = null, demo = false) {
  const skill = findToolkitSkill(id);
  if (!skill) throw Error('Unknown Career Toolkit skill');
  const example = skill.examples[Number.isInteger(exampleIndex) ? exampleIndex : 0] || skill.examples[0];
  const context = application && typeof application.company === 'string' && typeof application.title === 'string'
    ? `\nUse my saved Lookout application: ${application.company.slice(0,200)} — ${application.title.slice(0,300)}. Match it in my owned workspace before using it; ask me if ambiguous.` : '';
  return `${demo ? 'Fictional practice only. Do not access real accounts or files, send messages, create schedules or submit applications.\n\n' : ''}${example}${context}\n\nLoad the Lookout guide with read_guide({"id":"${skill.guideId}"}) if available. ${skill.tools?.length ? `Use the executable MCP tools when available: ${skill.tools.join(", ")}. If missing, explain that the local Lookout runner needs updating and a restart; a manual alone does not execute code. ` : ""}Check my current profile, preferences and relevant application context through available Lookout tools. Ask only for missing information and confirm which capabilities your runtime supports. If the guide is unavailable, explain what needs to be updated in my Lookout connection before continuing. Preserve Lookout permissions and data boundaries. Do not install software, create schedules or send anything merely to demonstrate this skill.`;
}
