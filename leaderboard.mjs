// Account progress is a server-derived projection. Guest pack XP remains browser-local.
// Only aliases and aggregate metrics leave an opted-in account.
const host = document.querySelector('#profile');
if (host) {
  const section = document.createElement('section');
  section.className = 'leaderboard-section';
  section.setAttribute('aria-labelledby', 'leaderboard-heading');
  section.innerHTML = `<h3 id="leaderboard-heading">Progress & leaderboard</h3>
    <p>Share an alias and progress counts. Your profile, resumes, jobs, and answers stay private.</p>
    <p id="leaderboard-status" role="status">Sign in to track account progress. Guest XP stays in this browser.</p>
    <form id="leaderboard-preferences" hidden>
      <label>Leaderboard alias <input name="alias" maxlength="40" required autocomplete="off"></label>
      <label class="leaderboard-opt-in"><input name="optedIn" type="checkbox"> Share my alias and metrics on the leaderboard</label>
      <button type="submit">Update sharing</button>
    </form>
    <p class="leaderboard-rules">Account XP: 5 per queued application, 10 for its first human approval, 15 when marked submitted. Applications tracked may be self-reported. Streaks use UTC days with queued, approved, or submitted applications.</p>
    <ol id="leaderboard-list" aria-label="Opted-in leaderboard"></ol>`;
  host.append(section);
  const form = section.querySelector('form'), status = section.querySelector('[role="status"]'), list = section.querySelector('ol');
  let generation = 0, timer;
  const owner = () => globalThis.JB?.auth?.userId;
  const client = () => globalThis.JB?.auth?.client;
  function renderEntries(entries) {
    list.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement('li'), alias = document.createElement('strong'), metrics = document.createElement('span');
      alias.textContent = entry.alias;
      metrics.textContent = `${entry.xp} XP · ${entry.streak} day streak · ${entry.applications_count} applications tracked`;
      item.append(alias, metrics);
      list.append(item);
    }
    if (!entries.length) {
      const item = document.createElement('li');
      item.textContent = 'No shared entries yet. Participation is optional.';
      list.append(item);
    }
  }
  async function refresh() {
    const token = ++generation, userId = owner();
    form.hidden = true;
    list.replaceChildren();
    if (!userId || !client()) {
      status.textContent = 'Sign in to track account progress. Guest XP stays in this browser.';
      return;
    }
    try {
      const { data, error } = await client().rpc('refresh_leaderboard');
      const own = Array.isArray(data) ? data[0] : data;
      if (error) throw error;
      if (!own || own.user_id !== userId) throw new Error('Account changed');
      if (token !== generation || userId !== owner()) return;
      form.hidden = false;
      form.elements.alias.value = own.alias;
      form.elements.optedIn.checked = own.opted_in;
      status.textContent = `${own.xp} account XP · ${own.streak} day streak · ${own.applications_count} applications tracked`;
      const { data: entries, error: readError } = await client().from('leaderboard_entries')
        .select('alias,xp,streak,applications_count').eq('opted_in', true)
        .order('xp', { ascending: false }).order('alias').limit(50);
      if (readError) throw readError;
      if (token !== generation || userId !== owner()) return;
      renderEntries(entries);
    } catch {
      if (token === generation && userId === owner()) status.textContent = 'Account progress is unavailable. Try again when connected.';
    }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const userId = owner(), button = form.querySelector('button');
    if (!userId) return;
    button.disabled = true;
    try {
      const { error } = await client().rpc('set_leaderboard_preferences', {
        alias: form.elements.alias.value.trim(), opted_in: form.elements.optedIn.checked,
      });
      if (error) throw error;
      if (userId === owner()) await refresh();
    } catch {
      if (userId === owner()) status.textContent = 'Sharing settings could not save. Your change is not published.';
    } finally { button.disabled = false; }
  });
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 250); }
  document.addEventListener('workspace:account', () => { generation++; refresh(); });
  document.addEventListener('workspace:cloud-ready', schedule);
  window.addEventListener('online', schedule);
  globalThis.JB.leaderboard = { refresh };
  refresh();
}
