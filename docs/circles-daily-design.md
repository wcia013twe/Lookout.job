# Circles daily conversation design

Circles makes career progress feel supported by friends. The daily text experience is the product; the dashboard is an optional place to review contributions, permissions and delivery. Complete the original task before suggesting a contribution. No leaderboards, artificial XP, competitive progress comparisons or requirement to visit another app.

## Current implementation and honest limits

The Circles page includes a self-contained interactive conversation concept. Daily roundup, Share a tip, Celebrate and Your impact illustrate the six desired behaviors: roundup, approved milestone pushes, contextual contributions, effortless sharing, real impact and actionable personalization. Every character, shared event, plan modification and activity count in this preview is fictional. State is local to the mounted component and resets without persistence. It imports no account service, sends no request and never writes to applications, plans or community records.

Private invitation-only knowledge threads, exact-revision review/publication, membership-aware retrieval and citation receipts are locally implemented and release-gated. See [Circle Knowledge](../backend/circle-knowledge.md). Hosted authorization checks remain required before enabling production. This release does not implement social event delivery, a scheduler, message transport, resource-save events or human-confirmed benefit. Existing agent citation receipts mean “agents used this for N people”; they do not prove saves or benefit. The impact scenario explicitly illustrates proposed future evidence and must never be populated from citation counts alone.

The current gateway instructs agents to keep social sharing off. Conversational approval cannot bypass the existing human-only exact revision approval boundary. The preview's buttons do not claim to perform that boundary. Shipping text-only review and publication requires a separate designed authorization path with backend validation and deployed MCP parity.

## Daily experience

Offer one short personalized roundup per chosen delivery period. Default social delivery to daily, not the existing application notification policy's immediate cadence. Select up to three useful updates, prioritizing relevant current preparation, meaningful voluntarily shared milestones, diverse contributors and fresh resources. Include plain-language context and at most one leading next action. Deduplicate repeated posts across Circles and previous delivery periods. Send no message when nothing new qualifies.

Approved interview/offer announcements may interrupt only when the recipient explicitly enables milestone pushes, outside quiet hours. Coalesce announcements and cap immediate social pushes at two per recipient per day; overflow goes to the next roundup. Social events never use application-critical urgency. No countdowns, comparative rankings, application-volume celebrations or inferred milestones. A contributor's approval permits sharing; it does not override each recipient's notification preference.

Connect a shared experience to the owner's preparation without exposing private application context to contributors. “Maya experienced graph questions” must not become “your interview will contain graph questions.” Cite the published source and revision when using it in real preparation. Record a citation only after actual use, never after mere retrieval.

## Contextual sharing

1. Complete the original authorized application or preparation task.
2. Detect a specific useful contribution, check destination membership and permission, and ask once in that context.
3. Offer a concise draft containing only the proposed visible text and public sources.
4. Show exact destination and visibility alongside the full text. Offer edit, keep private and the required human approval action.
5. Recheck membership, current revision and authorization at publication. An edit invalidates earlier approval.
6. Confirm only a successful publish receipt, then return to the original career task.

“Share this with my Circle” skips the suggestion but not destination disambiguation or personal-content approval. Declining suppresses repeated suggestions for that source event. Sharing notes, interview detail, offers or compensation always requires exact review under the current contract. Do not treat an inferred sensitivity flag as permission.

## Future service tasks

- Define separate social preferences: daily/weekly/paused cadence, timezone and delivery time, quiet hours, per-Circle mute and explicit milestone toggle. Social pause must not block owned application work or important application review.
- Produce server-derived social events from authorized published revisions. Reference source post and immutable revision; never project private application IDs, raw notes, email evidence or memory into shared events.
- Add a bounded recipient selector and ledger. Revalidate membership, visibility, current published revision and preferences immediately before dispatch. Deduplicate across workers and the user's agents.
- Add narrowly scoped website/MCP operations for reading/updating preferences, previewing a roundup, reading pending delivery and acknowledging actual delivery. Reuse ownership, revision and idempotency validation in both paths.
- Integrate one verified runtime delivery channel. Represent unavailable, ready, queued, delivered, failed and uncertain outcomes honestly. Acknowledgement follows verified delivery only; reconcile uncertain provider outcomes before resending.
- Add version-checked preparation handoffs and separately authorized saves/benefit reports. Keep saver identity private unless the saver explicitly chooses disclosure.
- Update gateway instructions and developer version only with the final deployed contract. Complete hosted release-gate checks before advertising availability.

## Acceptance criteria

- All four preview scenarios are reachable using keyboard and touch; selected scenario is exposed with `aria-pressed`. Scenario changes clear previous transient outcomes and edited drafts.
- The tip and offer flows start with completion of the fictional original task, then ask to share. Decline, edit, exact preview, simulated sharing, return to task and restart are functional and clearly local.
- Preview state is isolated from guest persistence, signed-in accounts, admin demo service, network transport and all backend writes. It must behave identically for signed-out and signed-in viewers.
- Text remains readable without horizontal overflow at 320 CSS pixels and at 200% zoom; controls wrap, have visible focus and meet the existing 44-pixel minimum touch target. Status changes are announced without moving keyboard focus.
- A real roundup is understandable without opening the dashboard. No new authorized activity produces no message.
- A private new draft never appears in delivery. Withdrawal, hiding, Circle removal or policy revocation before dispatch excludes an event even when previously selected.
- Exact-revision authorization cannot be reused after editing or for another Circle. Freeform text never gains standing publication permission through the new delivery path.
- Two workers or agents cannot generate duplicate deliveries for the same recipient/event. Failed delivery is not acknowledged, and uncertain delivery is not blindly retried.
- Social quiet hours, pause, mute and weekly cadence are honored across website and agent paths. No social announcement is marked application-critical.
- Preparation changes require current plan versions and authorization. Private application context stays with its owner.
- Saves, voluntary human feedback and agent citation receipts retain distinct evidence and copy. No contributor sees a friend's private plan or answer through impact notifications.

## Verification and rollout

Frontend review covers desktop/mobile conversation layout, every scenario, both decline paths, edit-and-review, whitespace-only draft rejection, simulated publication, return-to-task and restart. Account review confirms no preview writes across sign-in/sign-out or admin demo changes. Frontend typechecking and static build verify integration; they do not establish real channel delivery or hosted permissions.

Future rollout begins in isolated hosted staging with two genuine accounts and scoped agents. Exercise revocation races, approval edits, removed membership, hidden content, duplicate workers, timezone boundaries, daylight-saving changes, failed/uncertain transport outcomes and expired tokens. Only after production authorization and verified delivery tests pass should social delivery be enabled. Measure voluntary contribution, actual resource use, relevant next actions, delivery reliability, mutes and repeated declines. Avoid optimizing raw notification or posting volume.
