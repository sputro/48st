// js/show-card.js — dipakai bareng di index.html, jadwal.html, schedule.html

function escapeHtmlSC(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Status & waktu show ----------
// Pakai end_time asli dari database kalau ada; kalau enggak, asumsi durasi 2 jam.
function getShowTiming(dateStr, startTimeStr, endTimeStr) {
  const safeStart = startTimeStr && startTimeStr !== "00:00:00" ? startTimeStr : "19:00:00";
  const start = new Date(`${dateStr}T${safeStart}`);
  let end;
  if (endTimeStr && endTimeStr !== "00:00:00") {
    end = new Date(`${dateStr}T${endTimeStr}`);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000); // show lewat tengah malam
  } else {
    end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  }
  const now = new Date();
  let status = "upcoming";
  if (now >= start && now < end) status = "ongoing";
  else if (now >= end) status = "finished";
  return { start, end, status };
}

// ---------- Render 1 kartu show ----------
function renderShowCard(s) {
  const team = (s.member_type || "").toUpperCase();
  const teamClass = ["LOVE", "DREAM", "PASSION", "TRAINEE", "JKT48"].includes(team) ? team : "JKT48";
  const teamLabel = team === "TRAINEE" ? "Trainee" : (team || "JKT48");
  const logoPath = getShowLogoPath(s.title);
  const cardId = `show-${s.id}`;

  const dateLabel = new Date(s.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeLabel = s.start_time && s.start_time !== '00:00:00' ? s.start_time.slice(0, 5) : null;

  return `
    <div class="show-card" id="${cardId}" data-grad="0">
      <div class="poster-wrap">
        <img src="${logoPath}" alt="${escapeHtmlSC(s.title)}" onerror="this.style.display='none'">
        <span class="team-pill-corner team-${teamClass}" id="badge-${cardId}">
          <i class="fa-solid fa-users"></i> ${escapeHtmlSC(teamLabel)}
        </span>
      </div>
      <div class="body">
        <h4>${escapeHtmlSC(s.title)}</h4>
        <div class="datetime-row">
          <span><i class="fa-solid fa-calendar-days"></i> ${dateLabel}</span>
          ${timeLabel ? `<span><i class="fa-solid fa-clock"></i> ${timeLabel} WIB</span>` : ""}
        </div>
        <div class="member-grid" id="grid-${cardId}"><!-- diisi async dari lineup asli --></div>
        <div class="show-status-row" id="status-${cardId}"><span class="status-text">Memuat...</span></div>
      </div>
    </div>`;
}

// ---------- Cache lineup per reference_code, biar gak fetch berkali-kali ----------
const _lineupCache = new Map();

async function fetchShowLineup(referenceCode) {
  if (!referenceCode) return null;
  if (_lineupCache.has(referenceCode)) return _lineupCache.get(referenceCode);

  try {
    const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/get-show-lineup?code=${encodeURIComponent(referenceCode)}`);
    const json = await res.json();
    const result = json?.data || null;
    _lineupCache.set(referenceCode, result);
    return result;
  } catch {
    _lineupCache.set(referenceCode, null);
    return null;
  }
}

// ---------- Isi grid member: coba lineup ASLI per-show dulu, fallback ke roster tim ----------
async function fillShowCardMembers(s) {
  const cardId = `show-${s.id}`;
  const gridEl = document.getElementById(`grid-${cardId}`);
  const statusEl = document.getElementById(`status-${cardId}`);
  if (!gridEl) return;

  const lineup = await fetchShowLineup(s.reference_code);

  if (lineup?.jkt48_member?.length) {
    // Lineup asli ketemu — cocokkin ke tabel `members` kita (by jkt48_member_id) buat ambil foto.
    const ids = lineup.jkt48_member.map((m) => m.member_id).filter(Boolean);
    const { data: photoRows } = await sb.from("members").select("jkt48_member_id, name, nickname, photo_url").in("jkt48_member_id", ids);
    const photoMap = new Map((photoRows || []).map((r) => [r.jkt48_member_id, r]));

    const birthdayNames = (lineup.birthday_member_name || []).map((n) => n.toLowerCase());

    gridEl.innerHTML = lineup.jkt48_member.map((m) => {
      const known = photoMap.get(m.member_id);
      const photo = known ? proxyImage(known.photo_url) : "";
      const displayName = known?.nickname || m.name;
      const isBirthday = birthdayNames.includes(m.name.toLowerCase());
      return `
        <div class="member-chip">
          ${photo ? `<img src="${photo}" alt="${escapeHtmlSC(m.name)}" loading="lazy" onerror="this.style.visibility='hidden'">` : ""}
          <span>${escapeHtmlSC(displayName)}${isBirthday ? ' <i class="fa-solid fa-cake-candles" title="Ulang tahun saat show ini" style="color:#e0335f;"></i>' : ''}</span>
        </div>`;
    }).join("");

    // Update timing pakai end_time ASLI dari lineup detail (lebih akurat dari asumsi 2 jam).
    if (lineup.end_time) {
      const { start, end } = getShowTiming(s.date, s.start_time, lineup.end_time);
      _activeCountdowns.set(cardId, { start, end });
    }
    return;
  }

  // Fallback: API detail gagal/gak ada -> tampilin roster tim penuh (lebih baik daripada kosong).
  if (!s.member_type) { gridEl.remove(); return; }
  const members = await getTeamMembers(s.member_type);
  if (members.length === 0) { gridEl.remove(); return; }

  gridEl.innerHTML = members.map((m) => `
    <div class="member-chip">
      <img src="${m.photo_url}" alt="${escapeHtmlSC(m.name)}" loading="lazy" onerror="this.style.visibility='hidden'">
      <span>${escapeHtmlSC(m.nickname || m.name)}</span>
    </div>`).join("");
}

// ---------- Countdown per-kartu, satu interval global buat semua kartu aktif ----------
const _activeCountdowns = new Map(); // cardId -> { start, end }

function registerShowCountdown(s) {
  const cardId = `show-${s.id}`;
  const { start, end } = getShowTiming(s.date, s.start_time, s.end_time);
  _activeCountdowns.set(cardId, { start, end });
  tickOneCountdown(cardId);
}

function tickOneCountdown(cardId) {
  const timing = _activeCountdowns.get(cardId);
  const el = document.getElementById(`status-${cardId}`);
  if (!el || !timing) { _activeCountdowns.delete(cardId); return; }

  const { start, end } = timing;
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
  _activeCountdowns.forEach((_, cardId) => tickOneCountdown(cardId));
}, 1000);

// ---------- Dipanggil dari halaman setelah kartu-kartu di-render sekaligus ----------
function initShowCards(showList) {
  showList.forEach((s) => {
    registerShowCountdown(s); // render awal pakai estimasi, nanti dikoreksi kalau lineup detail ketemu
    fillShowCardMembers(s);
  });
}
