let currentStatus = "live";
let session = null;

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return { day: d.toLocaleDateString("id-ID", { day: "2-digit" }), month: d.toLocaleDateString("id-ID", { month: "short" }) };
}

async function init() {
  const { data } = await sb.auth.getSession();
  session = data.session;

  if (session) {
    const { data: profile } = await sb.from("profiles").select("avatar_url").eq("id", session.user.id).single();
    document.getElementById("topbar-avatar").src = profile?.avatar_url || "assets/profile/1.png";
    document.getElementById("topbar-avatar").style.display = "block";
    document.getElementById("topbar-login").style.display = "none";
  }

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentStatus = tab.dataset.status;
      loadStreams();
    });
  });

  loadStreams();
  loadSchedule();
}

async function loadStreams() {
  const el = document.getElementById("stream-grid");
  el.innerHTML = `<div class="stream-card"><div class="poster skeleton" style="height:190px;"></div></div>`;

  const { data, error } = await sb.from("streams").select("*").eq("status", currentStatus).order("show_date", { ascending: true });

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">Belum ada konten untuk kategori ini.</div>`;
    return;
  }

  el.innerHTML = data.map(renderStreamCard).join("");
  document.querySelectorAll("[data-watch]").forEach(btn => {
    btn.addEventListener("click", () => goWatch(btn.dataset.watch));
  });
}

function renderStreamCard(s) {
  const statusPill = s.status === "live" ? `<span class="pill pill-live"><i class="fa-solid fa-circle" style="font-size:8px;"></i> LIVE</span>` : `<span class="pill">Akan Datang</span>`;
  const dateStr = s.show_date ? new Date(s.show_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const priceLabel = s.price > 0 ? `Rp ${Number(s.price).toLocaleString('id-ID')}` : 'Gratis';

  return `
  <div class="stream-card">
    <div class="poster-wrap">
      <img class="poster" src="${s.poster_url || 'assets/placeholder-stream.jpg'}" alt="${escapeHtml(s.title)}">
      <div class="pill-row">${statusPill}<span class="pill"><i class="fa-solid fa-eye"></i> ${s.viewers_count || 0}</span></div>
    </div>
    <div class="body">
      <div class="tags">${(s.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div>
      <h4>${escapeHtml(s.title)}</h4>
      <div class="meta-row">
        <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
        <span><i class="fa-regular fa-clock"></i> ${s.show_time ? s.show_time.slice(0,5) : ''} WIB</span>
      </div>
      <div class="footer-row">
        <div class="ticket-status">HARGA<strong>${priceLabel}</strong></div>
        <button class="btn btn-primary" data-watch="${s.id}">${s.status === 'upcoming' ? 'Lihat Detail' : 'Tonton'}</button>
      </div>
    </div>
  </div>`;
}

function goWatch(streamId) {
  if (!session) {
    window.location.href = `login.html?next=watch.html%3Fstream%3D${streamId}`;
    return;
  }
  window.location.href = `watch.html?stream=${streamId}`;
}

let scheduleOffset = 0;
const SCHEDULE_PAGE_SIZE = 5;

async function loadSchedule(append = false) {
  const el = document.getElementById("schedule-list");
  const loadMoreBtn = document.getElementById("load-more");
  if (!append) el.innerHTML = `<div class="show-card"><div class="skeleton" style="height:180px;"></div></div>`;

  const baseFilter = (q) => q.eq("type", "SHOW").gte("date", new Date().toISOString().slice(0, 10));

  const [{ data, error }, { count }] = await Promise.all([
    baseFilter(sb.from("schedules").select("*"))
      .order("date", { ascending: true }).order("start_time", { ascending: true })
      .range(scheduleOffset, scheduleOffset + SCHEDULE_PAGE_SIZE - 1),
    baseFilter(sb.from("schedules").select("*", { count: "exact", head: true })),
  ]);

  if (error || !data || data.length === 0) {
    if (!append) el.innerHTML = `<div class="empty-state">Belum ada jadwal show mendatang.</div>`;
    loadMoreBtn.style.display = "none";
    return;
  }

  const html = data.map(renderShowCard).join("");
  el.innerHTML = append ? el.innerHTML + html : html;
  scheduleOffset += data.length;

  initShowCards(data);

  const remaining = (count || 0) - scheduleOffset;
  if (remaining > 0) {
    document.getElementById("load-more-label").textContent = `${remaining} show lainnya`;
    loadMoreBtn.style.display = "flex";
  } else {
    loadMoreBtn.style.display = "none";
  }
}

document.getElementById("load-more").addEventListener("click", () => loadSchedule(true));

init();
