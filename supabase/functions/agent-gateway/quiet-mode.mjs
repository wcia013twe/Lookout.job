/** Notification advice only: this does not schedule or send messages. */
export function normalizeQuietMode(input = {}) {
  input = input && typeof input === "object" ? input : {};
  let timezone = typeof input.timezone === "string" ? input.timezone : "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); }
  catch { timezone = "UTC"; }
  const integer = (value, min, max, fallback) => Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  return {
    cadence: ["immediate", "daily", "weekly"].includes(input.cadence) ? input.cadence : "immediate",
    timezone,
    digestHour: integer(input.digestHour, 0, 23, 9),
    digestDay: integer(input.digestDay, 0, 6, 1),
    urgentDeadlineHours: integer(input.urgentDeadlineHours, 1, 168, 24),
  };
}

function localParts(date, timezone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
}

function digestSlot(date, settings) {
  const p = localParts(date, settings.timezone);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day));
  if (p.hour < settings.digestHour) day.setUTCDate(day.getUTCDate() - 1);
  if (settings.cadence === "weekly") day.setUTCDate(day.getUTCDate() - (day.getUTCDay() - settings.digestDay + 7) % 7);
  return day.toISOString().slice(0, 10);
}

/** events: { id, actionRequired, kind: deadline|interview|review, deadlineAt, interrupt }.
 * interrupt is set only by the server's mapping of trusted important decisions;
 * callers must never copy an interrupt flag from agent-supplied event payloads.
 */
export function buildDeliveryPolicy({ settings = {}, now = new Date(), lastDigestAt = null, events = [] } = {}) {
  const policy = normalizeQuietMode(settings);
  const current = new Date(now);
  if (!Number.isFinite(current.getTime())) throw new TypeError("A valid current time is required.");
  events = Array.isArray(events) ? events.filter(event => event && typeof event === "object") : [];
  const urgentEvents = events.filter(event => {
    if (event.actionRequired !== true || !["deadline", "interview", "review"].includes(event.kind)) return false;
    if (event.interrupt === true && ["interview", "review"].includes(event.kind)) return true;
    const deadline = new Date(event.deadlineAt).getTime();
    return typeof event.deadlineAt === "string" && Number.isFinite(deadline) && deadline >= current.getTime() && deadline - current.getTime() <= policy.urgentDeadlineHours * 3600000;
  });
  const slot = policy.cadence === "immediate" ? null : digestSlot(current, policy);
  const last = lastDigestAt ? new Date(lastDigestAt) : null;
  const previousSlot = last && Number.isFinite(last.getTime()) ? digestSlot(last, policy) : null;
  const hasEvents = events.length > 0;
  const reason = !hasEvents ? "no_activity" : urgentEvents.length ? "urgent_action" : policy.cadence === "immediate" ? "immediate" : !previousSlot || slot > previousSlot ? "digest_due" : "digest_already_delivered";
  return { ...policy, decision: ["urgent_action", "immediate", "digest_due"].includes(reason) ? "due" : "defer", reason, urgentEventIds: urgentEvents.map(event => event.id).filter(Boolean), digestSlot: slot };
}
