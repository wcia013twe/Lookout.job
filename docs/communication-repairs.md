# Communication benchmark repairs

## Confirmed failure and ownership

The COM1-stream-v3 pilot exposed a **local Lookout activation mismatch**, not missing field support in source. `save_contact` advertised `nextAction` and `relationshipUpdates`; local `private.company_previous_extended` still had the old allowlist. Migration `20261103224016_network_person_cards.sql` was absent. The existing additive migration was applied atomically to local Supabase, without resetting personal records. Hosted deployment is not implied.

| Repair | Owner | COM1 | COM2 | COM3 | COM4 |
|---|---|---|---|---|---|
| Person-card writer activation | Local Lookout runtime | Fixed | Fixed | Fixed | Fixed |
| Scoped writer probe before inference; rollback all writes | Shared harness | Added | Added | Added | Added |
| Retained released emails, distinct current/repeated deliveries | Harness | Added | Already present | Already present | Already present |
| Observable onboarding; legitimate status transitions; material history | Grader | Corrected | Existing equivalent | Existing equivalent | Existing equivalent |
| Post-terminal read-only native verification and saved-file evidence | Grader | Upgraded | Existing | Existing | Existing |
| Initial profile/preferences/answers parity | Harness | Expanded full readable context | Existing verified parity | Existing verified parity | Existing verified parity |
| Introduction-interest actor answer after evidence release | Actor | Fixed | Case-specific | Case-specific | Case-specific |
| Structural token deltas, frozen cost policy, grade and Langfuse cost summaries | Harness / telemetry | Preserved | Added parity | Added parity | Added parity |
| Discovery/read/write/question/control/failure/retry counts | Shared telemetry | Added | Added | Added | Added |
| Stable message identity, existing drafts, bounded recovery and grounded preparation | Lookout guide | General guidance | General guidance | General guidance | General guidance |

No harness silently deduplicates participant work, repairs their saves or coaches them mid-run. Repeat deliveries remain visible; avoiding duplicate drafts remains a measured outcome. Guide changes contain no case names or grading answers. A conversational draft after a failed save remains explicitly unsaved.

## Prospective versions

COM1-stream-v5 / COM1-grade-v4 (8 turns); COM2-stream-v4 / COM2-grade-v3 (13); COM3-stream-v2 / COM3-grade-v2 (10); COM4-stream-v3 / COM4-grade-v2 (12). Previous frozen checkouts, datasets and pilot scores are retained. Create fresh private roots with each `prepare.py`; do not edit old freeze hashes. The shared diagnostics, product guidance and person-card migration are included in new freezes.

COM1 now needs a dedicated `grader.private.json`. `scripts/n01/provision_grader.py <verified-COM1-account-root>` issues only `workspace:read`, checking the existing fictional local owner. Never issue into a frozen historical root; copy the setup into a new private account preparation root and retain the shared account lock.

The writer preflight uses the actual scoped database dispatch with the account credential, creates a fictional probe in a transaction, checks owner and saved fields, and rolls back. A missing migration or incompatible writer stops before inference. It does not replace MCP connectivity checks or certify every tool. It neither resets accounts nor changes unrelated data.

## Accounting and interpretation

Tool categories are mutually exclusive. Failure and retry metrics overlap those categories. Exact retries mean the same tool and argument fingerprint after a failed response in a stage. Calls to the same tool after failure are a broader recovery indicator, not proof of wasted effort. MCP initialize/list/ping controls are separate. Unanswered tool requests remain explicit. Shell work remains part of observable steps; local-file operations and native tools are not interchangeable units.

COM1-v3 retrospective diagnostic only: 31 discovery/guide calls, 36 reads, 11 writes, one question; six rejected writes; two exact retries and four later same-tool calls after failure. These do not replace the original frozen grade. Shared numeric metrics flow through existing detailed Langfuse root scores without uploading raw context or argument fingerprints.

## Verification limits

Focused harness/guide checks, rolled-back writer probes and a native writer/readback smoke establish implementation contracts. Fresh paired participant runs are needed to assess quality, duplicate handling and actual overhead after repairs. Final reconciliation cannot erase earlier checkpoint failures. Baseline final-report.md is valid persistent storage; chat-only claims are not. Grade final saved state against both pre-final and terminal evidence.

## Consistent setup tools

Use one entry point for all four cases (COM01–04 aliases accepted):

```sh
python3 scripts/communication/setup.py --case COM01 \
  --source /absolute/verified-case-account \
  --background /absolute/baseline-kit \
  --destination /absolute/new-case-root \
  --preflight-output /absolute/new-preflight-root
```

Optional `--cost-policy /absolute/policy.json` is identical for all cases. The default records usage without guessing prices. Setup validates owner/grader identity, subscription-only Terra medium isolation, first-message-only context, persistent resume and baseline notes, common native tools, frozen product versions, cost policy and account locks; then runs the actual case preflight. It never launches participants, resets accounts, fixes participant outcomes or overwrites old setups. The receipt provides the case-specific run, grade, summary and export entry points with the same argument conventions. COM3 adds fixed-source search/read tools to both conditions; applications and artifact tools differ only where the case needs them.

Cost is the fourth dimension, separate from quality, active time and effort. All four runners use the existing structural counter-delta implementation. Missing counters/prices are unknown, subscription use is not an API invoice, and tool-call counts are not dollar costs. Resumed counters are subtracted once; reasoning-token subsets are not added again. Synthetic full-path tests cover per-case grading, detailed Langfuse and common summary exports. Actual participant counter capture still awaits a run.

## Local verification completed

- Local API `lookout-node:communication-repairs-156` is healthy and returns developer156 / cold-outreach10. Existing worker preserved; no hosted deployment.
- All four owners passed scoped, rolled-back extended-field writer checks. COM4 actual MCP save/readback passed for nextAction, relationshipUpdates and drafts; fictional fixtures restored.
- Shared setup passed for COM1/2/3/4, including live read-only grader ownership, frozen guidance, actual tool discovery, subscription login and isolation. No participant inference was run.
- 44 focused checks passed (including per-case cost exports), and 158 catalog roles validated. The full suite initially reported 1202 passes, five skips and three failures; the two changed-contract failures were corrected and reverified. The unmodified connected-decision database scenario still reported Invalid human decision. Do not describe the full suite as green.
- Separate Langfuse datasets for COM1-v5, COM2-v4, COM3-v2 and COM4-v3 were registered and read back; no pilot scores were overwritten.
- Authoritative private setups are `com1-repaired-v5-r2`, `com2-repaired-v4-r2`, `com3-repaired-v2-r2`, `com4-repaired-v3-r2` under the existing experiment-control directory. Earlier preparation attempts remain retained and superseded.
