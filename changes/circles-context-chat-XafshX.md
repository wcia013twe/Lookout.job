# Circles: conversations with attached context

- Reworked the main Circle overview into familiar conversation collections, a central thread stream and message-first composer, a member filter, and a supporting shared-context rail. Preserved the cloud cottage behind Open clubhouse and kept existing thread reading/reply/review controls.
- Job and round context supports company, role, employer job ID, public posting URL and stage, with drag/drop plus accessible attach controls. Attaching a shared job preserves an existing message. Round previews lead with the reported question/topics.
- Added general discussion and offer comparison types. Comparisons retain two to four voluntarily entered offers with explicit text for pay/equity terms; no compensation totals are inferred. Existing thread detail adds only job ID and a comparison table.
- Shared SQL validation, search, browser/gateway projection and scoped MCP operations cover attached context. Revision approval, private drafts, standing-template limits, ownership and existing feature gate remain intact. Gateway developerVersion is 25.
- Demo covers casual conversation, job/stage round insights and two-offer comparison; fixtures remain fictional, resettable and isolated.
- Validation: npm test (340 passing after local-main integration); validate:data (76 roles); frontend typecheck; production static export (50 pages); git diff --check. Focused post-review checks passed 19 tests. Browser checked attach/save/review/publish/reply and offer saving, desktop 1440/1280 and mobile 390 (no document overflow). Impeccable detector returned []; reviewer disposition ship for the scored insight-preview fix.
- Setup: root npm ci succeeded; next-app npm ci failed with npm's exit-handler error. Reused the existing local dependency tree in the isolated checkout; typecheck and static builds passed.
- Integration: retained local main’s newer compact thread presentation and shared application-stage component, adding only job ID and the offer table. Rechecked the linked round-insight thread in the browser.
- Limits: production migration/gateway deployment, hosted account authorization, realtime chat delivery, notifications and private tracker drag/import are not verified or introduced. Preview uses the existing periodically refreshed thread service. No push or production publication.

## Real-company discussion follow-up

- Replaced Example Systems/Compute/Labs with Databricks, Stripe and NVIDIA; added existing manifest company logos to job chips, shared-job entries and offer previews.
- Rewrote shallow celebration/practice copy into substantive discussions about query plans and cardinality, cache invalidation, technical storytelling, team placement and offer tradeoffs.
- Used the real Databricks 2027 internship posting and employer posting ID 6865687002, checked on its official careers page. Interview discussion remains explicitly illustrative, not a verified account of its interview process. Offer packages remain hypothetical.
- Validation: 19 Circle tests passed; frontend typecheck, data validation (76 roles), static production build, diff check; all ten visible/loaded logo image instances resolved; mobile width390 had no document overflow.
- No backend changes or production publication; current thread layout and sharing controls preserved.

## Reuse the application row as attached context

- Extracted ApplicationIdentity from the existing application list without changing its DOM, and reused it with the same CompanyMark and SharedApplicationStages/StageProgress in a compact job attachment.
- Circle conversation previews and the existing thread detail now share this attachment. The job identity sits beside the existing tracker at desktop widths, then stacks above it inside narrow attachment containers. Job ID, exact stage, supplied experience date and public posting link remain visible.
- Shared stage mapping recognizes numbered Technical round / Interview labels. It still highlights only the reported stage and does not invent historical progress or dates.
- Validation: all 340 tests, frontend typecheck, production static build, data validation (76 roles), diff check and scoped design detector ([]). Browser verified desktop/mobile attachment layout with no document overflow.
- No backend fields or private application-history access added. Unrelated application-page work remains untouched.

## Consolidate job attachment metadata

- Removed the separate footer: exact stage/date sit with the tracker, and the posting link is an accessible trailing icon in the same compact row. Employer job ID is secondary metadata beneath the company.
- Mobile retains a stacked tracker while keeping the posting action beside the job identity.
- Validation: frontend typecheck, production build, data validation (76 roles), diff check and desktop/mobile browser inspection (390px without document overflow). No domain/backend changes; no new tests needed.

## Inline company and job ID

- Attached job identity now renders `Company | ID: <employer ID>` on a single metadata line beneath the role, reusing an optional jobId prop in ApplicationIdentity. Other tracker rows retain their existing company label.
- Validation: frontend typecheck, production static build and diff check. No backend or stored data changes.

## Follow-up: prompt-style post creation

