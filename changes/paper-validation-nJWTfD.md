# Paper validation

Reviewed the user-provided paper against OpenWiki, current Muse routing contracts, SQL migration 20261108050816, runtime registration, and primary arXiv abstracts. Corrected paused application execution, host responsibility, consent and outcome boundaries; marked evaluation as proposed; fixed figure path and real LaTeX citations. Removed drafting comments and supplied discussion/limitations without fabricated results.

OpenWiki review limit: architecture/system-overview.md and docs/figures/lookout-architecture.md retain older active-runner descriptions. The newer operations/current-state.md and docs/discover-application-jobs.md document the pause; no generated wiki refresh was performed. The figure caption now discloses this historical path.

Validation: catalog validation and LaTeX compilation recorded below. Documentation only; no UI, service, MCP contract or demo behavior changed, so no demo fixture changes or application test suite were required. No hosted verification or employer action.

Checks passed: npm run validate:data (158 roles), git diff --check, Tectonic compilation to /private/tmp/paper.pdf (underfull-box typography warnings only). No visual PDF review performed. Dependency installs omitted for documentation-only edits; no dependency or application build change. Original untracked paper preserved at /private/tmp/lookout-paper-original-nJWTfD.tex.

## Course-alignment follow-up

Read all 84 slides from the user-supplied CAP 6938 lectures L15 (30), L16 (30), and L18 (24), retaining slide-numbered text only in /private/tmp. No private course deck is copied into the repository.

Added an explicit course-grounded design rationale, direct lecture/slide citations, a fictional worked cross-session correction, and mechanism-specific evaluation proposals. Connections are concrete: typed MCP actions and observations, progressive schema/guide loading, version-aware context recovery, current-record memory, structured handoffs and outcome verification. L18 motivates external/context knowledge updating with fixed model parameters, not a claim to implement continual-learning training. Multi-agent and ReAct analogies are bounded to host compatibility/structured handoffs rather than claimed algorithm implementations. Reliability uses pass^k separately from pass@k, plus trace checks; LongMemEval-inspired fixtures are not claimed benchmark results. Updated the human-coordination description for the current hidden Submission-card presentation.

Evidence checked: supabase/functions/agent-mcp/tool-surface.mjs; supabase/functions/agent-gateway/instructions.json; mcp/context-cache.mjs; tests/context-versions.test.mjs; tests/muse-workflow-context.test.mjs; tests/guides.test.mjs; docs/discover-application-jobs.md; lib/action-board.mjs; current OpenWiki operations notes. No product behavior or agent contract changed, so demo changes and a generated OpenWiki refresh are not applicable. All proposed experiments remain unrun.

Follow-up verification: all 43 existing focused tests passed across context-versions, mcp-tool-surface, muse-workflow-context and guides after installing locked root dependencies (the first attempt had one missing-js-yaml failure). Locked frontend dependencies were also installed per checkout workflow; no dependency files changed. npm run validate:data passed for 158 roles; git diff --check passed. Tectonic compiled seven pages, with underfull-box warnings only; all seven rendered PNGs were inspected and showed readable text/citations, intact figure and no clipping/overlap. PDF and slide extracts remain temporary under /private/tmp. No comparative agent experiment, real employer action, hosted deployment or full application suite was run for these prose-only edits.
