// js/member-photos.js
//
// Foto member sekarang otomatis dari tabel `members` di Supabase (di-isi oleh
// Edge Function scrape-members yang narik langsung dari API resmi jkt48.com).
// Gak perlu lagi input manual slug/foto member satu-satu.
//
// Link foto asli dari jkt48.com kadang gak bisa langsung ditampilin di web lain
// (hotlink/CORS protection), jadi di-proxy lewat images.weserv.nl biar aman
// di-embed. Kalau nanti proxy ini perlu diganti, cukup ubah fungsi proxyImage
// di bawah ini, gak perlu ubah tempat lain.

function proxyImage(url) {
  if (!url) return url;
  // Foto yang sudah kita mirror ke Supabase Storage sendiri (dari scrape-ex-members)
  // gak butuh proxy sama sekali — itu udah domain kita sendiri, gak ada hotlink/CORS block.
  // Cuma link jkt48.com asli yang perlu di-proxy.
  if (url.includes(".supabase.co/storage/")) return url;
  return `https://images.weserv.nl/?url=${url}`;
}

const _memberPhotoCache = new Map();

// Foto doang (dipakai di beberapa tempat lama) — TIDAK dipotong jumlahnya.
async function getTeamMemberPhotos(teamName) {
  const members = await getTeamMembers(teamName);
  return members.map((m) => m.photo_url).filter(Boolean);
}

// Data lengkap (nama, nickname, foto) — dipakai show-card.js buat render grid member.
async function getTeamMembers(teamName) {
  if (!teamName) return [];
  const key = teamName.toUpperCase();
  if (_memberPhotoCache.has(key)) return _memberPhotoCache.get(key);

  const { data, error } = await sb.from("members").select("name, nickname, photo_url").eq("type", key);
  const members = (!error && data) ? data.map((m) => ({ ...m, photo_url: proxyImage(m.photo_url) })) : [];
  _memberPhotoCache.set(key, members);
  return members;
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