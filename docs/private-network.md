# Private Network UI

Network keeps the existing `/referrals/` URL with two working views:

- **Targets:** a compact company list showing target teams/roles, next steps and
  relevant people. Company details retain private research, source dates and the
  existing outreach editor. Targets can exist before a job or contact is known.
- **Active processes:** applied roles, recruiter screens, interviews and offers,
  each opening its targeted outreach workspace. The application remains the unit
  of navigation; Open application uses the existing materials/prep/timeline dialog.

Role-specific contacts are matched only by an explicit application reference in
existing contact tags (`application:<backendId-or-local-id>`) or an exact employer
posting URL in jobUrl/link. Matching preserves requisition query parameters.
Company/title similarity alone never establishes process involvement. Other
company contacts appear separately, labelled as unconfirmed for this process.
Prepare for this role creates a separate contact draft with a fresh ID, blank
message and Not asked status, preserving the person's previous message/status.
The role-specific copy request reuses the cold-outreach guide and existing
list_contacts/save_contact operations. No recruiter inbox or message sending is
connected. Company research opens the corresponding Target without a page reload.

The desktop process list sits beside its outreach; mobile uses a labelled process
selector. Process-specific drafts, empty outreach, general company contacts and
multiple simultaneous roles at one company are covered by fictional demo data.

Existing contacts and tracked applications appear in Targets through normalized
company-name matches. Explicit company links support aliases; unassigned legacy
people remain accessible under Other contacts. Company priorities do not overwrite
application statuses, tier lists or the weekly preparation budget.

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

Browser verification covers desktop, mobile, light theme and role-specific outreach
isolation using fictional data. Live account persistence remains unverified.
No backend deployment or data migration is introduced by this UI change.
