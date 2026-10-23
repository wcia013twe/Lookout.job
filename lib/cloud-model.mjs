import {savedJobAssessment} from "./job-assessment.mjs";
const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value || "",
  );
function draftPayload(application) {
  return {
    resumeId: application.resumeId,
    questions: application.questions,
    questionsReviewed: application.questionsReviewed,
    company: application.company,
    title: application.title,
    employmentType: application.employmentType,
    location: application.location,
    url: application.url,
    ...(application.searchProfileId ? {searchProfileId:application.searchProfileId} : {}),
    // Agent-prepared evidence is part of the approved draft, not UI-only state.
    // Preserve only supported runner metadata; arbitrary client fields stay local.
    ...(application.resumeSha256
      ? { resumeSha256: application.resumeSha256 }
      : {}),
    ...(application.formFingerprint
      ? { formFingerprint: application.formFingerprint }
      : {}),
  };
}
function fromCloud(rows) {
  const p = rows.profiles[0],
    pref = rows.preferences[0];
  return {
    cloudDirty: false,
    deletedAnswerIds: [],
    profile: {
      name: "",
      email: "",
      phone: "",
      location: "",
      authorization: "",
      ...(p?.facts || {}),
      verified: Boolean(p?.verified_at),
    },
    theme: pref?.theme || { pack: "base" },
    searchPreferences: pref?.search || {},
    tierLists: pref?.tier_lists || [],
    activeTierListId: pref?.active_tier_list_id || "",
    savedAnswers: rows.answer_library.map((a) => ({
      id: a.id,
      question: a.question,
      answer: a.answer,
      policy: a.autofill_policy,
      companyScope: a.company_scope || "",
      verifiedAt: a.verified_at,
      version: a.context?.version || 1,
      updatedAt: a.updated_at,
      ...(a.provenance === "agent" ? { imported: true, requestedPolicy: a.context?.requestedPolicy || "ask" } : {}),
    })),
    resumes: rows.resumes.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.reference_url || "",
      objectPath: r.object_path,
      supersededBy: r.superseded_by || null,
      contentHash: r.content_hash || null,
      variant: r.variant || "Master",
      version: r.version,
    })),
    applications: Object.fromEntries(
      rows.applications.map((a) => [
        a.job_id,
        {
          resumeId: "",
          questions: [],
          questionsReviewed: false,
          ...a.draft,
          // Shared employer facts identify the role; drafts supply personal answers.
          company: a.jobs?.employer?.company ?? a.draft?.company,
          companyId: a.jobs?.company_id ?? null,
          title: a.jobs?.employer?.title ?? a.draft?.title,
          employmentType: a.jobs?.employer?.employmentType ?? a.draft?.employmentType,
          location: a.jobs?.employer?.location ?? a.draft?.location,
          url: a.jobs?.canonical_url ?? a.draft?.url,
          id: a.job_id,
          backendId: a.id,
          backendRevision: a.revision,
          milestones: (rows.application_milestones || []).filter(m => m.application_id === a.id)
            .sort((one,two)=>String(one.created_at).localeCompare(String(two.created_at)) || String(one.id).localeCompare(String(two.id))),
          submittedResume: (() => {
            const t = (rows.submission_attempts || []).filter(t => t.application_id===a.id && t.state==='confirmed')
              .sort((one,two)=>String(two.finished_at || two.created_at).localeCompare(String(one.finished_at || one.created_at)) || String(two.id).localeCompare(String(one.id)))[0];
            const r=t?.resume_snapshot;
            return r?.id ? {id:r.id,name:r.name || "Saved résumé",version:r.version ?? null,variant:r.variant || null,contentHash:r.content_hash || null} : null;
          })(),
          submittedAt: a.submitted_at || null,
          receipt: a.receipt || null,
          submissionAttempts: (rows.submission_attempts || []).filter(t => t.application_id === a.id)
            .map(t => ({id:t.id,state:t.state,startedAt:t.started_at,createdAt:t.created_at,finishedAt:t.finished_at})) ,
          status: a.status,
          revision: a.revision,
          blocker: a.blocker || "",
          approved:
            a.status === "Approved"
              ? { revision: a.revision, at: a.updated_at }
              : null,
          activity: (rows.activity_events || [])
            .filter((event) => event.application_id === a.id)
            .sort((one, two) => one.occurred_at.localeCompare(two.occurred_at))
            .map((event) => ({
              id: event.id,
              at: event.occurred_at,
              text:
                event.payload?.text ||
                event.payload?.note ||
                event.payload?.message ||
                event.kind,
              actor: event.actor,
              kind: event.kind,
            })),
        },
      ]),
    ),
  };
}
function batchRoles(items, date) {
  return items
    .filter((item) => item.jobs)
    .map((item) => ({
      ...(item.jobs?.employer || {}),
      id: item.job_id,
      applicationUrl: item.jobs?.canonical_url,
      discoveredDate: date,
      whyItFits: item.recommendation?.whyItFits || "",
      priority: item.recommendation?.priority || "",
      matchAssessment: savedJobAssessment(item.recommendation?.matchAssessment),
      materialGap: typeof item.recommendation?.materialGap === "string" ? item.recommendation.materialGap : "",
      searchProfileId: item.recommendation?.searchProfileId,
      category: item.recommendation?.category || "",
      sourceFreshness: item.recommendation?.sourceFreshness || item.jobs?.employer?.sourceFreshness || "Not recorded",
      applicationStatus: "New",
    }));
}
export { batchRoles, draftPayload, fromCloud, uuid };
