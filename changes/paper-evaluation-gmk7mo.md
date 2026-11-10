# Paper evaluation and infrastructure

Expanded paper.tex with implemented JOB01–04/COM01–04 case design, matched-intent controls, quality/time/effort/cost dimensions, local-first Langfuse capture and summary exports, testing layers, GCP provisioning/deployment boundaries, and bounded historical COM03/04 pilot evidence. Red author-input notes identify final campaign selection, missing verified results, cloud receipts, code archive reproducibility and video links. Compressed repeated motivation/design prose to preserve an eight-page, two-column report including references. No application or service behavior changes.

## Writing references consulted before drafting

- Abstract, contributions and conclusion: SWE-agent abstract/introduction; state the implemented contribution and bound the empirical claim. No invented improvement.
- Related work and JOB/COM design: SWE-bench evaluation procedure (Appendix A.4); use observable completion plus preservation checks. https://arxiv.org/html/2310.06770v3
- Implementation/testing/GCP: SWE-agent system design (§3) and reproducibility statement; name concrete interfaces and execution dependencies. https://arxiv.org/html/2405.15793v3
- Evaluation controls and dimensions: MLE-bench setup/metrics (§2.2–2.3); specify the artifact, resources and grading boundary. https://arxiv.org/html/2410.07095v1
- Langfuse: MLE-bench submission validation distinguishes validity from scoring; verified project docs supply the actual export semantics. https://langfuse.com/docs/evaluation/overview
- Pilot interpretation, limitations and planned work: MLE-bench limitations (§6) and SWE-agent interface ablations (§5.1); separate observed failures from causal conclusions and proposed experiments.

## Implementation evidence

Read OpenWiki startup/current-state, README, the eight scenario families' docs and harness references, docs/langfuse-evals.md, docs/langfuse-tracing.md, docs/eval-cost-accounting.md, scripts/evals/README.md, docs/communication-com03-com04-pilots.md, scripts/run-tests.mjs, tests/helpers/database.mjs, infra/gcp/main.tf, infra/gcp/compose.yaml, scripts/deploy-gcp.mjs and deployment change receipts. Wiki/generated-coverage boundaries were preserved; no product behavior changed, so OpenWiki behavior updates, demo changes or new MCP tools were unnecessary.

## Validation and limits

Installed locked root/frontend dependencies in the isolated checkout. npm run validate:data passed (158 roles); git diff --check passed. Nine focused Node tests passed across eval-transport, job01-grading and deploy-gcp (including the Python transport checks); the first sandboxed transport attempt failed to bind its local test listener and passed on authorized rerun. No full application suite, cloud deployment, actual participant run or hosted verification was performed for this prose-only change.

Tectonic compilation and final rendered-page inspection are recorded below. Only pre-existing/typographic underfull-box warnings; no missing references or overfull boxes. Private pilot evidence was not copied into the repository. GCP is described as provisionable infrastructure, not a proven live deployment. Pilot numbers are sourced to the retained public repository report and explicitly confounded; final campaign inclusion remains an author decision.

Final verification: Tectonic compiled eight letter-size, two-column pages including references. All eight rendered pages were inspected; figure, case table, citations and red author notes are readable with no clipping or overlap. PDF remains a temporary review artifact outside Git.

## Follow-up: research-paper framing and unfinished results

Removed all lecture/slide citations, the course-alignment paragraph, and the lecture-by-lecture design subsection. Retained concrete mechanisms in a shorter tool-feedback/context-retrieval subsection with a direct SWE-agent citation. Removed diagnostic pilot numbers, result interpretations, discussion conclusions and the conclusion section. Evaluation setup, test-case design, Langfuse, unit-testing and GCP descriptions remain; results/analysis/conclusions are explicitly deferred in an author-input note. Removed slide entries from the bibliography. Course relevance is conveyed through the implemented agent interface, context retrieval, persistent state and evaluation methods, without a checklist of course topics.

