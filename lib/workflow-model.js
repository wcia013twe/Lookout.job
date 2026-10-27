(function () {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const event = (text) => ({
    at: new Date().toISOString(),
    text,
    actor: "user",
  });
  const stages = [
    "Queued",
    "Draft",
    "Awaiting approval",
    "Approved",
    "Blocked",
    "Submitted",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
  ];
  const trackingStages = [
    "Submitted",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
  ];
  const submittedStages = ["Submitted", "Interview", "Offer"];
  window.JB.workflowModel = {
    stages,
    trackingStages,
    questionId(question, index = 0) {
      return String(question.id || question.fieldId || `employer-question-${index}`);
    },
    canEdit(draft) {
      return !trackingStages.includes(draft.status);
    },
    recordStage(draft, status, note) {
      if (!trackingStages.includes(status))
        throw new Error("Choose a tracking stage.");
      if (draft.status === status) return copy(draft);
      if (!note?.trim() || note.trim().length > 2000)
        throw new Error(
          "Add a note explaining this update (up to 2000 characters).",
        );
      if (
        ["Interview", "Offer"].includes(status) &&
        !submittedStages.includes(draft.status)
      )
        throw new Error(
          "Record submission before tracking an interview or offer.",
        );
      const next = copy(draft);
      next.status = status;
      if (status === "Submitted" && !next.submittedAt)
        next.submittedAt = new Date().toISOString();
      next.activity = [
        ...(next.activity || []),
        event(`You reported ${status}: ${note.trim()}`),
      ];
      return next;
    },
    create(role) {
      return {
        id: role.id,
        company: role.company,
        title: role.title,
        employmentType: role.employmentType,
        location: role.location,
        url: role.applicationUrl,
        status: "Queued",
        revision: 0,
        resumeId: "",
        questions: [],
        questionsReviewed: false,
        blocker: "",
        approved: null,
        activity: [event("Application queued by you")],
      };
    },
    edit(draft, fields) {
      const next = { ...copy(draft), ...copy(fields) };
      const changed = [
        "resumeId",
        "searchProfileId",
        "questions",
        "questionsReviewed",
        "lastAnswerConfirmation",
        "blocker",
      ].some((key) => JSON.stringify(next[key]) !== JSON.stringify(draft[key]));
      if (!changed) return next;
      if (trackingStages.includes(draft.status))
        throw new Error(
          "This application is already in tracking. Its submitted draft cannot be edited.",
        );
      if (next.resumeId !== draft.resumeId) delete next.resumeSha256;
      next.revision += 1;
      next.approved = null;
      next.status = next.blocker
        ? "Blocked"
        : next.questionsReviewed
          ? "Awaiting approval"
          : "Draft";
      next.activity.push(
        event("Draft updated by you; previous approval cleared"),
      );
      return next;
    },
    approve(draft, resume, profile) {
      if (trackingStages.includes(draft.status))
        throw new Error("This application is already in tracking.");
      if (!profile.name?.trim() || !profile.email?.trim())
        throw new Error("Save your name and email in Profile first.");
      if (!profile.verified)
        throw new Error(
          "Check and save your factual profile in Profile first.",
        );
      if (!resume || resume.id !== draft.resumeId)
        throw new Error("Select an existing resume reference first.");
      if (!draft.questionsReviewed)
        throw new Error("Review the complete employer question list first.");
      if (draft.blocker)
        throw new Error("Resolve the blocker before approving.");
      if (draft.questions.some((q) => !q.question.trim() || !q.answer.trim()))
        throw new Error("Every question needs an answer before approval.");
      if (draft.approved?.revision === draft.revision) return copy(draft);
      const next = copy(draft);
      next.status = "Approved";
      next.approved = {
        revision: next.revision,
        at: new Date().toISOString(),
        resume: copy(resume),
        profile: copy(profile),
        questions: copy(next.questions),
      };
      next.activity.push(
        event("Draft approved by you; waiting for a connected runner"),
      );
      return next;
    },
  };
})();
