# Profile workspace

Profile opens on a compact overview. About me, Application kit, Job preferences and My agent show one editor at a time. Once opened, panels remain mounted so switching sections preserves unsaved fields. Leaving the route still requires saving edits. Profile facts keep the existing human-verification behavior.

Default resume selection is in Application kit and uses the existing workflow.searchPreferences.defaultResumeId setting. Job preferences retain search profiles, update cadence, review thresholds and company tiers. My agent retains the existing connection operations and permissions. Progress and leaderboard sharing are available from the header XP menu at /progress/.

## Existing tool boundaries

This change reorganizes existing interfaces; profile facts, resumes, saved answers, preferences and agent connections retain their existing scoped tool contracts. Section navigation and accordion expansion are browser presentation state. Human fact verification and leaderboard sharing keep their existing human controls. No new backend permissions are introduced.

## Admin demo walkthrough

Enter Demo mode and open Profile. Check the fictional name, location, resume state and Muse companion. Open About me: expand work experience, education and projects; edit a field, switch to Application kit, and return to confirm the unsaved edit remains. Save and review the verification state. Open Application kit to inspect the fictional resume and unverified saved answer. Open Job preferences and My agent. Reset demo: original fictional facts should return without changing account records. Use the XP menu to reach Progress.

Search targets is a separate personal Profile section: boards, employer careers pages,
and social accounts define where Muse looks; fit profiles define which roles fit.
Targets are private, editable and removable, stored as `preferences.search.targets`
with `targetsVersion`. Website `save_search_targets` and MCP `save_search_targets`
(`preferences.targets.save`, preferences:write) share owner and version validation.
Workspace autosync preserves this list. Guest edits stay in the browser.
Social content must be forwarded; public-page scanning needs runtime verification.
Saving targets does not create a scanner, schedule, or social connection. Sharing is deferred.
Demo fixtures include fictional targets of each type and use the same editing controls.

## Job preference profiles

Job preferences groups roles/experience, locations/working style, companies/industries,
skills/compensation, exclusions and values. Each criterion has an optional Required,
Preferred or Flexible priority. Each named search profile independently maintains
career goals, tradeoffs and an associated tier-list ID. Profile facts and employment
answers stay shared. Multiple active profiles are supported; paused profiles remain
editable. Unsaved drafts survive switching profiles and Profile sections, and reset
when the account or demo epoch changes.

The editor uses the existing versioned `save_search_profile` RPC and
`save_search_profile` MCP tool (`preferences.profile.save`, preferences:write).
The six established filters and seven evaluation priorities retain their existing
structured fields. Additional criteria, flexibility, goals and tier-list references
are labeled text in `instructions`, available in existing personal context. This
is agent guidance, not a new deterministic filtering engine. Preserve these labeled
lines during agent edits; tier-list ID is authoritative, with current list data in
the workspace. Company priority does not override role/team evidence. Deleting a
referenced list shows an unavailable selection until a replacement is chosen.

Tier-list edits save through the established shared list boundary; changes affect
all profiles referencing that list. Associating a list requires Save profile and
does not alter automatic-submission review policy. Notification cadence, automation,
and review thresholds now live in My agent. Existing values and permissions remain.

Demo has fictional full-time and paused internship profiles with separate goals
and company lists. Verify edit/save/reload, switch profiles with unsaved text, pause
and resume, maintain/associate a tier list, and reset to restore demo defaults.
