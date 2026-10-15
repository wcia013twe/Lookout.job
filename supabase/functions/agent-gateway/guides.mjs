import outreach from './skills/cold-outreach.json' with { type: 'json' };
import resume from './skills/resume-parse.json' with { type: 'json' };
import outreachTemplates from './skills/outreach-templates.json' with { type: 'json' };
import toolkit from './skills/career-toolkit.json' with { type: 'json' };
const guides = [...toolkit.guides, resume, { ...outreach, ...outreachTemplates, version: outreach.version, templateVersion: outreachTemplates.version }];
export function guideIndex() {
  return guides.map(({id, version, name, description, whenToUse}) => ({id, version, name, description, whenToUse}));
}
export function readGuide(id) {
  const guide = guides.find(guide => guide.id === id);
  return guide ? structuredClone(guide) : null;
}
// Use the existing context authorization transaction; no new credential path.
export async function guideDispatch(id, authorize) {
  const result = await authorize('context.developer', {});
  if (result.error) return result;
  const guide = readGuide(id);
  return guide ? {data: guide} : {error: {code: 'P0002'}};
}
