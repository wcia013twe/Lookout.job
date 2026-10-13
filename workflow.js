(function () {
  const store = JB.store,
    model = JB.workflowModel,
    esc = JB.esc;
  const applications = () => store.get("workflow.applications") || {};
  const resumes = () => store.get("workflow.resumes") || [];
  const profile = () => store.get("workflow.profile") || {};
  const uid = () => crypto.randomUUID();
  const dialog = document.querySelector("#application-review");
  const draftForm = document.querySelector("#draft-form");
  let reviewing = null;
  // Tracking changes are explicit user claims; only a runner receipt proves submission.
  document.querySelector("#application-stage").innerHTML =
    '<option value="">All stages</option>' +
    model.stages.map((stage) => `<option>${esc(stage)}</option>`).join("");
  document
    .querySelector("#review-timeline")
    .insertAdjacentHTML(
      "beforebegin",
      `<section id="review-tracking" class="workflow-form"><h3>Update application progress</h3><p>Record an application you submitted yourself or a later outcome. This does not submit anything.</p><label>Stage<select id="tracking-stage">${model.trackingStages.map((stage) => `<option>${esc(stage)}</option>`).join("")}</select></label><label>Update note<input id="tracking-note" maxlength="2000" placeholder="For example: submitted on the employer website"></label><button type="button" id="record-stage">Record update</button></section>`,
    );
  const save = (draft) =>
    store.update("workflow.applications", (items) => ({
      ...(items || {}),
      [draft.id]: draft,
    }));
  const openTab = (id) =>
    document.querySelector(`[aria-controls="${id}"]`)?.click();

  function row(draft) {
    return `<article class="workflow-row"><div><strong>${esc(draft.company)}</strong><p>${esc(draft.title)}</p><small>${esc(draft.status)}${draft.status === "Approved" ? " · waiting for runner" : draft.status === "Submitted" ? (draft.receipt ? " · receipt saved" : " · reported by you") : ""}</small></div><button type="button" data-review="${esc(draft.id)}">${model.canEdit(draft) ? "Review" : "View progress"}</button></article>`;
  }

  function render() {
    const list = Object.values(applications());
    const stage = document.querySelector("#application-stage").value;
    const needle = document.querySelector("#search").value.toLowerCase();
    const type = document.querySelector("#type-filter").value;
    const filtered = list.filter(
      (d) =>
        (!stage || stage === d.status) &&
        (!type || type === d.employmentType) &&
        `${d.company} ${d.title} ${d.location}`.toLowerCase().includes(needle),
    );
    document.querySelector("#application-list").innerHTML =
      filtered.map(row).join("") ||
      '<p class="empty">No drafts here. Queue a role from Discover.</p>';
    const needs = list.filter(
      (d) => d.status === "Awaiting approval" || d.status === "Blocked",
    );
    const setup = !profile().verified || !resumes().length;
    document.querySelector("#needs-count").textContent =
      needs.length + (setup ? 1 : 0) || "";
    document.querySelector("#needs-list").innerHTML =
      (setup
        ? '<article class="workflow-row"><div><strong>Set up your application profile</strong><p>Verify factual answers and add a resume reference.</p></div><button type="button" data-open-profile>Set up</button></article>'
        : "") + needs.map(row).join("") ||
      '<p class="empty">Nothing needs your attention. <button type="button" data-open-discover>Discover roles</button></p>';
    document.querySelector("#resume-list").innerHTML =
      resumes()
        .map(
          (r) =>
            `<div class="workflow-row"><div><strong>${esc(r.name)}</strong><p>${r.objectPath ? `<button type="button" data-open-resume="${esc(r.id)}">Open private resume</button>` : `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">Open resume reference</a>`}</p></div></div>`,
        )
        .join("") || '<p class="panel-note">No resume references yet.</p>';
  }

  function suggestAnswer(el) {
    const question = el.querySelector('[data-field="question"]').value;
    const answer = el.querySelector('[data-field="answer"]');
    const target = el.querySelector(".saved-answer-suggestion");
    target.innerHTML = "";
    if (answer.value.trim()) return;
    const library = store.get("workflow.savedAnswers") || [];
    const company = applications()[reviewing]?.company || "";
    const automatic = JB.savedAnswerModel.automatic(library, question, company);
    if (automatic) {
      applySavedAnswer(el, automatic);
      target.textContent =
        "Filled from your reviewed saved answer. Review before approving.";
      return;
    }
    target.innerHTML = JB.savedAnswerModel
      .matching(library, question, company)
      .map(
        (a) =>
          `<button type="button" class="saved-answer-use" data-use-answer="${esc(a.id)}">Use saved answer${a.companyScope ? ` · ${esc(a.companyScope)}` : ""}</button>`,
      )
      .join("");
  }
  function applySavedAnswer(el, answer) {
    if (el.querySelector('[data-field="answer"]').value.trim()) return;
    el.querySelector('[data-field="answer"]').value = answer.answer;
    el.dataset.savedAnswerId = answer.id;
    el.dataset.savedAnswerVersion = answer.version;
    draftForm.elements.questionsReviewed.checked = false;
  }
  function questionHTML(q, index = 0) {
    return `<fieldset class="review-question" data-question="${esc(model.questionId(q, index))}" data-saved-answer-id="${esc(q.savedAnswerId || "")}" data-saved-answer-version="${esc(q.savedAnswerVersion || "")}"><label>Employer question<textarea data-field="question" required>${esc(q.question)}</textarea></label><label>Draft answer<textarea data-field="answer">${esc(q.answer)}</textarea></label><div class="saved-answer-suggestion"></div><button type="button" data-remove-question>Remove question</button></fieldset>`;
  }

  function openReview(id) {
    const draft = applications()[id];
    if (!draft) return;
    reviewing = id;
    document.querySelector("#review-role").textContent =
      `${draft.company} · ${draft.title}`;
    document.querySelector("#review-feedback").textContent = "";
    document.querySelector("#review-resume").innerHTML =
      '<option value="">Select a resume reference</option>' +
      resumes()
        .map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`)
        .join("");
    draftForm.elements.resumeId.value = draft.resumeId;
    draftForm.elements.questionsReviewed.checked = draft.questionsReviewed;
    draftForm.elements.blocker.value = draft.blocker;
    document.querySelector("#review-questions").innerHTML = draft.questions
      .map(questionHTML)
      .join("");
    if (model.canEdit(draft))
      document
        .querySelectorAll("#review-questions [data-question]")
        .forEach(suggestAnswer);
    const p = profile();
    document.querySelector("#review-profile").textContent =
      [p.name, p.email, p.phone, p.location, p.authorization]
        .filter(Boolean)
        .join(" · ") || "No factual profile saved.";
    document.querySelector("#tracking-stage").value =
      model.trackingStages.includes(draft.status) ? draft.status : "Submitted";
    document.querySelector("#tracking-note").value = "";
    const editable = model.canEdit(draft);
    draftForm
      .querySelectorAll("input,textarea,select,button")
      .forEach((input) => {
        input.disabled = !editable;
      });
    // Tracking controls may be inside the form but remain available after submission.
    document
      .querySelectorAll(
        "#review-tracking input,#review-tracking select,#review-tracking button",
      )
      .forEach((input) => {
        input.disabled = false;
      });
    renderTimeline(draft);
    if (!dialog.open) dialog.showModal();
    dialog.dispatchEvent(new CustomEvent("workflow:review", { bubbles: true }));
  }

  function renderTimeline(draft) {
    document.querySelector("#review-timeline").innerHTML = (
      draft.activity || []
    )
      .map(
        (a) =>
          `<li>${esc(a.text)} <small>${esc(a.actor === "agent" ? "Agent" : a.actor === "system" ? "System" : "You")} · ${esc(new Date(a.at).toLocaleString())}</small></li>`,
      )
      .join("");
  }

  document
    .querySelector("#record-stage")
    .addEventListener("click", async () => {
      const button = document.querySelector("#record-stage");
      const feedback = document.querySelector("#review-feedback");
      const current = applications()[reviewing];
      if (!current) return;
      button.disabled = true;
      try {
        const status = document.querySelector("#tracking-stage").value;
        const note = document.querySelector("#tracking-note").value.trim();
        model.recordStage(current, status, note); // Validate before saving form edits.
        const latest = model.canEdit(current) ? collect() : current;
        if (model.canEdit(current)) save(latest);
        const updated = model.recordStage(latest, status, note);
        if (JB.auth?.userId) await JB.cloud.setStage(current.id, status, note);
        else save(updated);
        openReview(current.id);
        feedback.textContent =
          "Progress recorded as your update. No application was submitted by this action.";
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

  function collect() {
    const current = applications()[reviewing];
    if (!current) throw new Error("This draft is no longer available.");
    return model.edit(current, {
      resumeId: draftForm.elements.resumeId.value,
      questionsReviewed: draftForm.elements.questionsReviewed.checked,
      blocker: draftForm.elements.blocker.value.trim(),
      questions: [
        ...document.querySelectorAll("#review-questions [data-question]"),
      ].map((el) => {
        // Keep the agent's exact employer field mapping and validation metadata.
        const existing =
          current.questions.find(
            (question, index) => model.questionId(question, index) === el.dataset.question,
          ) || {};
        const { savedAnswerId, savedAnswerVersion, ...employerFields } =
          existing;
        return {
          ...employerFields,
          id: el.dataset.question,
          question: el.querySelector('[data-field="question"]').value.trim(),
          answer: el.querySelector('[data-field="answer"]').value.trim(),
          ...(el.dataset.savedAnswerId
            ? {
                savedAnswerId: el.dataset.savedAnswerId,
                savedAnswerVersion: Number(el.dataset.savedAnswerVersion),
              }
            : {}),
        };
      }),
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-profile]")) openTab("profile");
    if (event.target.closest("[data-open-discover]")) openTab("daily-board");
    const review = event.target.closest("[data-review]");
    if (review) openReview(review.dataset.review);
    const queue = event.target.closest("[data-queue-role]");
    if (queue) {
      const role = (JB.roles || []).find(
        (r) => r.id === queue.dataset.queueRole,
      );
      if (!role || applications()[role.id]) return;
      save(model.create(role));
      queue.textContent = "Queued";
      queue.disabled = true;
    }
    if (event.target.closest("[data-remove-question]")) {
      event.target.closest("[data-question]").remove();
      draftForm.elements.questionsReviewed.checked = false;
    }
  });
  document
    .querySelector("#review-questions")
    .addEventListener("input", (event) => {
      const el = event.target.closest("[data-question]");
      if (!el) return;
      delete el.dataset.savedAnswerId;
      delete el.dataset.savedAnswerVersion;
      el.querySelector(".saved-answer-suggestion").innerHTML = "";
      draftForm.elements.questionsReviewed.checked = false;
    });
  document
    .querySelector("#review-questions")
    .addEventListener("change", (event) => {
      const el = event.target.closest("[data-question]");
      if (el) suggestAnswer(el);
    });
  document
    .querySelector("#review-questions")
    .addEventListener("click", (event) => {
      const button = event.target.closest("[data-use-answer]");
      if (!button) return;
      const el = button.closest("[data-question]");
      const company = applications()[reviewing]?.company || "";
      const answer = JB.savedAnswerModel
        .matching(
          store.get("workflow.savedAnswers") || [],
          el.querySelector('[data-field="question"]').value,
          company,
        )
        .find((a) => a.id === button.dataset.useAnswer);
      if (answer) {
        applySavedAnswer(el, answer);
        el.querySelector(".saved-answer-suggestion").textContent =
          "Saved answer selected. Review before approving.";
      }
    });
  document
    .querySelector("#review-close")
    .addEventListener("click", () => dialog.close());
  document.querySelector("#add-question").addEventListener("click", () => {
    draftForm.elements.questionsReviewed.checked = false;
    const list = document.querySelector("#review-questions");
    list.insertAdjacentHTML(
      "beforeend",
      questionHTML({ id: uid(), question: "", answer: "" }),
    );
    list.lastElementChild
      .querySelector("textarea")
      .focus({ preventScroll: true });
  });
  draftForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const draft = collect();
      save(draft);
      renderTimeline(draft);
      document.querySelector("#review-feedback").textContent = "Draft saved.";
    } catch (error) {
      document.querySelector("#review-feedback").textContent = error.message;
    }
  });
  document
    .querySelector("#approve-draft")
    .addEventListener("click", async () => {
      const feedback = document.querySelector("#review-feedback");
      try {
        if (!draftForm.reportValidity()) return;
        const draft = collect();
        save(draft);
        if (JB.auth?.userId) {
          await JB.cloud.approve(draft.id);
          renderTimeline(applications()[draft.id]);
          feedback.textContent =
            "This version is approved in your account. It has not been submitted.";
          return;
        }
        const approved = model.approve(
          draft,
          resumes().find((r) => r.id === draft.resumeId),
          profile(),
        );
        save(approved);
        renderTimeline(approved);
        feedback.textContent =
          "This version is approved. It has not been submitted.";
      } catch (error) {
        feedback.textContent = error.message;
      }
    });
  const profileForm = document.querySelector("#profile-form");
  Object.entries(profile()).forEach(([key, value]) => {
    const input = profileForm.elements[key];
    if (input) {
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
  });
  function refreshProfile(event) {
    if (event.type === "workspace:account") {
      reviewing = null;
      dialog.close();
      draftForm.reset();
    }
    profileForm.reset();
    document.querySelector("#resume-form").reset();
    document.querySelector("#profile-feedback").textContent = "";
    Object.entries(profile()).forEach(([key, value]) => {
      const input = profileForm.elements[key];
      if (!input) return;
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    });
    render();
  }
  document.addEventListener("workspace:account", refreshProfile);
  document.addEventListener("workspace:hydrated", refreshProfile);
  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const p = {};
    ["name", "email", "phone", "location", "authorization"].forEach((key) => {
      p[key] = profileForm.elements[key].value.trim();
    });
    p.verified = profileForm.elements.verified.checked;
    store.set("workflow.profile", p);
    document.querySelector("#profile-feedback").textContent = p.verified
      ? "Profile saved and checked by you."
      : "Profile saved; not marked verified.";
  });
  document.querySelector("#resume-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const url = form.elements.url.value.trim();
    if (!(JB.auth?.userId ? /^https:\/\//i : /^https?:\/\//i).test(url)) {
      form.elements.url.setCustomValidity("Use an http or https resume link.");
      form.reportValidity();
      return;
    }
    store.set("workflow.resumes", [
      ...resumes(),
      { id: uid(), name: form.elements.name.value, url },
    ]);
    form.reset();
  });
  document
    .querySelector("#resume-form input")
    .addEventListener("input", (event) => event.target.setCustomValidity(""));
  document
    .querySelector("#application-stage")
    .addEventListener("change", render);
  document.querySelector("#search").addEventListener("input", render);
  document.querySelector("#type-filter").addEventListener("change", render);
  store.subscribe("workflow", render);
  render();
})();
