function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const PAGE_SIZE = 12;
let offset = 0;

async function loadNews(append = false) {
  const el = document.getElementById("news-grid");
  const { data, error } = await sb
    .from("news")
    .select("*")
    .order("published_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    el.innerHTML = `<div class="empty-state">Gagal memuat berita.</div>`;
    return;
  }
  if (!data || data.length === 0) {
    if (!append) el.innerHTML = `<div class="empty-state">Belum ada berita.</div>`;
    return;
  }

  const html = data.map(n => `
    <a class="news-card" href="${n.source_url ? escapeHtml(n.source_url) : '#'}" target="_blank" rel="noopener">
      <img class="thumb" src="${n.image_url || 'assets/placeholder-news.jpg'}" alt="">
      <div class="body">
        <div class="tag">${escapeHtml(n.category || 'Berita')}</div>
        <h4>${escapeHtml(n.title)}</h4>
        <div class="date">${new Date(n.published_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</div>
      </div>
    </a>`).join("");

  el.innerHTML = append ? el.innerHTML + html : html;
  offset += data.length;
}

loadNews();
