function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadNewsPreview() {
  const el = document.getElementById("news-scroll");
  const { data, error } = await sb.from("news").select("*").order("published_at", { ascending: false }).limit(6);
  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">Belum ada berita.</div>`;
    return;
  }
  el.innerHTML = data.map(n => `
    <a class="news-card" href="${n.source_url ? escapeHtml(n.source_url) : '#'}" target="_blank" rel="noopener">
      <div class="body">
        <div class="tag">${escapeHtml(n.category || 'Berita')}</div>
        <h4>${escapeHtml(n.title)}</h4>
        <div class="date">${new Date(n.published_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</div>
      </div>
    </a>`).join("");
}

async function loadSchedulePreview() {
  const el = document.getElementById("schedule-list");

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 86400000);

  const { data, error } = await sb.from("schedules").select("*")
    .eq("type", "SHOW")
    .gte("date", today.toISOString().slice(0, 10))
    .lte("date", in7Days.toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">Belum ada show dalam 7 hari ke depan.</div>`;
    return;
  }

  // Sorted date+time ascending -> data[0] selalu show paling deket, jadi
  // "kalau ada 2 show, yang paling duluan di atas" otomatis kejamin dari urutan query.
  el.innerHTML = data.map(renderShowCard).join("");
  initShowCards(data);
}

loadNewsPreview();
loadSchedulePreview();
