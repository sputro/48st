let currentUser = null;
let currentProfile = null;

function idr(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}
function showSettingsMsg(text, type) {
  const el = document.getElementById("settings-msg");
  el.textContent = text;
  el.className = "form-msg " + type;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function init() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  const { data: profile, error } = await sb.from("profiles").select("*").eq("id", currentUser.id).single();
  if (error || !profile) {
    showSettingsMsg("Gagal memuat profil.", "error");
    return;
  }
  currentProfile = profile;
  renderProfile();
  buildAvatarGrid();
  bindEvents();
}

function avatarSrc(profile) {
  return profile.avatar_url || (window.APP_CONFIG.AVATAR_PRESET_PATH + "1.png");
}

function renderProfile() {
  document.getElementById("profile-name").textContent = currentProfile.username || "Member 48ST";
  document.getElementById("profile-email").textContent = currentUser.email || "";
  document.getElementById("current-username").textContent = currentProfile.username || "-";
  document.getElementById("input-username").value = currentProfile.username || "";
  document.getElementById("wallet-balance").textContent = idr(currentProfile.wallet_balance);

  const src = avatarSrc(currentProfile);
  document.getElementById("profile-avatar").src = src;
  document.getElementById("topbar-avatar").src = src;
}

function buildAvatarGrid() {
  const grid = document.getElementById("avatar-grid");
  const count = window.APP_CONFIG.AVATAR_PRESET_COUNT;
  const base = window.APP_CONFIG.AVATAR_PRESET_PATH;
  let html = "";
  for (let i = 1; i <= count; i++) {
    const src = `${base}${i}.png`;
    const isSelected = currentProfile.avatar_url === src;
    html += `<button type="button" class="${isSelected ? "selected" : ""}" data-avatar="${src}">
      <img src="${src}" alt="Avatar ${i}" loading="lazy">
    </button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => selectAvatar(btn.dataset.avatar));
  });
}

async function selectAvatar(src) {
  const { error } = await sb.from("profiles").update({ avatar_url: src }).eq("id", currentUser.id);
  if (error) {
    alert("Gagal menyimpan foto profil: " + error.message);
    return;
  }
  currentProfile.avatar_url = src;
  renderProfile();
  buildAvatarGrid();
  closeAvatarModal();
}

function openAvatarModal() { document.getElementById("avatar-modal").style.display = "flex"; }
function closeAvatarModal() { document.getElementById("avatar-modal").style.display = "none"; }

function toggleInlineForm(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === "none" ? "block" : "none";
}

function bindEvents() {
  document.getElementById("open-avatar-picker").addEventListener("click", openAvatarModal);
  document.getElementById("close-avatar-picker").addEventListener("click", closeAvatarModal);
  document.getElementById("avatar-modal").addEventListener("click", (e) => {
    if (e.target.id === "avatar-modal") closeAvatarModal();
  });

  document.getElementById("row-edit-name").addEventListener("click", () => toggleInlineForm("form-edit-name"));
  document.getElementById("row-edit-password").addEventListener("click", () => toggleInlineForm("form-edit-password"));

  document.getElementById("save-name").addEventListener("click", saveName);
  document.getElementById("save-password").addEventListener("click", savePassword);

  document.getElementById("btn-topup").addEventListener("click", openTopUp);
  document.getElementById("btn-history").addEventListener("click", showWalletHistory);
  document.getElementById("row-topup-history").addEventListener("click", showMyTickets);

  document.getElementById("row-logout").addEventListener("click", logout);
}

async function saveName() {
  const newName = document.getElementById("input-username").value.trim();
  if (newName.length < 3) {
    showSettingsMsg("Nama minimal 3 karakter.", "error");
    return;
  }
  const { error } = await sb.from("profiles").update({ username: newName }).eq("id", currentUser.id);
  if (error) {
    showSettingsMsg(
      error.message.includes("duplicate") ? "Nama sudah dipakai orang lain." : "Gagal menyimpan nama.",
      "error"
    );
    return;
  }
  currentProfile.username = newName;
  renderProfile();
  showSettingsMsg("Nama berhasil diperbarui.", "success");
  toggleInlineForm("form-edit-name");
}

async function savePassword() {
  const p1 = document.getElementById("input-new-password").value;
  const p2 = document.getElementById("input-confirm-password").value;

  if (p1.length < 8) {
    showSettingsMsg("Password minimal 8 karakter.", "error");
    return;
  }
  if (p1 !== p2) {
    showSettingsMsg("Konfirmasi password tidak cocok.", "error");
    return;
  }

  // Supabase Auth handles hashing/storage — the app never sees or stores raw passwords itself.
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) {
    showSettingsMsg("Gagal mengganti password: " + error.message, "error");
    return;
  }
  document.getElementById("input-new-password").value = "";
  document.getElementById("input-confirm-password").value = "";
  showSettingsMsg("Password berhasil diganti.", "success");
  toggleInlineForm("form-edit-password");
}

async function openTopUp() {
  const amount = prompt("Masukkan nominal top up (Rp, minimal 10.000):", "50000");
  if (!amount || isNaN(amount) || Number(amount) < 10000) {
    if (amount !== null) alert("Nominal minimal Rp 10.000");
    return;
  }

  const { data: { session } } = await sb.auth.getSession();

  let res, json;
  try {
    res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/create-topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    json = await res.json();
  } catch {
    alert("Gagal terhubung ke server pembayaran. Coba lagi nanti.");
    return;
  }

  if (json.error) {
    alert(json.error);
    return;
  }
  if (json.message) {
    // DOKU belum dikonfigurasi (secrets belum diisi)
    alert(json.message);
    return;
  }
  if (!json.qr_content) {
    alert("Gagal membuat QRIS. Coba lagi nanti.");
    return;
  }

  showQrisModal(json.qr_content, json.partner_reference_no, json.amount);
}

function showQrisModal(qrContent, partnerRefNo, amount) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "qris-modal";
  overlay.innerHTML = `
    <div class="modal-sheet" style="text-align:center;">
      <h4>Scan QRIS untuk Bayar
        <button class="close-btn" id="close-qris-modal"><i class="fa-solid fa-xmark"></i></button>
      </h4>
      <div id="qr-canvas-wrap" style="display:flex; justify-content:center; margin:10px 0 16px;"></div>
      <div style="font-weight:700; font-size:18px; margin-bottom:4px;">Rp ${Number(amount).toLocaleString("id-ID")}</div>
      <div id="qris-status" style="font-size:13px; color:var(--muted);">
        <i class="fa-solid fa-spinner fa-spin"></i> Menunggu pembayaran...
      </div>
      <p style="font-size:12px; color:var(--muted); margin-top:14px;">
        Buka aplikasi e-wallet / m-banking apapun yang support QRIS, lalu scan kode di atas.
        Saldo otomatis bertambah begitu pembayaran terkonfirmasi.
      </p>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("close-qris-modal").addEventListener("click", () => {
    clearInterval(pollTimer);
    overlay.remove();
  });

  // Render QR from the raw qrContent string using the qrcode.js CDN library.
  const qrLib = document.createElement("script");
  qrLib.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  qrLib.onload = () => {
    // eslint-disable-next-line no-undef
    new QRCode(document.getElementById("qr-canvas-wrap"), {
      text: qrContent, width: 220, height: 220,
    });
  };
  document.head.appendChild(qrLib);

  // Poll every 4 seconds for up to 5 minutes.
  let attempts = 0;
  const pollTimer = setInterval(async () => {
    attempts++;
    const { data: { session } } = await sb.auth.getSession();
    try {
      const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/check-topup-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ partner_reference_no: partnerRefNo }),
      });
      const json = await res.json();

      if (json.status === "paid") {
        clearInterval(pollTimer);
        document.getElementById("qris-status").innerHTML = `<i class="fa-solid fa-circle-check" style="color:#1a8a45;"></i> Pembayaran berhasil!`;
        const { data: profile } = await sb.from("profiles").select("*").eq("id", currentUser.id).single();
        currentProfile = profile;
        renderProfile();
        setTimeout(() => overlay.remove(), 1800);
      }
    } catch {
      // ignore transient errors, keep polling
    }
    if (attempts >= 75) clearInterval(pollTimer); // ~5 minutes
  }, 4000);
}

async function showWalletHistory() {
  const { data, error } = await sb
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    alert("Belum ada riwayat transaksi.");
    return;
  }
  const lines = data.map(
    (t) => `${new Date(t.created_at).toLocaleDateString("id-ID")} — ${t.type} — ${idr(t.amount)}`
  );
  alert(lines.join("\n"));
}

async function showMyTickets() {
  const { data, error } = await sb
    .from("tickets")
    .select("*, streams(title)")
    .eq("user_id", currentUser.id)
    .order("purchased_at", { ascending: false });

  if (error || !data || data.length === 0) {
    alert("Kamu belum punya tiket/akses konten.");
    return;
  }
  alert(data.map((t) => t.streams?.title || t.stream_id).join("\n"));
}

async function logout() {
  if (!confirm("Yakin mau keluar?")) return;
  await sb.auth.signOut();
  window.location.href = window.APP_CONFIG.LOGIN_URL;
}

init();
