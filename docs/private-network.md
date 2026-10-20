# Private Network UI

Network keeps the existing `/referrals/` URL and presents a company grid. Each
company opens into Overview, People & outreach and Applications. Research-only
targets need neither a contact nor an application. Existing contacts and tracked
applications appear through normalized company-name matches. Explicit links
support aliases and people helping several processes. Unassigned legacy people
remain accessible under Other contacts.

Overview contains personal interest, priority, target teams, concerns, company
research, dated HTTPS sources and a next action/follow-up date. Company priorities
do not overwrite application statuses, tier lists or the weekly practice budget.
People & outreach reuses the existing editor; Applications reuses the existing
list/dialog, materials, preparation and timeline. Recruiter inbox synchronization
and shared intelligence feeds are not connected.

## Existing storage and tool boundary

This is a UI-focused extension, without a new company table, RPC or gateway tool.
Company targets live in the existing private outreach collection with:

- `collection: "companies"` (distinct from people)
- `company`: company display name
- `followUpDate`: optional date
- `notes`: JSON company brief, encoded/decoded by `lib/network-model.mjs`

The notes contain name, website, priority, interest, targetTeams, concerns,
research, nextAction, followUpDate, sources [{title,url,observedAt,summary}],
contactIds, applicationIds and archived. Source dates are observations, not a
claim of current availability. Legacy plain notes remain readable. The UI validates
this presentation format and bounds it to fit existing outreach-record limits.
The backend treats notes as freeform data under its existing validation boundary.

Website writes reuse `save_outreach_contact` and its existing owner/revision guards,
automatic syncing/retry and account namespaces. Agents use existing `list_contacts`
and `save_contact` (`network:write`) with the current expectedRevision, preserving
company-target collection and notes. There are no new advertised capabilities.
Links display only records already present in the user's owned workspace; they
never grant access or fetch arbitrary IDs. Guest data stays in its browser namespace.
No automatic guest-to-account company migration is added beyond existing outreach
behavior. Malformed structured notes are shown as legacy research text for review.

## Research and follow-ups

Copy research request is an explicit handoff to the personal agent: load the
existing Career Toolkit company-research guide, read existing company-target
notes, verify missing/stale public information and save via existing contact tools.
It does not queue/start research, send messages, or change any permissions.

Due and overdue next actions appear on the Action Board using the account's
quiet-mode timezone (UTC fallback). Open company returns to its workspace. Clear
or change the date, or archive the company, to change reminders. These rows do not
allocate interview-practice time, complete tasks or activate notification schedules.

## Verification

Unit tests cover company-note encoding, existing tool compatibility, provenance,
aliases, unassigned contacts, follow-ups and isolated demo fixtures. Existing
backend tests continue to cover outreach ownership, scopes and revisions.
`scripts/check-network-ui.mjs` uses intercepted fictional account traffic to check
signed-in company-note persistence, contact retry recovery, desktop/mobile UI,
research editing, sources, application opening, outreach, archive/follow-ups and
reset. Demo uses the existing disposable memory store; no real account writes.

Live account persistence and light-theme visual inspection are not verified.
No backend deployment or data migration is introduced by this UI change.
