# Shared benchmark infrastructure

Measure whether Lookout improves, leaves unchanged or worsens quality, execution
time, observed human effort and cost. Keep these dimensions separate. A cleared
case has passed its declared execution/evidence gates. Design validity still
requires checking whether those gates and outcomes answer the intended question.

When reviewing a case, distinguish:

- **Testing goal:** the behavior and evidence the case is intended to measure.
  Prescribed prompts do not measure proactive human-effort savings.
- **Experimental-design limitation:** correctly executed cases still may not
  answer the intended question; scripted requests cannot establish proactivity,
  and correlated checklist items are not independent measures of quality.
- **Example/setup mismatch:** fixtures or conditions do not represent that goal,
  such as conflicting facts, invalid seeded records or incompatible business dates.
- **Harness defect:** execution or measurement distorts the comparison, such as
  missing native capabilities, unequal obligations, broken capture or timing.
- **Lookout defect:** evidence attributes a problem to product behavior under a
  valid setup and harness. A participant mistake alone is insufficient evidence.

Worse performance alone establishes no defect. Keep observed outcomes separate
from causal attribution; participant variability or an unsuitable experiment may
explain them. Do not force every miss into a product or harness repair.

Reuse existing infrastructure before copying a case. `workspace_transport.py`
provides authenticated HTTP-to-stdio transport for COM01–04 and JOB01–04. Their
small `transport.py` adapters specify the case bridge arguments; JOB02 retains
its graceful EOF shutdown; the shared JOB03/04 host retains stderr capture. New freezes bind the shared implementation as well as
the adapter. Keep old frozen checkouts unchanged; migrate only future setups.

COM01/COM02 reuse `scripts/communication/design.py` for primary outcome scoring
and serial, alternating-order pairs; their outcome partitions live in scenarios.

Shared timing/capture and diagnostics remain in `scripts/communication/`, cost
accounting in `scripts/n01/cost*`, and common result/export contracts here. These
are existing shared boundaries, not a claim that all case runners are unified.
Keep scenario evidence, release rules, specialized adapters and semantic grading
case-specific. Extract repeated execution mechanics when there is demonstrated
reuse; avoid a registry, plugin system or new workflow layer for its own sake.

Verification: `node --test tests/eval-transport.test.mjs` uses fictional local
workers and mocked preparation dependencies, without accounts or inference.

## Exact subscription-backed independent grading

`python3 scripts/evals/subscription_grader.py --evidence <sanitized-bundle-dir> --instructions <frozen-review-instructions.md> --output <new-grading-attempt-dir> --seconds <declared-budget> --expected-image-id <frozen-image-id>`

The owning chat invokes this once per independent review; it is not an orchestrator. It uses the existing `lookout-benchmark:0.164.0` container, subscription login, shared bounded stop/timing helpers and usage reader. The model is fixed to `gpt-5.6-terra` with `model_reasoning_effort=medium`; there is no override or substitution. Evidence is mounted at `/evidence` read-only, review output at `/workspace/output`, and the grader must write `review.json`. No product connection, account credentials, MCP server, host settings/history or participant session is supplied. Grading instructions go through stdin; the caller supplies the frozen rubric/template and local evidence bundle. Credential/private configuration files and symlinks in that bundle are rejected.

`grader-run.json` binds executor/instructions/evidence/image hashes, command, reference duration, timing, requested settings, observed model, usage, cleanup and output hash. The `--seconds` value is retained as a reference duration only; healthy grading has no hard task deadline. Elapsed time beyond it is recorded without invalidating a completed review. Individual setup/network/cleanup operations stay bounded, and the owning chat monitors actual execution health. A missing/different observed model, invalid timing, malformed/missing JSON or unconfirmed cleanup fails loudly. Reasoning effort is command evidence; the provider does not separately attest effort here. This executor only obtains a JSON review: the case's frozen deterministic grader must still validate its schema, evidence references and digest before accepting/exporting scores. Preserve failures; never correct semantic judgments with a different model. Output JSON and traces stay local. Live execution is a separate host-serialized check; unit tests use mocked Docker and never infer actual model access.

### Optional structural export provenance

Use `exportProvenance` from `scripts/evals/provenance.mjs`. Add an optional `provenance` object to the final case grade and common result before first export. COM01/02 detailed exporters and summary adapters carry it; the shared contract emits it in observation and experiment metadata. Other case exporters can use the same helper. Allowed nullable strings are `evaluationId`, `caseId`, `conditionOrder`, `participantModel`, `participantReasoning`, `graderModel`, `graderReasoning`, `participantFreezeDigest`, `graderFreezeDigest`, `graderEvidenceDigest`, `graderReceiptDigest`, `failureStatus`, `repairStatus`, `confoundStatus`, `usageCoverage`, and `exporterSourceDigest`; nullable boolean `timingValid` is also accepted. Values are short structural identifiers/hashes, never raw prose or arbitrary review objects. Unknown fields and unsafe strings are rejected. Preserve the bound final export record; do not mutate provenance after delivery.

After each pair's independent review validates, invoke its existing detailed exporter/`--verify`, then `scripts/evals/langfuse.mjs --record <final-common-result.json> --receipt-dir <receipts/common>` and the same command with `--verify`. Keep local artifacts/receipts on transport failure and retry delivery/verification only, boundedly; never rerun participants or regrade for upload errors. Unreviewed quality remains null. Reporting uses a separately recorded exporter hash when a historical participant freeze points to older reporting code.
