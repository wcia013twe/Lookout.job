/* Search preferences belong to the person; tier lists rank companies separately. */
(function () {
  const form = document.querySelector("#search-preferences-form");
  const feedback = document.querySelector("#search-preferences-feedback");
  const autoSubmit = document.querySelector("#auto-submit-approved");
  const autoSubmitFeedback = document.querySelector("#auto-submit-feedback");
  const store = JB.store;
  const reviewControls = ["fullTime", "internship"].map(key => ({
    key, type: key === "fullTime" ? "FT" : "Internship",
    list: document.querySelector(`#review-${key}-list`),
    threshold: document.querySelector(`#review-${key}-threshold`),
  }));
  function renderReviewPolicy(preferences) {
    const lists = store.get("workflow.tierLists") || [];
    for (const control of reviewControls) {
      const policy = preferences.reviewPolicy?.[control.key] || {};
      const choices = lists.filter(list => !list.employmentType || list.employmentType === control.type);
      control.list.replaceChildren(new Option("Automatic (one matching list)", ""),
        ...choices.map(list => new Option(list.name, list.id)));
      if (policy.tierListId && !choices.some(list => list.id === policy.tierListId)) {
        control.list.add(new Option("Selected list unavailable — review required", policy.tierListId));
      }
      control.list.value = policy.tierListId || "";
      control.threshold.value = ["S","A","B","C","D","all"].includes(policy.threshold) ? policy.threshold : "A";
    }
  }
  const values = () => store.get("workflow.searchPreferences") || {};
  const lines = (text) => [
    ...new Set(
      text
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  function render() {
    const preferences = values();
    autoSubmit.checked = preferences.autoSubmitApproved === true;
    renderReviewPolicy(preferences);
    for (const field of ["locations", "categories", "excludedCompanies"]) {
      form.elements[field].value = (
        Array.isArray(preferences[field])
          ? preferences[field].filter((value) => typeof value === "string")
          : []
      ).join("\n");
    }
    form.elements.fullTime.checked =
      !Array.isArray(preferences.employmentTypes) ||
      preferences.employmentTypes.includes("FT");
    form.elements.internship.checked =
      !Array.isArray(preferences.employmentTypes) ||
      preferences.employmentTypes.includes("Internship");
    form.elements.targetYear.value = preferences.targetYear || "";
  }

  autoSubmit.addEventListener("change", () => {
    store.set("workflow.searchPreferences", { ...values(), autoSubmitApproved: autoSubmit.checked });
    autoSubmitFeedback.textContent = JB.auth?.userId
      ? "Preference saved. Syncing to your account for Muse’s next settings check."
      : "Preference saved in this browser. Sign in to share it with Muse.";
  });

  for (const control of reviewControls) {
    const save = () => {
      const preferences = values();
      store.set("workflow.searchPreferences", { ...preferences, reviewPolicy: {
        ...preferences.reviewPolicy,
        [control.key]: { ...preferences.reviewPolicy?.[control.key], threshold: control.threshold.value, tierListId: control.list.value || null },
      } });
      autoSubmitFeedback.textContent = JB.auth?.userId
        ? "Review policy saved. Syncing for Muse’s next settings check."
        : "Review policy saved in this browser. Sign in to share it with Muse.";
    };
    control.list.addEventListener("change", save);
    control.threshold.addEventListener("change", save);
  }
  store.subscribe("workflow.tierLists", () => renderReviewPolicy(values()));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const employmentTypes = [];
    if (form.elements.fullTime.checked) employmentTypes.push("FT");
    if (form.elements.internship.checked) employmentTypes.push("Internship");
    if (!employmentTypes.length) {
      feedback.textContent = "Choose at least one role type.";
      return;
    }
    const preferences = { ...values(), employmentTypes };
    for (const field of ["locations", "categories", "excludedCompanies"]) {
      preferences[field] = lines(form.elements[field].value);
    }
    preferences.targetYear = form.elements.targetYear.value
      ? Number(form.elements.targetYear.value)
      : null;
    store.set("workflow.searchPreferences", preferences);
    feedback.textContent = JB.auth?.userId
      ? "Preferences saved. Syncing to your account."
      : "Preferences saved in this browser.";
  });

  document.addEventListener("workspace:account", () => {
    feedback.textContent = "";
    autoSubmitFeedback.textContent = "";
    render();
  });
  document.addEventListener("workspace:hydrated", render);
  render();
})();
