function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return { day: d.toLocaleDateString("id-ID", { day: "2-digit" }), month: d.toLocaleDateString("id-ID", { month: "short" }) };
}

const PAGE_SIZE = 15;
let offset = 0;
let currentType = "";

async function populateYearFilter() {
  const select = document.getElementById("filter-year");
  select.innerHTML = `<option value="">Semua Tahun</option>`;

  const [{ data: oldest }, { data: newest }] = await Promise.all([
    sb.from("schedules").select("date").order("date", { ascending: true }).limit(1),
    sb.from("schedules").select("date").order("date", { ascending: false }).limit(1),
  ]);

  const minYear = oldest?.[0]?.date ? new Date(oldest[0].date).getFullYear() : new Date().getFullYear();
  const maxYear = newest?.[0]?.date ? new Date(newest[0].date).getFullYear() : new Date().getFullYear();

  for (let y = maxYear; y >= minYear; y--) {
    select.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

function resetAndLoad() {
  offset = 0;
  loadSchedules();
}

async function loadSchedules(append = false) {
  const el = document.getElementById("schedule-list");
  const loadMoreBtn = document.getElementById("load-more");
  if (!append) el.innerHTML = `<div class="schedule-card"><div class="skeleton" style="width:56px;height:56px;"></div></div>`;

  const month = document.getElementById("filter-month").value;
  const year = document.getElementById("filter-year").value;

  let query = sb.from("schedules").select("*").order("date", { ascending: true }).order("start_time", { ascending: true });

  if (currentType) query = query.eq("type", currentType);

  if (year && month) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const nd = new Date(Number(year), Number(month), 1);
    const end = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-01`;
    query = query.gte("date", start).lt("date", end);
  } else if (year) {
    query = query.gte("date", `${year}-01-01`).lt("date", `${Number(year) + 1}-01-01`);
  } else if (month) {
    const y = new Date().getFullYear();
    const start = `${y}-${String(month).padStart(2, "0")}-01`;
    const nd = new Date(y, Number(month), 1);
    const end = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-01`;
    query = query.gte("date", start).lt("date", end);
  } else {
    query = query.gte("date", new Date().toISOString().slice(0, 10));
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data, error } = await query;

  if (error) {
    el.innerHTML = `<div class="empty-state">Gagal memuat jadwal.</div>`;
    loadMoreBtn.style.display = "none";
    return;
  }
  if (!data || data.length === 0) {
    if (!append) el.innerHTML = `<div class="empty-state">Belum ada jadwal untuk filter ini.</div>`;
    loadMoreBtn.style.display = "none";
    return;
  }

  const html = data.map(renderScheduleCard).join("");
  el.innerHTML = append ? el.innerHTML + html : html;
  offset += data.length;

  loadMoreBtn.style.display = data.length === PAGE_SIZE ? "inline-flex" : "none";
}

function renderScheduleCard(s) {
  const { day, month } = formatDateShort(s.date);
  const team = (s.member_type || "").toUpperCase();
  const teamClass = ["LOVE", "DREAM", "HAPPY", "TRAINEE", "JKT48"].includes(team) ? team : "DEFAULT";
  const typeClass = ["SHOW", "EXCLUSIVE", "EVENT"].includes(s.type) ? s.type : "OTHER";

  return `
    <div class="schedule-card">
      <div class="date-box"><div class="d">${day}</div><div class="m">${month}</div></div>
      <div class="info" style="flex:1;">
        <div style="display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
          <span class="type-badge type-${typeClass}">${escapeHtml(s.type)}</span>
          ${s.member_type ? `<span class="team-badge team-${teamClass}"><i class="fa-solid fa-users"></i> ${escapeHtml(s.member_type)}</span>` : ""}
        </div>
        <h4>${escapeHtml(s.title)}</h4>
        <div class="meta">
          <span>${new Date(s.date).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</span>
          ${s.start_time ? `<span><i class="fa-solid fa-clock"></i> ${s.start_time.slice(0,5)} WIB</span>` : ""}
        </div>
      </div>
    </div>`;
}

document.getElementById("type-segmented").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if (!btn) return;
  document.querySelectorAll("#type-segmented button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentType = btn.dataset.type;
  resetAndLoad();
});

document.getElementById("filter-month").addEventListener("change", resetAndLoad);
document.getElementById("filter-year").addEventListener("change", resetAndLoad);

populateYearFilter();
loadSchedules();
