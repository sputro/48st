function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return { day: d.toLocaleDateString("id-ID", { day: "2-digit" }), month: d.toLocaleDateString("id-ID", { month: "short" }) };
}

const PAGE_SIZE = 20;
let offset = 0;
let currentType = "";

function resetAndLoad() {
  offset = 0;
  loadSchedules();
}

async function loadSchedules(append = false) {
  const el = document.getElementById("schedule-list");
  const loadMoreBtn = document.getElementById("load-more");
  if (!append) el.innerHTML = `<div class="simple-list-item"><div class="skeleton" style="width:52px;height:52px;"></div></div>`;

  let query = sb.from("schedules").select("*").order("date", { ascending: false }).order("start_time", { ascending: false });
  if (currentType) query = query.eq("type", currentType);
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

  const html = data.map(renderItem).join("");
  el.innerHTML = append ? el.innerHTML + html : html;
  offset += data.length;

  loadMoreBtn.style.display = data.length === PAGE_SIZE ? "inline-flex" : "none";

  // Fill in member photo strips async, after the cards are in the DOM.
  data.forEach((s) => {
    if (!s.member_type) return;
    const stripEl = document.getElementById(`strip-${s.id}`);
    injectMemberPhotoStrip(stripEl, s.member_type);
  });
}

function renderItem(s) {
  const { day, month } = formatDateShort(s.date);
  const team = (s.member_type || "").toUpperCase();
  const teamClass = ["LOVE", "DREAM", "PASSION", "TRAINEE", "JKT48"].includes(team) ? team : "DEFAULT";
  const typeClass = ["SHOW", "EXCLUSIVE", "EVENT"].includes(s.type) ? s.type : "OTHER";
  const logoPath = getShowLogoPath(s.title);

  return `
    <div class="simple-list-item">
      <div class="thumb-slot">
        <img class="show-logo-thumb" src="${logoPath}" alt=""
             onerror="handleLogoFallback(this, '${day}', '${month}')">
      </div>
      <div class="content">
        <div style="display:flex; gap:6px; margin-bottom:5px; flex-wrap:wrap;">
          <span class="type-badge type-${typeClass}">${escapeHtml(s.type)}</span>
          ${s.member_type ? `<span class="team-badge team-${teamClass}"><i class="fa-solid fa-users"></i> ${escapeHtml(s.member_type)}</span>` : ""}
        </div>
        <h4>${escapeHtml(s.title)}</h4>
        <div class="meta-row">
          <span>${new Date(s.date).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</span>
          ${s.start_time && s.start_time !== '00:00:00' ? `<span><i class="fa-solid fa-clock"></i> ${s.start_time.slice(0,5)} WIB</span>` : ""}
        </div>
        ${s.member_type ? `<div class="member-strip" id="strip-${s.id}"></div>` : ""}
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

document.getElementById("load-more").addEventListener("click", () => loadSchedules(true));

loadSchedules();