- Replaced the top-level post form with a prompt composer, `@`/plus context search, Applications/Referrals/Circle categories, removable expandable context chips, and a review arrow. Drag shared jobs, context options, public links or notes into the prompt; no file upload. Preserve manual round metadata, insights and offer comparisons in expandable details.
- Read only already-loaded workspace application/referral metadata; whitelist shared snapshots and isolate demo options. Reuse the compact application component in expanded chips and review/thread previews. Demo fixtures include a post with both application and referral context.
- Added revision-bound `contexts` validation/search/projection in database and domain code, scoped MCP descriptions and developer version 26. Existing human review/approval boundaries and hosted release gate remain intact.
- Validation: full unit/database suite (344 passing), TypeScript, production static export, data validation; browser @ selection, plus category search, keyboard selection, attachment preview/removal, accessible shared-job attachment, and private draft review checked in isolated preview. Production build initially hit disk exhaustion; retry after deleting only this task’s generated cache passed. Drop payload parsing/validation is covered by tests; native pointer dragging was not confirmed by the browser harness. Impeccable review: ship, no material fixes; documenter confirmed incumbent design unchanged. Hosted deployment and real-account sharing were not performed.

## Follow-up: local document and image previews

- Added a plus-picker action and drag/drop handling for documents and images. Show file type/size, thumbnails and expandable image previews, document cards, local download links and removal. Six context items/files combined; 10 MB per file. Object URLs are revoked on removal/unmount; file bytes stay out of post content and persistent browser storage.
- The user explicitly deferred Supabase work. No Supabase/gateway/schema/policy changes in this pass. Saved `docs/circles-file-attachments-plan.md`: private object storage holds bytes, database holds immutable object keys plus metadata and revision references; future access checks and scoped MCP work are documented, not advertised as live.
- Clearly label files as local previews and disable review/save while files remain, rather than silently dropping attachments. Removing all files restores the existing post flow. Demo and regular editors use the same local-only behavior, with no account reads/writes for file previews.
- Validation: local file validation test, full suite (346 passing), TypeScript, static production export and catalog validation. In isolated preview, selected a synthetic TXT document plus existing WebP fixture through the native multiple-file chooser; image preview loaded, mobile had no horizontal overflow, review remained disabled until both files were removed, and removing them cleared blob images and restored normal posting. Impeccable review: ship with no material fixes; documenter confirmed the incumbent system unchanged. Pointer file dragging is implemented but not confirmed by this browser harness. No hosted upload/deployment was attempted.

- Integration follow-up: preserved the separately landed shared-activity editor and clubhouse layout; connected the same file preview/submit guard to its new Circle chat composer. Integrated suite: 350 passing; TypeScript/static export pass. Rechecked loaded image/document previews in the narrow desktop chat and mobile layout; scoped reviewer returned ship. No Supabase source diff. Cleared only this task’s generated build cache after disk exhaustion blocked the integration commit.

## Follow-up: compact file action

- Folded the standalone documents/images row into an “Add File” action immediately after Circle in the context category bar. The same file picker and local-preview behavior remain.
- Validation: TypeScript, catalog validation and browser inspection. No backend changes.

## Follow-up: readable, left-aligned context actions

- Increased category/action labels from 10px to 13px and left-aligned the full control group. Removed Add File’s automatic right margin. Circle and Add File stay together when the bar wraps on narrow screens.
- Validation: TypeScript, data validation and browser inspection of the picker.

## Follow-up: settings destination and repeat-action fixes

- Moved Circle settings out of the header menu into the left navigation. Preserved all membership/invite/policy/refresh/private-history/create/join controls. Mobile destinations use two columns to avoid overflow.
- Coalesced rapid invite clicks and disabled creation while an active code exists. Show existing codes without revoking them silently. New conversation now toggles to Close conversation; Cancel still works, returning to the prior tab. Clear stale thread URLs when starting a new conversation.
- Validation: 354 tests pass, including rapid-click/active/expired/revoked/retry invite cases; TypeScript, production static export, catalog checks. Browser demo double click produced one code; revoke then create produced one replacement; close/cancel both restored settings. Desktop and mobile screenshots checked; mobile navigation overflow corrected. No Supabase/backend change or hosted deployment.

- Finish review: ship after fixing the active-search edge case (settings retains its own heading; contribution pagination renders only in the feed). Browser verified the filtered-to-settings transition. Incumbent design documentation remains unchanged; final static build passed.

- Local-main integration preserved the newer message-only side chat/forum mentions and tracker styling. Resolved the surface-note append conflict by retaining both scopes. Integrated checks: 357 tests, TypeScript and static export pass; no Supabase source change.
