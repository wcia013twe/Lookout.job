# Preserve employer compensation and pay periods in Discover

Existing jobs can now receive sourced employer pay through the existing private publication observation (`jobFacts.compensation`). Hourly, annual and monthly amounts remain verbatim; no annualization. Cards and card-pack exports use the observed value before catalog pay. Cards no longer extract pay from fit prose or salary benchmarks. Explicit undisclosed observations suppress stale catalog pay; omission retains legacy catalog values. No database migration, catalog overwrite, rating change or application change.

Search guide17/application guide19/developer contract124 document the existing scoped MCP writer. Fictional demo and tests cover pay periods, unknown pay and the distinction between known pay and unknown compensation fit.

Validation: final full suite 1,062 passed, 5 skipped; 38 focused publication/label/demo/guide checks passed, plus final 5 label checks and 6 generated-codec checks. Production frontend export passed, including TypeScript; 158 catalog roles validated; whitespace check passed. The initial full run found the stale generated search codec; it was regenerated before the passing final full run. After integrating newer local Action Board changes, 46 relevant checks and the integrated production export passed. Local API image lookout-node:pay-units and Edge were refreshed while preserving current runtime settings, worker image and volumes. Authenticated read-back verified developer124, search guide17, application guide19 and the publish_batch compensation schema. No real batch republished or hosted deployment.

Checkout: `/private/var/folders/rd/g5mh_z7s1g56b0dhk7_3xwv00000gn/T/lookout-features/discover-pay-units-Ljin3F/repo`; branch `codex/discover-pay-units-Ljin3F`.
