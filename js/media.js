// js/media.js — dipakai bareng di index.html, jadwal.html, schedule.html
//
// KONVENSI PENAMAAN FILE (WAJIB diikuti biar logo/foto kedeteksi otomatis):
//
// 1. Logo show:      assets/show/<namashow>.png
//    <namashow> = judul show, huruf kecil semua, spasi & simbol dibuang,
//    bagian nama kota di belakang " - " ikut dibuang (karena show yang sama
//    biasanya keliling kota tapi logonya sama).
//    Contoh: "ITADAKI♥LOVE - Yogyakarta"  -> assets/show/itadakilove.png
//            "DREAM BAKUDAN - Surabaya"   -> assets/show/dreambakudan.png
//            "Pajama Drive"               -> assets/show/pajamadrive.png
//
// 2. Foto member per tim: assets/member/<team>/manifest.json + foto-fotonya
//    <team> = nama tim huruf kecil (love, dream, happy, trainee, jkt48)
//    manifest.json isinya array nama file, contoh:
//      ["member1.jpg", "member2.jpg", "member3.jpg"]
//    Foto asli ditaruh di folder yang sama:
//      assets/member/love/member1.jpg
//      assets/member/love/manifest.json
//
// Kalau file logo/manifest belum ada (404), sistem otomatis fallback ke
// tampilan biasa (kotak tanggal / badge tanpa foto) — TIDAK error, tidak
// nge-block apapun. Jadi aman ditambah pelan-pelan.

function slugifyShowName(title) {
  if (!title) return "";
  const base = title.split(" - ")[0]; // buang nama kota di belakang
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getShowLogoPath(title) {
  const slug = slugifyShowName(title);
  return slug ? `assets/show/${slug}.png` : "";
}

// Swap gambar yang gagal load (404) jadi kotak tanggal biasa, dipanggil dari onerror="".
function handleLogoFallback(imgEl, day, month) {
  const div = document.createElement("div");
  div.className = "date-box";
  div.innerHTML = `<div class="d">${day}</div><div class="m">${month}</div>`;
  imgEl.replaceWith(div);
}

// Cache manifest per tim biar gak fetch berkali-kali buat tiap kartu.
const _memberManifestCache = new Map();

async function getTeamMemberPhotos(team) {
  if (!team) return [];
  const key = team.toLowerCase();
  if (_memberManifestCache.has(key)) return _memberManifestCache.get(key);

  try {
    const res = await fetch(`assets/member/${key}/manifest.json`);
    if (!res.ok) throw new Error("no manifest");
    const files = await res.json();
    const urls = Array.isArray(files) ? files.map((f) => `assets/member/${key}/${f}`) : [];
    _memberManifestCache.set(key, urls);
    return urls;
  } catch {
    _memberManifestCache.set(key, []); // cache the "no photos" result too, avoid re-fetching
    return [];
  }
}

// Isi elemen strip foto member secara async setelah kartu utama dirender.
// Panggil ini sekali per kartu setelah innerHTML kartu itu ada di DOM.
async function injectMemberPhotoStrip(containerEl, team) {
  if (!containerEl || !team) return;
  const photos = await getTeamMemberPhotos(team);
  if (photos.length === 0) return; // biarkan kosong, tidak ganggu tampilan
  containerEl.innerHTML = photos
    .slice(0, 5)
    .map((src) => `<img class="member-photo-mini" src="${src}" alt="" loading="lazy">`)
    .join("");
}
