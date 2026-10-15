const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function preparationReminders(plans = {}, applications = {}) {
  return Object.entries(plans)
    .flatMap(([applicationId, value]) => {
      const plan = value?.plan || value;
      if (!plan || !Array.isArray(plan.tasks) || plan.deadline?.status !== "confirmed" || !datePattern.test(plan.deadline.date || "")) return [];
      const application = applications[applicationId] || {};
      return plan.tasks
        .filter((task) => !task.completed)
        .map((task) => ({
          id: `${applicationId}:${task.id}`,
          applicationId,
          taskId: task.id,
          title: task.title,
          detail: task.detail,
          minutes: task.minutes,
          dueDate: datePattern.test(task.dueDate || "") ? task.dueDate : null,
          deadlineDate: datePattern.test(plan.deadline?.date || "") ? plan.deadline.date : null,
          deadlineStage: plan.deadline?.stage || "Interview process",
          deadlineStatus: plan.deadline?.status || "needs_confirmation",
          sourceKind: plan.deadline?.source?.kind || "unknown",
          company: application.company || "Saved application",
          roleTitle: application.title || "Role not recorded",
        }));
    })
    .sort((left, right) => {
      const leftDate = left.dueDate || left.deadlineDate || "9999-12-31";
      const rightDate = right.dueDate || right.deadlineDate || "9999-12-31";
      return leftDate.localeCompare(rightDate) || left.company.localeCompare(right.company) || left.title.localeCompare(right.title);
    });
}

export function confirmedDeadlines(plans = {}, applications = {}) {
  return Object.entries(plans)
    .flatMap(([applicationId, value]) => {
      const plan = value?.plan || value;
      if (plan?.deadline?.status !== "confirmed" || !datePattern.test(plan.deadline.date || "")) return [];
      const application = applications[applicationId] || {};
      return [{
        applicationId,
        date: plan.deadline.date,
        stage: plan.deadline.stage || "Interview process",
        company: application.company || "Saved application",
        remaining: (plan.tasks || []).filter((task) => !task.completed).length,
        sourceKind: plan.deadline.source?.kind || "unknown",
      }];
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.company.localeCompare(right.company));
}

export function unconfirmedDeadlineCount(plans = {}) {
  return Object.values(plans).filter((value) => {
    const plan = value?.plan || value;
    return plan?.deadline?.status === "needs_confirmation";
  }).length;
}

export function dueLabel(value, today) {
  if (!datePattern.test(value || "")) return "No date yet";
  if (!datePattern.test(today || "")) return value;
  const days = Math.round((Date.parse(`${value}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}
