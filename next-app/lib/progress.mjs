export function dayStamp(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function recordDay(store) {
  const day = dayStamp();
  store.update("progress.streakDays", (days) =>
    [...new Set([...(days || []), day])].slice(-90),
  );
}
export function awardStatus(store, id, status) {
  const target =
    {
      Applied: 50,
      OA: 100,
      "Phone Screen": 250,
      Interview: 250,
      Onsite: 500,
      Offer: 1000,
    }[status] || 0;
  store.update("progress", (p) => {
    const previous = p.xpAwards?.[id] || 0;
    if (target <= previous) return p;
    return {
      ...p,
      xp: (p.xp || 0) + target - previous,
      xpAwards: { ...p.xpAwards, [id]: target },
    };
  });
  recordDay(store);
}
export function claimPack(store) {
  const day = dayStamp();
  if (store.get(`drops.packRewards.${day}`)) return false;
  store.set(`drops.packRewards.${day}`, true);
  store.set(`drops.packStamps.${day}`, true);
  store.update("progress.xp", (xp) => (xp || 0) + 25);
  recordDay(store);
  return true;
}
export function streak(days, date = new Date()) {
  const set = new Set(days || []);
  const d = new Date(date);
  if (!set.has(dayStamp(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (set.has(dayStamp(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// Inspecting a role is read-only; call only when its external posting is opened.
export function recordRoleOpened(store, roleId) {
  recordDay(store);
  store.update("tracker.ids", ids => [...new Set([...(ids || []), roleId])]);
  store.update("tracker.items", items => ({
    ...items,
    [roleId]: { ...items?.[roleId], openedDate: items?.[roleId]?.openedDate || dayStamp(), status: items?.[roleId]?.status || "New" },
  }));
}
