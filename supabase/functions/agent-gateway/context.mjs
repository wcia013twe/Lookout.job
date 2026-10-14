import contract from './instructions.json' with { type: 'json' };
import { guideIndex } from './guides.mjs';

// Developer instructions are deployed code/config; personal settings stay owner-scoped SQL.
export function contextResponse(operation, data) {
  if (operation === 'context.versions') return { personalVersion: data.personalVersion, developerVersion: contract.developerVersion };
  if (operation === 'context.developer') return structuredClone({ ...contract, guides: guideIndex() });
  return data;
}
