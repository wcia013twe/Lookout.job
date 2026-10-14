import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuietMode, buildDeliveryPolicy } from "../quiet-mode.mjs";
const events = [{ id: "routine", kind: "submission" }];
test("invalid settings fall back to valid defaults", () => {
  assert.deepEqual(normalizeQuietMode({ timezone: "wrong", cadence: "never", digestHour: 24 }), { cadence: "immediate", timezone: "UTC", digestHour: 9, digestDay: 1, urgentDeadlineHours: 24 });
});
test("empty activity defers even with immediate cadence", () => {
  assert.equal(buildDeliveryPolicy().decision, "defer");
  assert.equal(buildDeliveryPolicy({ events }).decision, "due");
});
test("daily digest respects local hour and delivered slot", () => {
  const settings = { cadence: "daily", timezone: "America/New_York", digestHour: 9 };
  const lastDigestAt = "2026-10-12T13:05:00Z";
  assert.equal(buildDeliveryPolicy({ settings, events, lastDigestAt, now: "2026-10-13T12:59:00Z" }).decision, "defer");
  assert.equal(buildDeliveryPolicy({ settings, events, lastDigestAt, now: "2026-10-13T13:00:00Z" }).decision, "due");
});
test("weekly digest remains eligible after scheduled day until acknowledged", () => {
  const settings = { cadence: "weekly", digestDay: 1 };
  assert.equal(buildDeliveryPolicy({ settings, events, now: "2026-10-14T10:00:00Z", lastDigestAt: "2026-10-12T10:00:00Z" }).decision, "defer");
  assert.equal(buildDeliveryPolicy({ settings, events, now: "2026-10-14T10:00:00Z", lastDigestAt: "2026-10-05T10:00:00Z" }).decision, "due");
});
test("urgent interruption requires action, supported context, and future deadline", () => {
  const options = { settings: { cadence: "weekly" }, now: "2026-10-14T10:00:00Z", lastDigestAt: "2026-10-12T10:00:00Z" };
  const urgent = { id: "interview", actionRequired: true, kind: "interview", deadlineAt: "2026-10-14T12:00:00Z" };
  assert.equal(buildDeliveryPolicy({ ...options, events: [urgent] }).reason, "urgent_action");
  for (const change of [{ actionRequired: false }, { kind: "submission" }, { deadlineAt: "invalid" }, { deadlineAt: "2026-10-14T09:00:00Z" }, { deadlineAt: "2026-10-16T12:00:00Z" }]) {
    assert.equal(buildDeliveryPolicy({ ...options, events: [{ ...urgent, ...change }] }).decision, "defer");
  }
});
test("digest slots follow daylight saving local time", () => {
  const result = buildDeliveryPolicy({ settings: { cadence: "daily", timezone: "America/New_York" }, events, now: "2026-11-01T14:00:00Z", lastDigestAt: "2026-10-31T13:00:00Z" });
  assert.equal(result.digestSlot, "2026-11-01");
  assert.equal(result.decision, "due");
});
test("trusted important interview and review decisions interrupt without an invented deadline", () => {
  const options = { settings: { cadence: "weekly" }, now: "2026-10-14T10:00:00Z", lastDigestAt: "2026-10-12T10:00:00Z" };
  for (const kind of ["interview", "review"]) {
    const event = { id: kind, actionRequired: true, interrupt: true, kind };
    const result = buildDeliveryPolicy({ ...options, events: [event] });
    assert.equal(result.reason, "urgent_action");
    assert.deepEqual(result.urgentEventIds, [kind]);
    assert.equal(event.deadlineAt, undefined);
  }
  for (const event of [
    { actionRequired: false, interrupt: true, kind: "review" },
    { actionRequired: true, interrupt: true, kind: "deadline" },
    { actionRequired: true, interrupt: true, kind: "submission" },
    { actionRequired: true, kind: "interview" },
  ]) assert.equal(buildDeliveryPolicy({ ...options, events: [event] }).decision, "defer");
});
