Review this job board for concrete correctness, regression and security issues.
Prioritize ownership/scope isolation, stale revisions, idempotent retries, private
resume storage, imported facts remaining unverified, human approval boundaries,
and uncertain application submissions never being retried automatically.

Production UI is the Next.js static export in next-app/. Backend schema comes
from supabase/migrations/. Never recommend treating a model assertion as human
verification or employer submission evidence. Check that workflow automation
uses trusted main code, tests the current PR commit against current main, and
never exposes deployment credentials to PR code.

Keep findings actionable: identify the trigger, affected behavior and relevant
file/line. Do not treat preferences about formatting as correctness failures.
