# Muse intelligence: local final gate

The local Node service exposes `read_demo_muse_intelligence` through the same HTTP/MCP operation. MCP initialization supplies the interpretation and silence instructions. It uses existing metadata retrieval and optional explicit graph expansion, with no embeddings, keyword ranking, new database or model calls inside the retrieval service.

## Actual flow

1. The host takes the canonical posting ID from application context, or its exact company and role when no posting ID exists. It supplies stage/date bounds only when relevant to the task. Do not let a model guess IDs or silently broaden scope.
2. The service filters currently permitted Circle posts before applying the result limit. Application milestones are personal context, never community discussion. The local account loader still only ingests the selected account's eligible authored posts; this is not global access.
3. Source fingerprints are rechecked. The packet contains up to ten seed reports, source revisions, dates, uncertainty and verified Circle navigation paths. Linked evidence is off by default; `expandLinks: true` follows existing bounded two-hop references. Related evidence can concern other contexts, so linkage alone does not establish relevance.
4. An empty packet reports `no_discussions` and `automaticAction: suppress`. Nonempty reports say `evidence_available` and `assess_usefulness`; retrieval does not decide semantic answerability.
5. The `enrichForMuse` host adapter skips interpretation entirely on an empty packet. Otherwise it calls the host's injected interpreter and passes the decision through `presentMuseInsight`. Automatic insufficient/empty results always have `message: null` and no citations. Direct requests receive a short scope-limited explanation. Useful output requires exact contiguous excerpts from actual packet reports. The adapter renders those excerpts with dates and source revisions/links; it does not deliver model-authored narrative claims. Errors remain errors, never an empty discussion result.

```js
import {backendClient} from '../backend/intelligence/mcp.ts';
import {enrichForMuse} from '../backend/intelligence/muse.ts';

const result = await enrichForMuse(backendClient(), {
  scope: {jobId: application.jobId, stage: 'OA'},
  question: 'What have candidates experienced in this OA?',
  mode: 'automatic',
}, async ({question, packet, instructions}) => {
  // Use the host's existing model. Interpret only the supplied evidence.
  // Return {status: 'useful' | 'insufficient', excerpts: [{id: reportNodeId, quote: exactInsightExcerpt}]}.
  return interpretWithExistingMuseModel({question, packet, instructions});
});
if (result.message !== null) displayInsight(result.message, result.citations);
```

This is an integration interface, not a bundled Muse runtime or a new scheduled task. Raw MCP clients can read the packet with initialization instructions; deterministic suppression requires the host adapter (or equivalent presentation logic). No hosted gateway capabilities or developer instructions were changed because this local tool is not deployed there. No installed Muse-host connection has been verified.

## Bloomberg proof

`tests/fixtures/muse-intelligence.mjs` reuses the fictional Bloomberg reports, assigning explicit fictional New York/London/old-cycle posting IDs. It excludes the synthetic reply because the actual account loader does not ingest replies. `tests/intelligence-muse.test.mjs` covers metadata scoping, private-progress exclusion, current-source checks, optional links, HTTP/MCP parity, source citations, unknown sources, errors and deterministic silence even when an interpreter emits unwanted text.

Run `npm run intelligence:evaluate-muse` with the existing root `OPENAI_API_KEY` for the opt-in model-backed fixture evaluation. `INTELLIGENCE_EVAL_MODEL` overrides its default `gpt-4.1-mini` interpreter. This uses the [Responses structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs), only fictional evidence, an ephemeral database and actual localhost HTTP/MCP transport. No model interpreter is installed into the retrieval service.

The first direct-tool model run confused missing answers with missing discussions and emitted unwanted automatic messages. A second prototype still dropped a supplied stage and used overbroad wording. Both artifacts are retained under `docs/evaluations/muse-intelligence-initial.json` and `muse-intelligence-agent-prototype.json`. These failures motivated deterministic host scoping, output suppression and citation checks rather than relying solely on prompt wording.

The gate verifies the local application-context → scoped evidence → interpretation → presentation flow. It does not certify every model's factual interpretation. Exact excerpts prevent invented narrative claims but can still omit important context. Relevance and excerpt selection remain model judgments, not guaranteed semantic correctness. No global sharing, counts, discussion groups, notification delivery, live Muse installation, automatic trigger or production website UI is enabled. Existing staging still needs clean-v4 re-ingestion.

## Final verification

All eight fixture cases passed through the host adapter → localhost MCP/HTTP → database → model interpretation → presentation flow. The final run used six model calls and zero embedding calls: the two empty scopes bypassed the model entirely. Useful OA/technical reports and differing formats returned source-exact excerpts; the rumor retained its explicit lack of confirmation; unknown deadlines abstained; automatic empty and insufficient output was null. Results are retained in `docs/evaluations/muse-intelligence-final.json`.

Manual review rejected an earlier narrative prototype despite its eight automated checks passing: it speculated about causes and continuing hiring. `muse-intelligence-narrative-prototype.json` preserves that failure. The final rendered excerpts were manually compared against the supplied reports. This closes the controlled local integration gate, not a live Muse-host deployment or a general accuracy benchmark.

## Platform connection

The platform now has a separate authenticated `read_interview_intelligence` operation and application Overview panel, implemented against current permitted published Circle revisions. Its evidence packet is compatible with `presentMuseInsight`; the local evaluation `read_demo_muse_intelligence` remains a separate development tool. See `docs/interview-intelligence-platform.md` for the shared human/Node authorization path and release limits.