Before this revision, revisited SWE-agent system/interface writing and MLE-bench's separation of setup from results. The draft is intentionally shorter while results remain missing; no filler or forced eight-page padding is added. No service, UI, demo, MCP or OpenWiki behavior changed.

Follow-up validation: Tectonic compiled seven two-column pages; all seven rendered pages inspected without clipping or overlap. Catalog validation (158 roles) and git diff --check passed. Text search confirms no lecture, slide or course-mapping references remain in paper.tex. Prose-only follow-up: application tests not rerun.

## Follow-up: research prose and organization

Revised the manuscript throughout around the research question, system mechanisms, implementation, and proposed evaluation protocol. Consolidated repeated motivation and requirements; replaced contribution-label fragments and operator instructions with connected prose; merged overlapping tool/personalization descriptions; grouped related work by the problem it addresses. Outcome measures now specify the observation unit, evidence, and interpretation. Results and conclusions remain deferred; red author notes retain missing evidence. No new performance claims, slide references, experimental results, or application behavior were added.

Writing references revisited before revision: SWE-agent abstract, interface design and experimental setup; SWE-bench execution-based evaluation; MLE-bench setup, metrics and validity discussion. Rechecked the existing OSWorld 2.0, StateHarness, Always-On Agents and Kolab citations against their primary arXiv abstracts. Removed incidental benchmark statistics to emphasize the methodological relationship rather than accumulate leaderboard results. Source mechanisms and verification boundaries are unchanged from the preceding source-grounded pass.

Research-prose validation: Tectonic compiled six two-column pages; all rendered pages were reviewed, including the architecture figure moved beside the design section. Catalog validation (158 roles) and git diff --check passed. Only typographic underfull-box warnings remain. No application tests rerun for this prose-only change. The pre-existing untracked paper.pdf in main was preserved; the rebuilt review PDF is /private/tmp/paper.pdf.

## Follow-up: supporting stack, measured test count and README manual

Reduced GCP and Langfuse to a short technology-stack paragraph. Removed the dedicated deployment and Langfuse implementation subsections while retaining the evaluation's local evidence-capture requirements. Condensed implementation verification around the measured count: 1,323 Node-reported automated test cases, comprising unit, contract and database checks. The run at source d7af027c passed 1,317, skipped five and failed one existing database scenario with “Invalid human decision”; paper and README disclose the failure and do not claim an all-passing suite. No agent-performance results or conclusions added.

Added a setup-and-use manual at the front of README.md, covering an account-free demo, Node 24 and locked installs, pinned CLI v2 on PATH, local Google configuration, Supabase/Edge startup, optional Node API/worker and MCP tunnel, connection setup, workspace use, lifecycle commands, checks/build, paper compilation and troubleshooting. Retained existing detailed feature sections and their anchors; consolidated the older Run and validate section to point to the manual. Read Makefile, local-startup/local-frontend/live-main helpers, Edge env generation, config.toml, Compose, runtime/agent references, and current environment templates without reading populated secrets. Used the Supabase skill and official CLI/Google documentation; the current changelog confirms CLI v3 configuration incompatibilities, so the guide uses the repository-locked 2.122.0 rather than an unpinned global CLI.

No product behavior, demo fixture, schema, MCP authority or runtime changed. The manual documents existing behavior, so no generated OpenWiki refresh or new service tool is required. No local stack, Docker service, OAuth client or real account was started, changed or verified during this documentation pass. Existing unrelated edits and the user's untracked root PDF are preserved.

Final checks: full npm test completed with 1,317 passed / 1 failed / 5 skipped (1,323 total); the failure was observed before these documentation edits. All ten README-relevant agent-package checks pass after editing. Catalog validation passed (158 roles). Verified sixteen links in the new manual and parsed all eight shell blocks with bash -n without executing setup commands. Tectonic compiled six two-column pages and all six rendered pages were inspected; no clipping/overlap or unresolved citations. git diff --check passed. Generated Python bytecode from this run was removed only from the two previously clean task-local directories. The rebuilt PDF and test log remain under /private/tmp.
