function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return { day: d.toLocaleDateString("id-ID", { day: "2-digit" }), month: d.toLocaleDateString("id-ID", { month: "short" }) };
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
  const { data, error } = await sb
    .from("schedules").select("*")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true }).limit(4);

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">Belum ada jadwal mendatang.</div>`;
    return;
  }
  el.innerHTML = data.map(s => {
    const { day, month } = formatDateShort(s.date);
    const typeClass = ["SHOW", "EXCLUSIVE", "EVENT"].includes(s.type) ? s.type : "OTHER";
    return `
    <div class="schedule-card">
      <div class="date-box"><div class="d">${day}</div><div class="m">${month}</div></div>
      <div class="info" style="flex:1;">
        <span class="type-badge type-${typeClass}" style="margin-bottom:6px;display:inline-block;">${escapeHtml(s.type)}</span>
        <h4>${escapeHtml(s.title)}</h4>
        <div class="meta">
          <span><i class="fa-solid fa-clock"></i> ${s.start_time ? s.start_time.slice(0,5) : ''} WIB</span>
        </div>
      </div>
    </div>`;
  }).join("");
}

loadNewsPreview();
loadSchedulePreview();
