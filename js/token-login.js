function showMsg(text, type) {
  const el = document.getElementById("msg");
  el.textContent = text;
  el.className = "form-msg " + type;
}
function setLoading(btn, loading, labelHtml) {
  btn.disabled = loading;
  btn.innerHTML = loading ? `<i class="fa-solid fa-spinner fa-spin"></i> Memproses...` : labelHtml;
}
function getNextUrl() {
  const next = new URLSearchParams(location.search).get("next");
  return next ? decodeURIComponent(next) : window.APP_CONFIG.MEMBER_REDIRECT_URL;
}

redirectIfAuthed();

const form = document.getElementById("token-form");
const defaultLabel = document.getElementById("submit-btn").innerHTML;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  setLoading(btn, true, defaultLabel);

  const token = document.getElementById("token").value.trim();

  try {
    let { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw new Error("Gagal membuat sesi: " + error.message);
      session = data.session;
    }

    const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/redeem-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ token }),
    });
    const json = await res.json();

    if (!res.ok || json.error) throw new Error(json.error || "Token tidak valid");

    showMsg("Token diterima. Mengalihkan...", "success");
    window.location.href = getNextUrl();
  } catch (err) {
    showMsg(err.message, "error");
    setLoading(btn, false, defaultLabel);
  }
});
