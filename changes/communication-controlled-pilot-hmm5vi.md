# Communication controlled pilot harness repair — unfinished handoff

User requested removal of harness confounds before paired pilots for COM01–04, then requested handoff to another chat before runs.

## Implemented, unverified
- Same existing external-stage request for baseline and Lookout; prescribed initiation counted for both.
- Native MCP initialize and default tool surface forwarded with existing isolation filtering; removed automatic all-tool discovery/schema injection.
- Introduction-only scope filtering applied to discovered profile schemas.
- Added structural MCP duration and response-byte measurements; preflight explicitly checks startup and discovery.
- Prospective scenario/grader versions: COM1 v6/v5, COM2 v5/v4, COM3 v3/v3, COM4 v4/v3. Historical freezes unchanged.

## Outstanding before landing or inference
- Review all changes, including COM2 scheduledApplicationCommunicationEnabled still true despite matched-intent mode; correct configuration consistently.
- Check all four prompt paths and delivery/grader/summary effort accounting, native discovery/wrapper permissions, startup restrictions and schema filtering.
- Ensure telemetry covers wrapped discovery calls, distinguishes cumulative request latency from model execution, and exports new metrics correctly.
- Run focused regression checks and actual no-inference preflight on newly prepared private roots. Dependencies installed; feature doctor passed. No tests or preflights run yet for these edits.
- Add current-state docs/OpenWiki updates; finish this note; land only after verification. No product runtime changes intended.
- Register separate prospective Langfuse datasets in the exact receipt directory used by each orchestrator before inference (PILOT-02 export failed on missing registration receipt).
- Prepare fresh roots and run paired pilots without participant help or retries; independent semantic grading only after both finish.

No new participant runs, dataset registrations, or prepared private roots. Nothing pushed/published. This checkpoint is not ready to run and must not be treated as validated.
