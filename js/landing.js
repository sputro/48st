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

// Case-insensitive "does any curated logo/photo title_match appear inside this show's title".
function findMatch(title, curatedList, matchField) {
  if (!title || !curatedList) return null;
  const lower = title.toLowerCase();
  return curatedList.find(c => lower.includes(c[matchField].toLowerCase()));
}

async function loadSchedulePreview() {
  const el = document.getElementById("schedule-list");

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 86400000);

  const [{ data, error }, { data: logos }, { data: photos }] = await Promise.all([
    sb.from("schedules").select("*")
      .eq("type", "SHOW")
      .gte("date", today.toISOString().slice(0, 10))
      .lte("date", in7Days.toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .order("start_time", { ascending: true }),
    sb.from("show_logos").select("*"),
    sb.from("member_photos").select("*"),
  ]);

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">Belum ada show dalam 7 hari ke depan.</div>`;
    document.getElementById("home-countdown-wrap").innerHTML = "";
    return;
  }

  // Earliest show (by date, then by time) renders the countdown — matches
  // "kalau ada 2 show, yang paling duluan di atas" since the query is already
  // sorted date+time ascending, so data[0] is always the soonest one.
  renderHomeCountdown(data[0]);

  el.innerHTML = data.map(s => {
    const { day, month } = formatDateShort(s.date);
    const logo = findMatch(s.title, logos, "title_match");
    const team = (s.member_type || "").toUpperCase();
    const photo = photos?.find(p => p.member_name.toUpperCase() === team);
    const teamClass = ["LOVE", "DREAM", "HAPPY", "TRAINEE", "JKT48"].includes(team) ? team : "DEFAULT";

    return `
    <div class="schedule-card with-logo">
      ${logo ? `<img class="show-logo-thumb" src="${escapeHtml(logo.logo_url)}" alt="">` : `<div class="date-box"><div class="d">${day}</div><div class="m">${month}</div></div>`}
      <div class="info" style="flex:1;">
        ${s.member_type ? `
          <span class="team-badge team-${teamClass}" style="margin-bottom:6px;">
            ${photo ? `<img class="member-photo-mini" src="${escapeHtml(photo.photo_url)}" alt="">` : `<i class="fa-solid fa-users"></i>`}
            Team ${escapeHtml(s.member_type)}
          </span>` : ""}
        <h4>${escapeHtml(s.title)}</h4>
        <div class="meta">
          <span>${new Date(s.date).toLocaleDateString('id-ID', { weekday: 'short', day:'numeric', month:'short' })}</span>
          <span><i class="fa-solid fa-clock"></i> ${s.start_time ? s.start_time.slice(0,5) : ''} WIB</span>
        </div>
      </div>
    </div>`;
  }).join("");
}

let homeCountdownTimer = null;

function renderHomeCountdown(nextShow) {
  const wrap = document.getElementById("home-countdown-wrap");
  const targetDate = new Date(`${nextShow.date}T${nextShow.start_time || '19:00:00'}`);

  wrap.innerHTML = `
    <div class="countdown-card">
      <div class="label"><i class="fa-solid fa-hourglass-half"></i> Show Terdekat</div>
      <h3>${escapeHtml(nextShow.title)}</h3>
      <div class="meta">${targetDate.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })} • ${nextShow.start_time ? nextShow.start_time.slice(0,5) : ''} WIB</div>
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
