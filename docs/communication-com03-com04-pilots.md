# PILOT03 / PILOT04: controlled communication results

Completed November 9, 2026. These are two harness-clearing pairs, not measured population estimates. Both participants finished before independent semantic review for their case. No coaching, hints, participant retries or product repairs occurred during execution. No Lookout product changes are included in this pass; the recommendations below are flags for a later feature pass.

## Comparison and results

Both conditions received the same task intent, released evidence, resume and prescribed turns. Storage orientation differs: baseline persistent files versus native Lookout records. Lookout retained its scoped native startup/default tools and on-demand discovery. All actual discovery, reads, writes, failures and verification count toward product usage. Scheduled initiation was disabled. Each case used the requested subscription-backed `gpt-5.6-terra`, medium; no paid API inference or model substitution.

| Pair / condition | Checkpoints completed | Semantic checks passed | Active minutes | Input / cached / output tokens | MCP calls / observable steps |
|---|---:|---:|---:|---:|---:|
| PILOT03 baseline | 10/10 | 5/8 | 5.35 | 708,368 / 615,680 / 10,488 | 35 / 61 |
| PILOT03 Lookout | 10/10 | 3/8 | 12.99 | 3,827,229 / 3,508,480 / 23,819 | 149 / 159 |
| PILOT04 baseline | 12/12 | 13/14 | 6.03 | 736,139 / 643,584 / 11,818 | 8 / 44 |
| PILOT04 Lookout | 12/12 | 12/14 | 9.65 | 2,914,087 / 2,612,736 / 18,782 | 115 / 133 |

No trajectory passed every semantic check. Lookout took 2.43× and 1.60× baseline active time, respectively, and reported 5.40× and 3.96× input tokens. Cached tokens are included in input, not additive. Subscription dollar cost is unknown, not zero; token ratios are not dollar-cost ratios. Wall durations were 331.00/790.14 seconds for PILOT03 and 377.01/592.94 for PILOT04 (baseline/Lookout).

PILOT03 baseline missed the exact user-reported sent-message history and temporarily left an obsolete reconnect draft saved after a reply. Lookout retained that message and reply, but failed to reconcile two active contact suggestions after the user limited outreach to one additional person. That same unresolved constraint affects selection, boundaries, continuity and final usefulness: four rubric failures do not represent four independent harms. Lookout also selected a contact before any successful source lookup at the initial discovery checkpoint. Its later successful research did not erase that earlier failure.

PILOT04 both conditions ended with accurate saved state and reports. Baseline left the meeting confirmation in chat until final reconciliation; the final report explicitly superseded stale notes, which the frozen rubric permits. Lookout saved the promised date one turn late and left a linked person's obsolete next action until final reconciliation. Final-state success is distinct from earlier checkpoint failure.

Effort is mixed and narrowly observable. Both conditions had 10 prescribed turns in PILOT03; baseline additionally made one unanswered clarification demand and Lookout none. Both had 12 prescribed turns and the same one availability clarification in PILOT04. These are scripted interactions, not measured cognitive effort. This experiment cannot establish reduced proactive user effort.

## Lookout changes flagged, not applied

1. **Expose a complete typed company-record schema and actionable validation errors.** Four COM03 `save_company_workspace` calls failed. The advertised `record` schema is only an object; it does not expose the required nested fields, types or priority enum. Payloads included unsupported priorities, array fields where strings were required and null dates. Generic rejection instructions did not disclose the necessary correction. The relevant sources are `supabase/functions/agent-gateway/platform-tools.mjs` and `supabase/migrations/20261022060633_durable_company_hub.sql`. A valid preflight payload had succeeded, so this is not evidence of a missing migration. Keep backend validation; improve its discoverable contract and errors. The participant eventually saved a research artifact and correctly reported that no company workspace existed.
2. **Reconcile constraints and current next actions across linked records.** On a narrowed contact cap, keep prior alternatives explicitly historical rather than leaving parallel send actions active. On a resolved introduction or confirmed meeting, retire linked current actions consistently. COM03's cap omission and COM04's stale linked action support this flag. Baseline also had stale-state failures; the proposed change is a product improvement hypothesis, not proof of a Lookout-only problem.
3. **Make newly reported commitments durable at their checkpoint.** COM04's promise date was omitted on arrival and recovered one turn later. Review the save-and-verify procedure so responsible person, promised date, provenance and unresolved obligation survive together. Do not enforce a benchmark-specific representation or erase valid history.
4. **Investigate discovery/context volume.** Lookout made 59 discovery calls in COM03 and 33 in COM04. Consider compact contextual discovery and version-aware reuse where safe. The evidence establishes incurred overhead, not how much is avoidable or whether smaller discovery preserves quality. Native instructions must not be removed from the benchmark to manufacture an improvement.

