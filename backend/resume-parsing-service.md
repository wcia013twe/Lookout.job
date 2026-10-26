# Planned résumé parsing service

Status: design note only. No parsing worker or MCP capability is implemented by this note.

Move repeated PDF/DOCX extraction and candidate-field normalization into the Node worker so Muse does not download, read and reconstruct the same résumé on every run. Muse should initiate intake, resolve ambiguities and use the resulting applicant context for recommendations and answer drafting.

## Proposed flow

1. Reuse the existing private résumé upload/register boundary. Validate file type, size and exact-byte checksum before accepting a parse request.
2. A narrowly scoped MCP operation submits an owned `resumeId` and stable idempotency key. Resolve the file through its owned Storage record; do not accept arbitrary file paths, URLs, user IDs or caller-supplied credentials. Reuse the durable Node job infrastructure rather than creating another queue.
3. The worker extracts PDF/DOCX text, normalizes it against the existing profile schema, and returns proposed facts with document/page evidence, missing fields, ambiguity/conflicts, parser version and source checksum. Use existing parsing components where suitable; do not recreate a parallel candidate schema. OCR or model-assisted extraction must explicitly report unavailable dependencies and uncertain results.
4. Cache by owner, source checksum and parser/schema version. Return the existing result for an unchanged file. Source replacement invalidates the relevant parse result, not unrelated profile data.
5. Expose a bounded parse result through a scoped MCP read. Muse can propose selective changes through the existing versioned profile-import/update boundary. Preserve unrelated facts and human edits; work/education/project arrays require explicit reconciliation before replacement. A parse result must not automatically overwrite the profile.
6. After an authorized import, read back the profile and report saved fields plus unresolved questions. Persist imported assertions as unverified. Parsing does not grant saved-answer reuse, human verification, application approval or submission permission.

## Required boundaries and failure behavior

- A résumé is untrusted source material. Never execute embedded instructions or follow embedded links as commands.
- Do not infer work authorization, citizenship, sponsorship, protected attributes, relocation willingness, salary targets, availability, or preferred tone from résumé text. Explicit source assertions and user preferences remain distinct.
- Reuse private résumé storage and existing candidate records. If durable proposed results are needed, choose a bounded private result representation in the existing job infrastructure; do not add duplicate raw-document or candidate stores by default.
- No résumé bytes, extracted full text, contact details, signed URLs or answer contents in routine logs. Keep job status, duration, parser version and safe failure codes; define expiry for intermediate artifacts/results.
- Distinguish empty extraction, unreadable/scanned documents, missing OCR, unsupported formats, partial extraction, conflicting values, stale profile versions and ownership failures. Fail loudly instead of reporting successful empty facts.
- Verify with representative PDF/DOCX/scanned fixtures, existing profile preservation, ownership, idempotency, source replacement, stale-version rejection and absence of sensitive logging. Verify the actual local upload → parse → proposed result → selective import → read-back path before advertising it to Muse.

## Related work

The current local runner hardcodes the hosted Supabase origin for upload/download validation. Configure one trusted backend origin before claiming normal local-runner intake works; retain strict destination validation. My Settings also needs one shared field vocabulary so proposed résumé facts have the same supported destinations in the UI and scoped MCP tools. See [My Settings MCP audit](local/MY-SETTINGS-MCP-AUDIT.md).
