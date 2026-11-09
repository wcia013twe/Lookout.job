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
