function showMsg(elId, text, type) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className = "form-msg " + type;
}

async function checkAdminSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    document.getElementById("admin-gate").style.display = "flex";
    return;
  }

  // Coba panggil salah satu RPC admin — kalau bukan admin, ini bakal reject
  // (RPC-nya sendiri yang ngecek role, bukan cuma UI).
  const { error } = await sb.rpc("admin_list_watch_tokens");
  if (error) {
    console.error("Admin check failed:", error);
    showMsg("login-msg", "Gagal: " + error.message, "error");
    await sb.auth.signOut();
    document.getElementById("admin-gate").style.display = "flex";
    return;
  }

  unlockAdmin();
}

function unlockAdmin() {
  document.getElementById("admin-gate").style.display = "none";
  document.getElementById("admin-content").style.display = "block";
  loadStreamConfig();
  loadTokens();
}

document.getElementById("admin-login-btn").addEventListener("click", async () => {
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    showMsg("login-msg", "Email/password salah.", "error");
    return;
  }
  checkAdminSession();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

// ---------- Stream URL ----------
async function loadStreamConfig() {
  const { data } = await sb.from("stream_config").select("*").eq("id", 1).single();
  document.getElementById("stream-url-input").value = data?.m3u8_url || "";
}

document.getElementById("save-stream-btn").addEventListener("click", async () => {
  const url = document.getElementById("stream-url-input").value.trim();
  const { error } = await sb.rpc("admin_set_stream_url", { p_url: url });
  showMsg("stream-msg", error ? "Gagal: " + error.message : "Tersimpan!", error ? "error" : "success");
});

// ---------- Tokens ----------
async function loadTokens() {
  const listEl = document.getElementById("token-list");
  const { data, error } = await sb.rpc("admin_list_watch_tokens");

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Belum ada token.</div>`;
    return;
  }

  listEl.innerHTML = data.map((t) => `
    <div class="token-item" data-id="${t.id}">
      <div><span class="t-code">${t.token}</span> ${t.label ? `<span style="color:var(--muted);">${t.label}</span>` : ""}</div>
      <button class="delete-token-btn" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
    </div>`).join("");

  listEl.querySelectorAll(".delete-token-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus token ini?")) return;
      await sb.rpc("admin_delete_watch_token", { p_id: btn.dataset.id });
      loadTokens();
    });
  });
}

document.getElementById("add-token-btn").addEventListener("click", async () => {
  const code = document.getElementById("new-token-code").value.trim();
  const label = document.getElementById("new-token-label").value.trim();
  if (!code) return;

  const { error } = await sb.rpc("admin_create_watch_token", { p_token: code, p_label: label || null });
  if (error) {
    showMsg("token-msg", "Gagal: " + error.message, "error");
    return;
  }
  document.getElementById("new-token-code").value = "";
  document.getElementById("new-token-label").value = "";
  showMsg("token-msg", "Token ditambahkan.", "success");
  loadTokens();
});

checkAdminSession();
