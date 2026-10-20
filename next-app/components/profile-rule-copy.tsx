"use client";
import { useApplicationProfile } from "./application-profile-context";
import { useSearchHarness } from "../lib/search-harness";
import { copyLegacyRules } from "../../lib/recruiting-targets.mjs";
import { secondary, Notice } from "./ui";
export default function ProfileRuleCopy() {
  const a = useApplicationProfile(),
    h = useSearchHarness();
  const legacy =
    h.context?.documents?.find(
      (d: { kind: string; id: string }) =>
        d.kind === "rules" && d.id === "shared",
    )?.content || "";
  const current = a.field("Profile evaluation", "Rules");
  return (
    <div className="my-4 space-y-3 text-sm">
      <p className="text-board-muted">
        Previously shared rules are retained for reference. Copy them once if
        you want this profile to use them; later edits stay independent.
      </p>
      {h.busy ? (
        <Notice>Loading previous rules…</Notice>
      ) : h.error ? (
        <>
          <Notice>{h.error}</Notice>
          <button type="button" className={secondary} onClick={h.reload}>
            Reload previous rules
          </button>
        </>
      ) : legacy.trim() ? (
        <>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-board-tag p-3 text-sm font-sans">
            {legacy}
          </pre>
          <button
            type="button"
            className={secondary}
            disabled={
              a.busy ||
              current.conflict ||
              current.value.includes(legacy.trim())
            }
            onClick={() =>
              a.change(
                "Profile evaluation",
                "Rules",
                copyLegacyRules(current.value, legacy),
              )
            }
          >
            {current.value.includes(legacy.trim())
              ? "Already included in this profile"
              : "Copy into this profile"}
          </button>
        </>
      ) : (
        <p className="text-board-muted">No previous shared rules found.</p>
      )}
    </div>
  );
}
