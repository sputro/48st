// js/member-photos.js
//
// Foto member sekarang otomatis dari tabel `members` di Supabase (di-isi oleh
// Edge Function scrape-members yang narik langsung dari API resmi jkt48.com).
// Gak perlu lagi input manual slug/foto member satu-satu.

const _memberPhotoCache = new Map();

async function getTeamMemberPhotos(teamName) {
  if (!teamName) return [];
  const key = teamName.toUpperCase();
  if (_memberPhotoCache.has(key)) return _memberPhotoCache.get(key);

  const { data, error } = await sb.from("members").select("photo_url").eq("type", key);
  const urls = (!error && data) ? data.map((m) => m.photo_url).filter(Boolean) : [];
  _memberPhotoCache.set(key, urls);
  return urls;
}

// Dipanggil setelah kartu show di-render, isi strip foto tim ke elemen kosong.
async function injectMemberPhotoStrip(containerEl, teamName) {
  if (!containerEl || !teamName) return;
  const photos = await getTeamMemberPhotos(teamName);
  if (photos.length === 0) return;
  containerEl.innerHTML = photos
    .slice(0, 6)
    .map((src) => `<img class="member-photo-mini" src="${src}" alt="" loading="lazy">`)
    .join("");
}
