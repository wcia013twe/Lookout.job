# Clear completed profile setup flags

- Action Board hides the profile setup reminder and removes its extra action count once name, email and a current résumé are saved, including unverified saved profiles. Missing details and superseded-only résumés still prompt setup.
- Human profile verification and exact application approval guards remain enforced; this presentation fix introduces no new service or MCP action.
- Existing fictional demo fixtures cover saved-but-unverified setup; render coverage also exercises the empty/reset state without real account writes.
- Validation: 19 focused render, profile review, demo and application workflow tests passed; frontend typecheck and production static build passed; catalog validation passed (158 roles); git diff check passed.
- Limits: no authenticated hosted-account or browser visual smoke test; no push or deployment. SSD checkout/cache permissions required temporary storage for this task; frontend dependencies installed with network access after the sandbox install failed.
