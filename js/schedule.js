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

function populateMonthFilter() {
  const select = document.getElementById("filter-month");
  select.innerHTML = `<option value="">Semua Bulan</option>`;
  const now = new Date();
  for (let i = -1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    select.innerHTML += `<option value="${value}">${label}</option>`;
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

  const type = document.getElementById("filter-type").value;
  const monthVal = document.getElementById("filter-month").value;

  let query = sb.from("schedules").select("*").order("date", { ascending: true }).order("start_time", { ascending: true });

  if (type) query = query.eq("type", type);
  if (monthVal) {
    const [year, month] = monthVal.split("-");
    const start = `${year}-${month}-01`;
    const nextMonth = new Date(Number(year), Number(month), 1); // month is 1-indexed here so this = first day of next month
    const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
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
          ${s.start_time ? `<span><i class="fa-solid fa-clock"></i> ${s.start_time.slice(0,5)} WIB</span>` : ""}
        </div>
      </div>
    </div>`;
}

document.getElementById("filter-type").addEventListener("change", resetAndLoad);
document.getElementById("filter-month").addEventListener("change", resetAndLoad);
document.getElementById("load-more").addEventListener("click", () => loadSchedules(true));

populateMonthFilter();
loadSchedules();
