// ============================================================
// 1. TOKEN GATE
// ============================================================
const TOKEN_STORAGE_KEY = "lc_watch_token";
const NAME_STORAGE_KEY = "lc_chat_name";

function slugifyName(raw) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "anonim";
}

async function checkTokenAndInit() {
  const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (saved) {
    const { data: valid } = await sb.rpc("verify_watch_token", { p_token: saved });
    if (valid) {
      unlockPage();
      return;
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  document.getElementById("token-gate").style.display = "flex";
}

function unlockPage() {
  document.getElementById("token-gate").style.display = "none";
  document.getElementById("main-content").style.display = "block";
  ensureChatName();
  initPlayer();
  initChat();
  initFeedback();
}

document.getElementById("token-submit").addEventListener("click", async () => {
  const input = document.getElementById("token-input");
  const msg = document.getElementById("token-msg");
  const token = input.value.trim();

  if (!token) {
    msg.textContent = "Isi dulu tokennya.";
    msg.className = "form-msg error";
    return;
  }

  const { data: valid, error } = await sb.rpc("verify_watch_token", { p_token: token });

  if (error || !valid) {
    msg.textContent = "Token gak valid.";
    msg.className = "form-msg error";
    return;
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  unlockPage();
});

// ============================================================
// 2. NAMA CHAT (slug custom)
// ============================================================
function ensureChatName() {
  let name = localStorage.getItem(NAME_STORAGE_KEY);
  if (!name) {
    const raw = prompt("Masukkan nama buat chat kamu:", "") || "Anonim";
    name = slugifyName(raw);
    localStorage.setItem(NAME_STORAGE_KEY, name);
  }
}

// ============================================================
// 3. ARTPLAYER + HLS (custom m3u8)
// ============================================================
let player = null;

function playM3u8(url) {
  if (player) { player.destroy(); player = null; }

  player = new Artplayer({
    container: "#art-player",
    url,
    volume: 0.7,
    isLive: true,
    autoplay: true,
    pip: true,
    autoSize: false,
    setting: true,
    fullscreen: true,
    fullscreenWeb: true,
    customType: {
      m3u8: function (video, url) {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url; // Safari native HLS
        }
      },
    },
  });
}

function initPlayer() {
  loadCurrentStream();

  // Kalau admin ganti link pas ada yang lagi nonton, otomatis ke-update.
  sb.channel("stream-config-updates")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stream_config" }, (payload) => {
      const newUrl = payload.new?.m3u8_url;
      if (newUrl) playM3u8(newUrl);
    })
    .subscribe();
}

async function loadCurrentStream() {
  const statusEl = document.getElementById("stream-status");
  const { data, error } = await sb.from("stream_config").select("m3u8_url").eq("id", 1).single();

  if (error || !data?.m3u8_url) {
    statusEl.textContent = "Belum ada live stream yang di-set admin.";
    return;
  }

  statusEl.textContent = "";
  playM3u8(data.m3u8_url);
}

// ============================================================
// 4. LIVE CHAT (realtime, 24 jam)
// ============================================================
function escapeHtmlLC(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderChatMessage(msg) {
  const el = document.getElementById("chat-messages");
  const time = new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const div = document.createElement("div");
  div.className = "lc-chat-msg";
  div.innerHTML = `<span class="sender">${escapeHtmlLC(msg.sender_name)}</span><span class="time">${time}</span><br>${escapeHtmlLC(msg.message)}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

async function initChat() {
  const listEl = document.getElementById("chat-messages");
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("live_chat_messages")
    .select("*")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(200);

  listEl.innerHTML = "";
  if (!error && data && data.length > 0) {
    data.forEach(renderChatMessage);
  } else {
    listEl.innerHTML = `<div class="empty-state" style="padding:20px;">Belum ada chat. Jadi yang pertama!</div>`;
  }

  // Subscribe realtime buat pesan baru.
  sb.channel("live-chat-room")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_messages" }, (payload) => {
      if (listEl.querySelector(".empty-state")) listEl.innerHTML = "";
      renderChatMessage(payload.new);
    })
    .subscribe();

  document.getElementById("chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;

    const senderName = localStorage.getItem(NAME_STORAGE_KEY) || "anonim";
    input.value = "";

    await sb.from("live_chat_messages").insert({ sender_name: senderName, message });
  });
}

// ============================================================
// 5. FLOATING FEEDBACK (nagging, playful — bukan ancaman beneran)
// ============================================================
const NAG_MESSAGES = [
  "Woy isi feedback!",
  "Jangan kabur sebelum isi feedback ya...",
  "48ST akan tau kalau kamu skip ini 👀",
  "1 menit aja, isi feedback dong!",
  "Serius deh, feedback kamu penting banget",
];

function initFeedback() {
  const btn = document.getElementById("fb-open-btn");
  const textEl = document.getElementById("fb-btn-text");
  let nagIndex = 0;

  setTimeout(() => { btn.style.display = "flex"; }, 8000); // muncul setelah 8 detik nonton

  setInterval(() => {
    nagIndex = (nagIndex + 1) % NAG_MESSAGES.length;
    textEl.textContent = NAG_MESSAGES[nagIndex];
  }, 6000);

  btn.addEventListener("click", openFeedbackModal);
}

function openFeedbackModal() {
  const overlay = document.createElement("div");
  overlay.className = "fb-modal-overlay";
  overlay.innerHTML = `
    <div class="fb-modal">
      <h3 style="margin:0 0 4px;"><i class="fa-solid fa-comment-dots" style="color:var(--red);"></i> Kasih Feedback</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 8px;">Anonim, gak perlu login. Jujur aja gapapa.</p>
      <textarea id="fb-text" placeholder="Tulis unek-unek kamu di sini..."></textarea>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-outline" id="fb-cancel" style="flex:1;">Nanti Aja</button>
        <button class="btn btn-primary" id="fb-send" style="flex:1;">Kirim</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("fb-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById("fb-send").addEventListener("click", async () => {
    const text = document.getElementById("fb-text").value.trim();
    if (!text) return;

    await sb.from("feedback").insert({ message: text, page_url: location.href });

    overlay.innerHTML = `<div class="fb-modal" style="text-align:center;">
      <i class="fa-solid fa-circle-check" style="font-size:32px;color:#1a8a45;margin-bottom:10px;"></i>
      <p>Makasih! Feedback kamu udah kekirim.</p>
    </div>`;
    setTimeout(() => overlay.remove(), 1500);
    document.getElementById("fb-open-btn").style.display = "none";
  });
}

// ============================================================
checkTokenAndInit();
