/* Native autofill may change values with or without input events. Never retain
   verification for changed facts until the person checks the current values. */
(function () {
  window.JB.profileAutofillGuard = function (form, fields, onChange, readFacts) {
    const signature = () => JSON.stringify(readFacts ? readFacts() : fields.map(name => form.elements[name].value.trim()));
    const checkbox = form.elements.verified;
    let reviewed = null;
    const changed = event => {
      if (!fields.includes(event.target.name) && !(readFacts && event.target.matches?.("[data-profile-field]"))) return;
      checkbox.checked = false;
      reviewed = null;
      onChange?.();
    };
    form.addEventListener('input', changed);
    form.addEventListener('change', changed);
    checkbox.addEventListener('change', event => { reviewed = checkbox.checked && event.isTrusted ? signature() : null; });
    return {
      invalidate() { checkbox.checked = false; reviewed = null; onChange?.(); },
      reset(verified) { checkbox.checked = verified === true; reviewed = checkbox.checked ? signature() : null; },
      isReviewed() {
        const valid = checkbox.checked && reviewed === signature();
        if (!valid) checkbox.checked = false;
        return valid;
      },
    };
  };
})();
