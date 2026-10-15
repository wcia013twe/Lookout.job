# Circles: contributing through your agent

This is a product design and implementation backlog, not a statement of live
capabilities. The Circle backend remains release-gated pending hosted verification.
Current approval is a human website action. No scheduler or outbound delivery
transport is added by the dashboard design.

## The contribution loop

Complete the original career task first. Then, when a specific experience or
resource could help friends, offer one contextual sharing suggestion. Do not ask
while the original task has failed or needs urgent attention. Do not turn every
interaction into a contribution request.

Example:

> User: I finished my Databricks interview. They asked graph questions.
>
> Agent, after successfully recording the completed round: Recorded your completed
> Databricks round. That could help KnightHacks prepare. Want a quick tip to share?
>
> User: Yes.
>
> Agent: Here is a private draft for KnightHacks, shared as Wes:
> “My Databricks interview included graph questions. Reviewing traversal patterns
> could help with preparation. One interview experience; rounds may differ.”
>
> Share with KnightHacks / Edit / Keep private

The first yes authorizes drafting, not publication. Resolve the destination when
the user belongs to multiple Circles. Preview the exact resulting content, sources,
posting alias and destination before requesting publication approval. Do not invent
specific question types from a general report. Another Circle requires its own
approval. Existing agents must use the human-action handoff for exact review.

## Task: contextual suggestions and declines

Add durable user preferences and source-event dispositions through scoped backend
operations shared by the website and MCP. Do not store private conversation text.

- Suggest at most once per completed task, after a useful milestone, resource or
  opportunity, or follow an explicit “Share this with my Circle” request.
- “Not now” dismisses this suggestion. Do not retry unsolicited in the same task.
- “Keep this private” suppresses this source event permanently.
- “Stop suggesting shares” disables proactive prompts; explicit requests still work.
- Keep milestones, offers, compensation, reports and arbitrary prose under exact
  review. Existing standing permission covers only its closed public-link template.

Acceptance: a failed application update never claims success or triggers a sharing
pitch; a decline never publishes; repeated processing of one source event cannot
duplicate its contribution to the same Circle. The agent handles formatting and
tags without requiring the person to fill out a report.

## Task: trustworthy approval in the usual conversation

The desired text experience requires a new human authorization boundary. An
agent's assertion that a person said yes is not an approval receipt. Preserve the
current website-only boundary until a connected runtime can supply authenticated
human approval interactions.

Bind a human approval to the owner, Circle, post, immutable revision/content hash,
authenticated runtime interaction, expiration and single-use nonce. Check the
current membership and policy transactionally at publication. Share the same
validation across website and scoped MCP operations; never expose a generic agent
approval operation that can forge the human action. Human approval must be
separate from source provenance and from permission to update an application.

Acceptance: changed text or destination cannot reuse approval; expired or replayed
interactions cannot authorize a new publication; revoked membership prevents
publication; retrying a successful request returns its receipt without duplicates.
Until verified, show a truthful review link rather than claiming in-chat publishing.

## Task: lifecycle and recovery

Represent private draft, awaiting review, approved exact revision, publishing,
shared, kept private, revision conflict, failed, withdrawn, hidden and access lost.
Publication success requires a backend receipt. A failed retry keeps the private
draft and uses the same event key. Edits produce a new revision and require new
approval; the previous published revision remains visible until replacement.

“Remove what I shared” uses withdrawal. Explain that future Circle access stops;
do not promise removal from another person's past conversation. Recheck publication
visibility when delivering queued updates so a withdrawn contribution cannot leak
through an old queue. Clear shared cached content when access is lost.

Acceptance: stale-revision errors preserve the user's draft for reconciliation;
withdrawn/hidden content is excluded from future retrieval and pending delivery;
leaving a Circle does not misleadingly claim to delete old published contributions.

## Task: acknowledgments grounded in real interactions

Current citation receipts support “Agents used this for N people.” They represent
reported use in an answer or preparation plan; they do not prove delivery,
usefulness, a save, or a successful application outcome. Search and retrieval alone
never count. Keep distinct-human, per-revision deduplication, self-use exclusion and
receipt retraction from the existing contract. Never reveal recipient identities
or preparation details through contributor acknowledgments.

Add save/unsave only as authenticated user actions with scoped website/MCP parity.
Add helpful/unhelpful only as explicit recipient feedback. Do not infer either from
clicks or citations. Aggregate acknowledgments into the chosen delivery cadence
instead of interrupting for every event. Reuse delivery policy and acknowledge only
events actually delivered through a connected runtime.

Acceptance: repeated retrieval generates no impact; two agents serving the same
person cannot inflate counts; edits start a new revision's count; retractions are
reflected; no contributor sees private recipient names. The product has no ranking,
XP, streaks or zero-impact pressure.

## Dashboard and demo coverage

Make the dashboard an optional place to review exact drafts, find shared knowledge
and manage permissions. Keep title and useful information first in the editor,
with metadata and sources progressively disclosed. Retain a visible disclosure
control and explicit Save private draft action. Avoid presenting limited link
permission as blanket automatic sharing or a notification subscription.

Fictional demo scenarios should cover a private offer draft, approved publication,
an edit requiring new review, a declined suggestion, duplicate retry, withdrawal,
private aggregate use and no-contribution state. Future conversational and delivery
scenarios must be marked as previews until their authorization/runtime support is
implemented and verified. No demo action may write real accounts or send messages.
