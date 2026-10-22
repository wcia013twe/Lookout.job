import test from 'node:test';
import assert from 'node:assert/strict';
import { awardStatus, claimPack, dayStamp, streak, recordRoleOpened } from '../next-app/lib/progress.mjs';

function store() {
  const state = { progress: { xp: 0, xpAwards: {}, streakDays: [] }, drops: { packRewards: {}, packStamps: {} } };
  return {
    state,
    get(path) { return path.split('.').reduce((value, key) => value?.[key], state); },
    set(path, value) {
      const keys = path.split('.'), last = keys.pop();
      keys.reduce((value, key) => value[key] ||= {}, state)[last] = value;
    },
    update(path, fn) { this.set(path, fn(this.get(path))); },
  };
}

test('tracker awards milestone differences per application without rewarding replay or downgrades', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 14, 12) });
  const s = store();
  awardStatus(s, 'a', 'Applied');
  assert.equal(s.state.progress.xp, 50);
  for (const status of ['Applied', 'New', 'unknown']) awardStatus(s, 'a', status);
  assert.equal(s.state.progress.xp, 50);
  awardStatus(s, 'a', 'Interview');
  assert.equal(s.state.progress.xp, 250);
  awardStatus(s, 'a', 'Phone Screen');
  assert.equal(s.state.progress.xp, 250);
  awardStatus(s, 'b', 'Applied');
  assert.equal(s.state.progress.xp, 300);
  assert.deepEqual(s.state.progress.xpAwards, { a: 250, b: 50 });
  assert.deepEqual(s.state.progress.streakDays, ['2026-10-14']);
});

test('pack rewards survive replay and persisted legacy reward keys, then renew the next day', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 14, 12) });
  const s = store(), today = dayStamp();
  assert.equal(claimPack(s), true);
  assert.equal(claimPack(s), false);
  assert.equal(s.state.progress.xp, 25);
  assert.equal(s.get(`drops.packStamps.${today}`), true);

  const migrated = store();
  migrated.set(`drops.packRewards.${today}`, true);
  migrated.set('progress.xp', 75);
  assert.equal(claimPack(migrated), false);
  assert.equal(migrated.state.progress.xp, 75);

  t.mock.timers.setTime(new Date(2026, 9, 15, 12).getTime());
  assert.equal(claimPack(s), true);
  assert.equal(s.state.progress.xp, 50);
  assert.deepEqual(s.state.progress.streakDays, ['2026-10-14', '2026-10-15']);
});

test('streak counts consecutive local days once and stops at gaps', () => {
  const now = new Date(2026, 9, 13, 12);
  for (const [days, expected] of [
    [[], 0],
    [['2026-10-11', '2026-10-12'], 2],
    [['2026-10-12', '2026-10-13', '2026-10-13'], 2],
    [['2026-10-10', '2026-10-12'], 1],
    [['2026-10-11'], 0],
  ]) assert.equal(streak(days, now), expected, JSON.stringify(days));
});


test('opening a posting preserves prior tracker dates and statuses across repeated opens', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 22, 12) });
  const s = store();
  s.set('tracker.ids', ['existing']);
  s.set('tracker.items', { existing: { openedDate: '2026-10-01', appliedDate: '2026-10-02', status: 'Interview' } });
  recordRoleOpened(s, 'existing');
  recordRoleOpened(s, 'new');
  recordRoleOpened(s, 'new');
  assert.deepEqual(s.get('tracker.ids'), ['existing', 'new']);
  assert.deepEqual(s.get('tracker.items.existing'), { openedDate: '2026-10-01', appliedDate: '2026-10-02', status: 'Interview' });
  assert.deepEqual(s.get('tracker.items.new'), { openedDate: '2026-10-22', status: 'New' });
  assert.equal(s.get('progress.xp'), 0);
});
