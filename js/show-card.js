// js/show-card.js — dipakai bareng di index.html, jadwal.html, schedule.html
// buat nge-render kartu show yang detail (beda dari simple-list-item biasa
// yang dipakai buat Exclusive/Event/News).

function escapeHtmlSC(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Status & waktu show (durasi diasumsikan 2 jam) ----------
const SHOW_DURATION_MS = 2 * 60 * 60 * 1000;

function getShowTiming(dateStr, startTimeStr) {
  const start = new Date(`${dateStr}T${startTimeStr && startTimeStr !== "00:00:00" ? startTimeStr : "19:00:00"}`);
  const end = new Date(start.getTime() + SHOW_DURATION_MS);
  const now = new Date();
  let status = "upcoming";
  if (now >= start && now < end) status = "ongoing";
  else if (now >= end) status = "finished";
  return { start, end, status };
}

// ---------- Deteksi graduation / "last show" dari judul & deskripsi ----------
function isGraduationShow(show) {
  const text = `${show.title || ""} ${show.short_description || ""}`.toLowerCase();
  return ["graduation", "last show", "perpisahan", "kelulusan", "lulus"].some((kw) => text.includes(kw));
}

// ---------- Render 1 kartu show ----------
function renderShowCard(s) {
  const team = (s.member_type || "").toUpperCase();
  const teamClass = ["LOVE", "DREAM", "PASSION", "TRAINEE", "JKT48"].includes(team) ? team : "JKT48";
  const teamLabel = team === "TRAINEE" ? "Trainee" : (team || "JKT48");
  const logoPath = getShowLogoPath(s.title);
  const cardId = `show-${s.id}`;
  const isGrad = isGraduationShow(s);

  const dateLabel = new Date(s.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeLabel = s.start_time && s.start_time !== '00:00:00' ? s.start_time.slice(0, 5) : null;

  return `
    <div class="show-card" id="${cardId}">
      <div class="poster-wrap">
        <img src="${logoPath}" alt="${escapeHtmlSC(s.title)}" onerror="this.style.display='none'">
        <span class="team-pill-corner team-${teamClass}">
          ${isGrad ? '<i class="fa-solid fa-graduation-cap"></i>' : '<i class="fa-solid fa-users"></i>'}
          ${escapeHtmlSC(teamLabel)}
        </span>
      </div>
      <div class="body">
        <h4>${escapeHtmlSC(s.title)}</h4>
        <div class="datetime-row">
          <span><i class="fa-solid fa-calendar-days"></i> ${dateLabel}</span>
          ${timeLabel ? `<span><i class="fa-solid fa-clock"></i> ${timeLabel} WIB</span>` : ""}
        </div>
        <div class="member-grid" id="grid-${cardId}"><!-- diisi async --></div>
        <div class="show-status-row" id="status-${cardId}"><span class="status-text">Memuat...</span></div>
      </div>
    </div>`;
}

// ---------- Isi grid member (SEMUA member tim, gak dipotong) + tanda ulang tahun ----------
async function fillShowCardMembers(s) {
  const cardId = `show-${s.id}`;
  const gridEl = document.getElementById(`grid-${cardId}`);
  if (!gridEl) return;

  if (!s.member_type) { gridEl.remove(); return; }

  const members = await getTeamMembers(s.member_type);
  if (members.length === 0) { gridEl.remove(); return; }

  const birthdayRaw = (s.birthday_member || "").toLowerCase();

  gridEl.innerHTML = members.map((m) => {
    const isBirthday = birthdayRaw && (birthdayRaw.includes(m.name.toLowerCase()) || (m.nickname && birthdayRaw.includes(m.nickname.toLowerCase())));
    return `
      <div class="member-chip">
        <img src="${m.photo_url}" alt="${escapeHtmlSC(m.name)}" loading="lazy" onerror="this.style.visibility='hidden'">
        <span>${escapeHtmlSC(m.nickname || m.name)}${isBirthday ? ' <i class="fa-solid fa-cake-candles" title="Ulang tahun saat show ini" style="color:#e0335f;"></i>' : ''}</span>
      </div>`;
  }).join("");
}

// ---------- Countdown per-kartu, satu interval global buat semua kartu aktif ----------
const _activeCountdowns = new Map(); // cardId -> { start, end }

function registerShowCountdown(s) {
  const cardId = `show-${s.id}`;
  const { start, end } = getShowTiming(s.date, s.start_time);
  _activeCountdowns.set(cardId, { start, end });
  tickOneCountdown(cardId, start, end); // render langsung, gak nunggu interval pertama
}

function tickOneCountdown(cardId, start, end) {
  const el = document.getElementById(`status-${cardId}`);
  if (!el) { _activeCountdowns.delete(cardId); return; }

  const now = new Date();

  if (now >= end) {
    el.innerHTML = `<span class="status-text finished"><i class="fa-solid fa-circle-check"></i> Show Selesai</span>`;
    _activeCountdowns.delete(cardId);
    return;
  }
  if (now >= start) {
    el.innerHTML = `<span class="status-text ongoing"><i class="fa-solid fa-broadcast-tower"></i> Sedang Berlangsung</span>`;
    return;
  }

  const diff = start.getTime() - now.getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  el.innerHTML = `
    <div class="mini-countdown">
      <div class="u"><div class="n">${days}</div><div class="l">Hari</div></div>
      <div class="sep">:</div>
      <div class="u"><div class="n">${String(hours).padStart(2,'0')}</div><div class="l">Jam</div></div>
      <div class="sep">:</div>
      <div class="u"><div class="n">${String(mins).padStart(2,'0')}</div><div class="l">Menit</div></div>
      <div class="sep">:</div>
      <div class="u"><div class="n">${String(secs).padStart(2,'0')}</div><div class="l">Detik</div></div>
    </div>
    <i class="fa-regular fa-bell" style="color:var(--muted);"></i>`;
}

setInterval(() => {
  _activeCountdowns.forEach(({ start, end }, cardId) => tickOneCountdown(cardId, start, end));
}, 1000);

// ---------- Dipanggil dari halaman setelah kartu-kartu di-render sekaligus ----------
function initShowCards(showList) {
  showList.forEach((s) => {
    fillShowCardMembers(s);
    registerShowCountdown(s);
  });
}
