# Circles documents and images — backend note

Status: Deferred at the user's request. The composer supports local file selection, drag/drop, image thumbnails, expanded image previews, document cards and removal. Files are held only in memory through object URLs; they are not uploaded, serialized into post content, or persisted in browser storage. Reloading or leaving the composer clears them. Review/save is disabled while local files remain, so a post cannot silently omit its attachments. The existing text/context posting flow resumes when files are removed. No Supabase migration, schema, bucket, policy, gateway or agent tool change is part of this UI pass.

## Storage design to implement later

Keep bytes in a private object-storage bucket. Store a durable **storage key**, not a signed URL or file bytes, in a Circle attachment row. Suggested metadata: attachment ID, bucket/key, original filename, MIME type, byte size, checksum, uploader and Circle IDs, creation time and upload state. Link attachment IDs to the exact post revision being reviewed. File paths should use generated identifiers; filenames are display metadata.

Use the key to authorize and fetch data when needed. Existing Circle membership and draft/published/hidden/withdrawn rules must also govern files. An unshared file belongs only to its uploader; another member can access it only through a visible shared revision. Generate short-lived access URLs or serve authenticated downloads after checking current permissions. Never persist a signed URL as the canonical file reference or make the bucket public to simplify previews.

Make uploaded objects immutable once referenced by an approved revision. Replacing a file creates a new object/reference and requires a fresh review. Complete the upload before allowing a post to reference it; retain retry keys and reject cross-Circle references. Removing an attachment from the composer must not delete a file still used by a published revision. Add bounded cleanup of genuinely abandoned uploads separately.

Website and narrowly scoped MCP operations should share upload preparation/completion and file-read authorization. An agent may prepare a file reference, but it must not forge approval or publish a new attachment without the existing exact-revision human review. Verify ownership, two-account reads, revocation, revision replacement, size/type limits and retry behavior before enabling the hosted feature.

## Current local UI limits

Six context items/files combined; 10 MB per file. Images: PNG, JPEG, WebP and GIF. Documents: PDF, DOC/DOCX, TXT, Markdown, CSV, XLSX and PPTX. Images can expand in place; documents have a local download link. This is a preview interface, not verified file ingestion or text extraction. The eventual server must independently validate files; client checks are only immediate feedback.
