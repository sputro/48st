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
    document.getElementById("home-countdown-wrap").innerHTML = "";
    return;
  }

  // Sorted date+time ascending -> data[0] is always the soonest show,
  // so "kalau ada 2 show, yang paling duluan di atas" is handled naturally.
  renderHomeCountdown(data[0]);

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
          <span>${new Date(s.date).toLocaleDateString('id-ID', { weekday: 'short', day:'numeric', month:'short' })}</span>
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

let homeCountdownTimer = null;

function renderHomeCountdown(nextShow) {
  const wrap = document.getElementById("home-countdown-wrap");
  const targetDate = new Date(`${nextShow.date}T${nextShow.start_time || '19:00:00'}`);

  wrap.innerHTML = `
    <div class="countdown-card">
      <div class="label"><i class="fa-solid fa-hourglass-half"></i> Show Terdekat</div>
      <h3>${escapeHtml(nextShow.title)}</h3>
      <div class="meta">${targetDate.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}${nextShow.start_time && nextShow.start_time !== '00:00:00' ? ' • ' + nextShow.start_time.slice(0,5) + ' WIB' : ''}</div>
      <div class="countdown-timer" id="home-cd-timer">
        <div class="unit"><div class="num" id="home-cd-days">--</div><div class="lbl">Hari</div></div>
        <div class="unit"><div class="num" id="home-cd-hours">--</div><div class="lbl">Jam</div></div>
        <div class="unit"><div class="num" id="home-cd-mins">--</div><div class="lbl">Menit</div></div>
        <div class="unit"><div class="num" id="home-cd-secs">--</div><div class="lbl">Detik</div></div>
      </div>
    </div>`;

  if (homeCountdownTimer) clearInterval(homeCountdownTimer);

  function tick() {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) {
      document.getElementById("home-cd-timer").innerHTML = `<div class="unit" style="min-width:auto;">Sedang berlangsung!</div>`;
      clearInterval(homeCountdownTimer);
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    document.getElementById("home-cd-days").textContent = days;
    document.getElementById("home-cd-hours").textContent = String(hours).padStart(2, "0");
    document.getElementById("home-cd-mins").textContent = String(mins).padStart(2, "0");
    document.getElementById("home-cd-secs").textContent = String(secs).padStart(2, "0");
  }
  tick();
  homeCountdownTimer = setInterval(tick, 1000);
}

loadNewsPreview();
loadSchedulePreview();