## Startup, discovery and harness findings

| Case / condition | Startup response seconds / bytes | Discovery response seconds / bytes | Task-response seconds / bytes |
|---|---:|---:|---:|
| COM03 baseline | 0.0012 / 15,240 | 0 / 0 | 0.0194 / 36,923 |
| COM03 Lookout | 0.3199 / 100,290 | 1.1162 / 611,203 | 1.9595 / 397,187 |
| COM04 baseline | 0.0014 / 10,668 | 0 / 0 | 0.0026 / 3,816 |
| COM04 Lookout | 0.4633 / 92,232 | 1.0405 / 427,817 | 2.6918 / 570,256 |

These are cumulative MCP response timings within total execution, not additional model processing time. Bytes are response payloads, not tokens. Observable steps include other participant actions and must not be added to MCP calls.

- Initial COM03 source search requested limit 20 despite the advertised maximum 10. The bridge's opaque `ValueError` is a harness diagnostic weakness; the invalid request is a participant error, not a Lookout backend failure. Improve future diagnostics symmetrically without coaching this run.
- COM04's initial change-feed read was denied by the allowed-scope wrapper. This is an isolation/native-startup interaction, not evidence that the product service is broken. It remains counted in usage and is a residual limitation of the controlled surface.
- Final COM04 score readback exceeded the exporter's first-page limit of 100. Supplemental `scripts/communication/verify-langfuse-pilot.mjs` reads all score pages, checks exact values and subject/environment bindings, and fails on safety caps. Frozen exporters and failed verification receipts remain intact. Use this verifier for these roots; incorporate pagination into future versioned exporters before new freezes.
- Common export required registering previously missing cost-score definitions. Definitions were registered and final common summaries read back; no participant rerun was involved.

## Provenance and limits

Harness source landed locally at `bc53ab73`. Versions: COM3-stream-v3 / COM3-grade-v3; COM4-stream-v4 / COM4-grade-v3. PILOT03 ran baseline first, repeat 1; PILOT04 ran Lookout first, repeat 2 to reverse order. Repeat 2 is its first attempt, not a retry. Each used its own fictional owner and account lock, with no real-account reset. Historical roots and unsuccessful pre-inference preparation were preserved.

Private evidence under the existing `experiment-control` base:

- `com3-matched-v3-PILOT03-r2`: `COM3-baseline-r1-a08e6e29`, `COM3-lookout-r1-054d5f5c`.
- `com4-matched-v4-PILOT04`: `COM4-baseline-r2-a6aaa8fb`, `COM4-lookout-r2-60559418`.

Each run retains `review.independent.json`, `grade.final.json`, `eval-summary.final.json`, stage traces and independent final-state captures. Root `post-pair-verification.json` confirms frozen-file integrity and actual prompt/evidence parity. Prospective registrations and export receipts share each root's `langfuse` directory. Structural detailed traces and final common summaries are verified and routed to `benchmark-pilot`, excluded from measured comparisons. Personal contents and credentials were not exported.

Reviews were performed after each pair by the coordinator independently of participants, but were not blinded or separately adjudicated. One pair per case, overlapping rubric checks, host/network variation, differing record surfaces and necessary tool isolation prevent a general causal or statistical claim. The observed totals favor baseline on time/token usage and aggregate checkpoint scores; Lookout's stronger COM03 message retention and both COM04 final-state successes must also remain visible.

Validation: 14 focused Node harness tests, two Python transport/prompt tests, actual no-inference preflights for both cases, two supplemental pagination/binding tests, post-pair freeze/parity checks and catalog validation (158 roles). No full-suite or production-deployment claim. The isolated checkout is retained because frozen manifests reference its source files. Nothing was pushed or published to GitHub; only authorized structural benchmark telemetry was sent to Langfuse.
