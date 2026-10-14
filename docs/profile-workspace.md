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
