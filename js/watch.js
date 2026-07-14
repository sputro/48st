// Reads ?stream=<id> from the URL, e.g. watch.html?stream=abc-123

function getStreamId() {
  return new URLSearchParams(location.search).get("stream");
}

async function init() {
  const session = await requireAuth();
  if (!session) return;

  const streamId = getStreamId();
  const box = document.getElementById("player-box");
  const stateEl = document.getElementById("player-state");

  if (!streamId) {
    stateEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Video tidak ditemukan.`;
    return;
  }

  // Metadata (title, poster) is public-read, safe to query directly.
  const { data: stream } = await sb.from("streams").select("*").eq("id", streamId).single();
  if (stream) {
    document.getElementById("video-title").textContent = stream.title;
    document.getElementById("video-meta").textContent =
      (stream.show_date ? new Date(stream.show_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "") +
      (stream.show_time ? ` • ${stream.show_time.slice(0,5)} WIB` : "");
  }

  try {
    // The ONLY place the real video location is ever resolved — server-side,
    // via the Edge Function, which checks ticket/token ownership first.
    const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/get-stream-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ stream_id: streamId }),
    });
    const json = await res.json();

    if (!res.ok || json.error) {
      stateEl.innerHTML = `<i class="fa-solid fa-lock"></i> ${json.error === "Ticket or access token required"
        ? "Kamu perlu beli tiket atau masukkan token akses dulu."
        : "Video belum tersedia."}`;
      return;
    }

    renderPlayer(box, json.url, session.user.email || session.user.id);
  } catch (e) {
    stateEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Gagal terhubung ke server video.`;
  }
}

function renderPlayer(box, signedUrl, watermarkLabel) {
  box.innerHTML = `
    <video
      controls
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      oncontextmenu="return false;"
      playsinline
      autoplay
    >
      <source src="${signedUrl}" type="video/mp4">
      Browser kamu tidak mendukung pemutaran video.
    </video>
    <div class="watermark">${escapeHtmlAttr(watermarkLabel)} • 48ST</div>
  `;

  // NOTE on realistic limits: this signed URL expires in ~30 minutes and requires
  // a valid ticket/token to be issued in the first place, so a copied link stops
  // working quickly and can't be regenerated without another authorized request.
  // It is NOT full DRM — a determined person can still screen-record playback.
  // The on-screen watermark (viewer's email/ID) exists specifically to discourage
  // that, since any recording carries an identifiable trace back to the account.
}

function escapeHtmlAttr(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

init();
