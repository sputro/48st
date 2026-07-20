function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return { day: d.toLocaleDateString("id-ID", { day: "2-digit" }), month: d.toLocaleDateString("id-ID", { month: "short" }) };
}

const PAGE_SIZE = 10;
let offset = 0;
let currentType = "";

async function populateYearFilter() {
  const select = document.getElementById("filter-year");
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

function buildBaseQuery() {
  const month = document.getElementById("filter-month").value;
  const year = document.getElementById("filter-year").value;

  const filters = (q) => {
    if (currentType) q = q.eq("type", currentType);
    if (year && month) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const nd = new Date(Number(year), Number(month), 1);
      const end = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-01`;
      q = q.gte("date", start).lt("date", end);
    } else if (year) {
      q = q.gte("date", `${year}-01-01`).lt("date", `${Number(year) + 1}-01-01`);
    } else if (month) {
      const y = new Date().getFullYear();
      const start = `${y}-${String(month).padStart(2, "0")}-01`;
      const nd = new Date(y, Number(month), 1);
      const end = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-01`;
      q = q.gte("date", start).lt("date", end);
    } else {
      q = q.gte("date", new Date().toISOString().slice(0, 10));
    }
    return q;
  };

  return filters;
}

function resetAndLoad() {
  offset = 0;
  loadSchedules();
}

async function loadSchedules(append = false) {
  const el = document.getElementById("schedule-list");
  const loadMoreBtn = document.getElementById("load-more");
  if (!append) el.innerHTML = `<div class="simple-list-item"><div class="skeleton" style="width:52px;height:52px;"></div></div>`;

  const applyFilters = buildBaseQuery();

  let dataQuery = applyFilters(sb.from("schedules").select("*").order("date", { ascending: false }).order("start_time", { ascending: false }));
  dataQuery = dataQuery.range(offset, offset + PAGE_SIZE - 1);

  let countQuery = applyFilters(sb.from("schedules").select("*", { count: "exact", head: true }));

  const [{ data, error }, { count }] = await Promise.all([dataQuery, countQuery]);

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

  const html = data.map(renderRow).join("");
  el.innerHTML = append ? el.innerHTML + html : html;
  offset += data.length;

  const showItems = data.filter((s) => s.type === "SHOW");
  if (showItems.length > 0 && typeof initShowCards === "function") initShowCards(showItems);

  const remaining = (count || 0) - offset;
  if (remaining > 0) {
    document.getElementById("load-more-label").textContent = `${remaining} jadwal lainnya`;
    loadMoreBtn.style.display = "flex";
  } else {
    loadMoreBtn.style.display = "none";
  }
}

function renderRow(s) {
  if (s.type === "SHOW") return renderShowCard(s);

  const { day, month } = formatDateShort(s.date);
  const typeClass = ["EXCLUSIVE", "EVENT"].includes(s.type) ? s.type : "OTHER";
  return `
    <div class="simple-list-item">
      <div class="thumb-slot"><div class="date-box"><div class="d">${day}</div><div class="m">${month}</div></div></div>
      <div class="content">
        <span class="type-badge type-${typeClass}">${escapeHtml(s.type)}</span>
        <h4 style="margin-top:6px;">${escapeHtml(s.title)}</h4>
        <div class="meta-row">
          <span>${new Date(s.date).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</span>
          ${s.start_time && s.start_time !== '00:00:00' ? `<span><i class="fa-solid fa-clock"></i> ${s.start_time.slice(0,5)} WIB</span>` : ""}
        </div>
      </div>
    </div>`;
}

document.getElementById("type-filter").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if (!btn) return;
  document.querySelectorAll("#type-filter button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentType = btn.dataset.type;
  resetAndLoad();
});

document.getElementById("filter-month").addEventListener("change", resetAndLoad);
document.getElementById("filter-year").addEventListener("change", resetAndLoad);
document.getElementById("load-more").addEventListener("click", () => loadSchedules(true));

populateYearFilter();
loadSchedules();
