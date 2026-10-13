/* Muse connection management. Keys are shown once, never stored in browser state. */
(function () {
  const form = document.querySelector("#agent-connection-form"),
    list = document.querySelector("#agent-connection-list");
  const feedback = document.querySelector("#agent-connection-feedback"),
    issued = document.querySelector("#agent-issued");
  const key = document.querySelector("#agent-issued-key");
  let account = null,
    generation = 0;
  const scopes = [
    "workspace:read",
    "batches:write",
    "drafts:write",
    "activity:write",
    "approvals:read",
    "resumes:read",
  ];
  const endpoint =
    "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-gateway";
  const mcpUrl =
    "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp";
  async function call(operation, payload = {}) {
    if (!JB.auth?.userId || JB.auth.userId !== account)
      throw Error("Sign in to manage agent connections.");
    const expectedOwner = account;
    const { data: sessionData, error: sessionError } =
      await JB.auth.client.auth.getSession();
    if (sessionError || sessionData.session?.user?.id !== expectedOwner)
      throw Error("Account changed. Retry from your account.");
    const { data, error } = await JB.auth.client.functions.invoke(
      "agent-gateway",
      {
        body: { operation, payload },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      },
    );
    if (error || data?.error)
      throw Error(
        data?.error?.message ||
          data?.error ||
          "Agent connection request failed.",
      );
    return data;
  }
  async function refresh() {
    const token = ++generation;
    account = JB.auth?.userId || null;
    key.value = "";
    issued.hidden = true;
    form.inert = !account;
    if (!account) {
      list.innerHTML = "";
      feedback.textContent = "Sign in to connect your own agent.";
      return;
    }
    feedback.textContent = "Loading connections…";
    try {
      const response = await call("connections.list");
      if (token !== generation) return;
      list.innerHTML =
        (response.data || [])
          .map(
            (connection) =>
              `<article class="workflow-row"><div><strong>${JB.esc(connection.name)}</strong><p>${connection.revoked_at ? "Revoked" : `${new Date(connection.expires_at).getTime() <= Date.now() ? "Expired" : "Expires"} ${JB.esc(new Date(connection.expires_at).toLocaleDateString())}`}</p></div>${connection.revoked_at ? "" : `<button type="button" data-revoke-agent="${JB.esc(connection.id)}">Revoke</button>`}</article>`,
          )
          .join("") || '<p class="panel-note">No connected agents yet.</p>';
      feedback.textContent = "";
    } catch (error) {
      if (token === generation) feedback.textContent = error.message;
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const expectedOwner = account,
      token = generation,
      button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await call("connections.issue", {
        name: form.elements.name.value.trim(),
        expiresInDays: 30,
        scopes:
          form.elements.access.value === "read" ? ["workspace:read"] : scopes,
      });
      if (token !== generation) return;
      await refresh();
      if (account !== expectedOwner || JB.auth?.userId !== expectedOwner)
        return;
      key.value = response.token;
      issued.hidden = false;
      feedback.textContent =
        "Connection created. Use Copy token for Muse’s secure token field. The token will not be shown again.";
    } catch (error) {
      if (token === generation) feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-revoke-agent]");
    if (!button) return;
    button.disabled = true;
    try {
      await call("connections.revoke", { id: button.dataset.revokeAgent });
      await refresh();
      feedback.textContent = "Agent access revoked.";
    } catch (error) {
      feedback.textContent = error.message;
      button.disabled = false;
    }
  });
  document.querySelector("#agent-copy-token").addEventListener("click", async () => {
    if (!key.value) return;
    try {
      await navigator.clipboard.writeText(key.value);
      feedback.textContent = "Token copied. Paste it into Muse’s secure token field.";
    } catch {
      key.type = "text";
      key.focus();
      key.select();
      feedback.textContent = "Copy the selected token manually into Muse’s secure token field.";
    }
  });
  document
    .querySelector("#agent-copy-setup")
    .addEventListener("click", async () => {
      if (!key.value) return;
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(
            {
              mcpServers: {
                "job-board": {
                  url: mcpUrl,
                  headers: { Authorization: `Bearer ${key.value}` },
                },
              },
              httpGateway: endpoint,
            },
            null,
            2,
          ),
        );
        feedback.textContent =
          "Agent setup copied. Treat the key like a password.";
      } catch {
        key.type = "text";
        key.focus();
        key.select();
        feedback.textContent =
          "Copy the selected key manually. The gateway URL is shown below.";
      }
    });
  document.querySelector("#agent-hide-key").addEventListener("click", () => {
    key.value = "";
    issued.hidden = true;
  });
  document.addEventListener("workspace:account", () => {
    ++generation;
    key.value = "";
    issued.hidden = true;
    setTimeout(refresh, 0);
  });
  refresh();
})();
