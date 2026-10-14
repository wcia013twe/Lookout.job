import contract from './instructions.json' with { type: 'json' };
import outreachSkill from './skills/cold-outreach.json' with { type: 'json' };

// Developer instructions are deployed code/config; personal settings stay owner-scoped SQL.
export function contextResponse(operation, data) {
  if (operation === 'context.versions') return { personalVersion: data.personalVersion, developerVersion: contract.developerVersion };
  if (operation === 'context.developer') return structuredClone({ ...contract, skills: [outreachSkill] });
  return data;
}
