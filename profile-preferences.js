/* Search preferences belong to the person; tier lists rank companies separately. */
(function () {
  const form = document.querySelector("#search-preferences-form");
  const feedback = document.querySelector("#search-preferences-feedback");
  const store = JB.store;
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
    render();
  });
  document.addEventListener("workspace:hydrated", render);
  render();
})();
