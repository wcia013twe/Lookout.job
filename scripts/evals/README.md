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
