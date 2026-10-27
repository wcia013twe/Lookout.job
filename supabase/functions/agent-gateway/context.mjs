import {museChangeFeedResponse} from '../../../lib/muse-change-feed.mjs';
import contract from './instructions.json' with { type: 'json' };
import { guideIndex } from './guides.mjs';
import { circleKnowledgeResponse } from './circle-context.mjs';

// Developer instructions are deployed code/config; personal settings stay owner-scoped SQL.
export function contextResponse(operation, data) {
  if (operation === 'changes.read') return museChangeFeedResponse(data);
  if (operation === 'context.versions') return { personalVersion: data.personalVersion, developerVersion: contract.developerVersion };
  if (operation === 'context.developer') return structuredClone({ ...contract, guides: guideIndex() });
  return circleKnowledgeResponse(operation, data);
}
