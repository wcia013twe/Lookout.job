# Feature change notes

`CHANGELOG.md` is the historical archive. Record new feature passes in separate files here so parallel PRs do not edit the same insertion point.

`npm run feature:start -- <name>` creates `changes/<unique-branch-name>.md` in its isolated checkout. Replace the draft template with the completed change, checks actually run, and verification limits. Remove the draft marker and commit the file with the feature. Local landing and optional PR publication reject an unfinished template.

Keep one file per feature branch; update that same file for follow-ups. Existing branches without a generated fragment remain deliverable during migration. No shared changelog regeneration or history rewrite is required to land a feature.
