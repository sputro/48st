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
    .eq("type", "SHOW")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(20);

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">Belum ada jadwal show mendatang.</div>`;
    document.getElementById("countdown-wrap").innerHTML = "";
    return;
  }

  renderCountdown(data[0]);

  el.innerHTML = data.map(s => {
    const { day, month } = formatDateShort(s.date);
    const team = (s.member_type || "").toUpperCase();
    const teamClass = ["LOVE", "DREAM", "PASSION", "TRAINEE", "JKT48"].includes(team) ? team : "DEFAULT";
    const logoPath = getShowLogoPath(s.title);
    return `
    <div class="simple-list-item">
      <div class="thumb-slot">
        <img class="show-logo-thumb" src="${logoPath}" alt=""
             onerror="handleLogoFallback(this, '${day}', '${month}')">
      </div>
      <div class="content">
        ${s.member_type ? `<span class="team-badge team-${teamClass}"><i class="fa-solid fa-users"></i> Team ${escapeHtml(s.member_type)}</span>` : ""}
        <h4 style="margin-top:6px;">${escapeHtml(s.title)}</h4>
        <div class="meta-row">
          <span>${new Date(s.date).toLocaleDateString('id-ID', { day:'numeric', month:'long' })}</span>
          ${s.start_time && s.start_time !== '00:00:00' ? `<span><i class="fa-solid fa-clock"></i> ${s.start_time.slice(0,5)} WIB</span>` : ""}
        </div>
        ${s.member_type ? `<div class="member-strip" id="strip-${s.id}"></div>` : ""}
      </div>
    </div>`;
  }).join("");

  data.forEach((s) => {
    if (!s.member_type) return;
    injectMemberPhotoStrip(document.getElementById(`strip-${s.id}`), s.member_type);
  });
}

let countdownTimer = null;

function renderCountdown(nextShow) {
  const wrap = document.getElementById("countdown-wrap");
  const targetDate = new Date(`${nextShow.date}T${nextShow.start_time || '19:00:00'}`);

  wrap.innerHTML = `
    <div class="countdown-card">
      <div class="label"><i class="fa-solid fa-hourglass-half"></i> Show Berikutnya</div>
      <h3>${escapeHtml(nextShow.title)}</h3>
      <div class="meta">${targetDate.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}${nextShow.start_time && nextShow.start_time !== '00:00:00' ? ' • ' + nextShow.start_time.slice(0,5) + ' WIB' : ''}</div>
      <div class="countdown-timer" id="countdown-timer">
        <div class="unit"><div class="num" id="cd-days">--</div><div class="lbl">Hari</div></div>
        <div class="unit"><div class="num" id="cd-hours">--</div><div class="lbl">Jam</div></div>
        <div class="unit"><div class="num" id="cd-mins">--</div><div class="lbl">Menit</div></div>
        <div class="unit"><div class="num" id="cd-secs">--</div><div class="lbl">Detik</div></div>
      </div>
    </div>`;

  if (countdownTimer) clearInterval(countdownTimer);

  function tick() {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) {
      document.getElementById("countdown-timer").innerHTML = `<div class="unit" style="min-width:auto;">Sedang berlangsung!</div>`;
      clearInterval(countdownTimer);
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    document.getElementById("cd-days").textContent = days;
    document.getElementById("cd-hours").textContent = String(hours).padStart(2, "0");
    document.getElementById("cd-mins").textContent = String(mins).padStart(2, "0");
    document.getElementById("cd-secs").textContent = String(secs).padStart(2, "0");
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

init();
