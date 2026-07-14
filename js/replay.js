let session = null;
const PAGE_SIZE = 9;
let offset = 0;

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

  populateYearFilter();
  document.getElementById("filter-month").addEventListener("change", resetAndLoad);
  document.getElementById("filter-year").addEventListener("change", resetAndLoad);
  document.getElementById("load-more").addEventListener("click", () => loadReplays(true));

  loadReplays();
}

function populateYearFilter() {
  const select = document.getElementById("filter-year");
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 4; y--) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    select.appendChild(opt);
  }
}

function resetAndLoad() {
  offset = 0;
  loadReplays();
}

async function loadReplays(append = false) {
  const el = document.getElementById("stream-grid");
  const loadMoreBtn = document.getElementById("load-more");
  if (!append) el.innerHTML = `<div class="stream-card"><div class="poster skeleton" style="height:190px;"></div></div>`;

  const month = document.getElementById("filter-month").value;
  const year = document.getElementById("filter-year").value;

  let query = sb.from("streams").select("*").eq("status", "replay").order("show_date", { ascending: false });

  if (year) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    query = query.gte("show_date", start).lte("show_date", end);
  }
  if (month) {
    // Supabase/PostgREST doesn't do EXTRACT(month) directly via the JS client,
    // so we filter month client-side after fetching the year range below.
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data, error } = await query;

  if (error) {
    el.innerHTML = `<div class="empty-state">Gagal memuat replay.</div>`;
    return;
  }

  let filtered = data || [];
  if (month) {
    filtered = filtered.filter(s => s.show_date && s.show_date.slice(5, 7) === month);
  }

  if (filtered.length === 0 && !append) {
    el.innerHTML = `<div class="empty-state">Belum ada replay untuk filter ini.</div>`;
    loadMoreBtn.style.display = "none";
    return;
  }

  const html = filtered.map(renderStreamCard).join("");
  el.innerHTML = append ? el.innerHTML + html : html;
  offset += (data || []).length;

  loadMoreBtn.style.display = (data || []).length === PAGE_SIZE ? "inline-flex" : "none";

  document.querySelectorAll("[data-watch]").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // avoid duplicate listeners on append
  });
  document.querySelectorAll("[data-watch]").forEach(btn => {
    btn.addEventListener("click", () => goWatch(btn.dataset.watch));
  });
}

function renderStreamCard(s) {
  const dateStr = s.show_date ? new Date(s.show_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const priceLabel = s.price > 0 ? `Rp ${Number(s.price).toLocaleString('id-ID')}` : 'Gratis';

  return `
  <div class="stream-card">
    <div class="poster-wrap">
      <img class="poster" src="${s.poster_url || 'assets/placeholder-stream.jpg'}" alt="${escapeHtml(s.title)}">
      <div class="pill-row"><span class="pill">Replay</span><span class="pill"><i class="fa-solid fa-eye"></i> ${s.viewers_count || 0}</span></div>
    </div>
    <div class="body">
      <div class="tags">${(s.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div>
      <h4>${escapeHtml(s.title)}</h4>
      <div class="meta-row"><span><i class="fa-regular fa-calendar"></i> ${dateStr}</span></div>
      <div class="footer-row">
        <div class="ticket-status">HARGA<strong>${priceLabel}</strong></div>
        <button class="btn btn-primary" data-watch="${s.id}">Tonton</button>
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

init();
