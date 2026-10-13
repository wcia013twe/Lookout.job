# Job Signal Board

A static, data-first dashboard for selective U.S. software-engineering job discovery.

## Use it

Serve the repository with any static server, then open `index.html`. The dashboard reads `data/jobs.json` directly.

```sh
npm run validate:data
```

## Data contract

`data/jobs.json` is the source of truth. Each role must have a stable ID, canonical application URL, company, title, employment type, location, category, priority, posted/discovered dates, rationale, and application status.

The dashboard keeps manual status edits in browser local storage. The scheduled automation must preserve any existing `applicationStatus` values when it updates data. It should deduplicate by canonical application URL as well as company/title/location.

## CSV helper?

Not yet. JSON is the canonical dashboard format and avoids a second persistence path. Add CSV export/import only when a spreadsheet becomes a regular part of the workflow; a query helper is not necessary for the current scale.

## Application workspace

The four tabs are Needs you, Discover, Applications, and Profile. Queue a role from Discover, open its review panel in Applications, select a saved resume reference, and enter the exact employer questions and draft answers. Review the complete question list and verify your profile before approving. An edit invalidates the prior approval. Approval stores a versioned snapshot; it never submits an application.

Application drafts, profile facts, and resume references persist in the browser through the existing store. Existing tracker, interview, and referral data remain accessible under Applications. No shared backend, application runner, question extraction, or SMS integration is connected yet.
