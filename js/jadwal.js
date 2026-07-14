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

async function loadSchedule() {
  const el = document.getElementById("schedule-list");
  const { data, error } = await sb
    .from("schedules").select("*")
    .gte("show_date", new Date().toISOString().slice(0, 10))
    .order("show_date", { ascending: true });

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">Belum ada jadwal show mendatang.</div>`;
    return;
  }
  el.innerHTML = data.map(s => {
    const { day, month } = formatDateShort(s.show_date);
    const open = (s.ticket_status || '').toLowerCase().includes('tersedia') && !(s.ticket_status || '').toLowerCase().includes('belum');
    return `
    <div class="schedule-card">
      <div class="date-box"><div class="d">${day}</div><div class="m">${month}</div></div>
      <div class="info" style="flex:1;">
        <h4>${escapeHtml(s.show_title)}</h4>
        <div class="meta">
          <span><i class="fa-solid fa-clock"></i> ${s.show_time ? s.show_time.slice(0,5) : ''} WIB</span>
          <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.venue || 'JKT48 Theater')}</span>
        </div>
        <div style="margin-top:8px;"><span class="badge ${open ? 'badge-open' : 'badge-closed'}">${escapeHtml(s.ticket_status || 'Belum Tersedia')}</span></div>
      </div>
    </div>`;
  }).join("");
}

init();
