function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const PAGE_SIZE = 20;
let offset = 0;

async function loadNews(append = false) {
  const el = document.getElementById("news-list");
  const loadMoreBtn = document.getElementById("load-more");
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Memuat...";

  const { data, error } = await sb
    .from("news")
    .select("*")
    .order("published_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    el.innerHTML = `<div class="empty-state">Gagal memuat berita.</div>`;
    loadMoreBtn.style.display = "none";
    return;
  }
  if (!data || data.length === 0) {
    if (offset === 0) el.innerHTML = `<div class="empty-state">Belum ada berita.</div>`;
    loadMoreBtn.style.display = "none";
    return;
  }

  const html = data.map(n => `
    <a class="simple-list-item" href="${n.source_url ? escapeHtml(n.source_url) : '#'}" target="_blank" rel="noopener" style="text-decoration:none;">
      <div class="thumb-slot">
        <div class="date-box"><i class="fa-solid fa-newspaper" style="color:var(--red);"></i></div>
      </div>
      <div class="content">
        <span class="type-badge type-OTHER" style="background:var(--red-light);color:var(--red);">${escapeHtml(n.category || 'Berita')}</span>
        <h4 style="margin-top:6px;">${escapeHtml(n.title)}</h4>
        <div class="meta-row">
          <span>${new Date(n.published_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</span>
        </div>
      </div>
    </a>`).join("");

  el.innerHTML = offset === 0 ? html : el.innerHTML + html;
  offset += data.length;

  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = "Show More";
  loadMoreBtn.style.display = data.length === PAGE_SIZE ? "inline-flex" : "none";
}

document.getElementById("load-more").addEventListener("click", () => loadNews(true));
loadNews();
