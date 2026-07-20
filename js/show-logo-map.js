// js/show-logo-map.js
//
// Peta kata kunci -> nama file logo di assets/show/.
// Sistem cari apakah judul show MENGANDUNG salah satu keyword ini
// (gak peduli huruf besar/kecil), lalu pakai file yang cocok.
//
// ⚠️ Beberapa keyword di bawah ini masih TEBAKAN saya berdasarkan nama file yang
// kamu kasih (cmr, dream, love, pajama, passion, percin, twt). Tolong dicek &
// dikoreksi kalau ada yang salah — tinggal edit value keyword-nya di sini,
// gak perlu ubah kode lain.
window.SHOW_LOGO_MAP = {
  "love": "love.png",       // dugaan: show dengan "LOVE" di judul, misal ITADAKI♥LOVE
  "dream": "dream.png",     // dugaan: DREAM BAKUDAN
  "pajama": "pajama.png",   // dugaan: Pajama Drive
  "passion": "passion.png", // ⚠️ belum yakin judul aslinya apa
  "percin": "percin.png",   // ⚠️ dugaan: "Perlukah Cinta Ini" (disingkat PER-CIN)?
  "twt": "twt.png",         // ⚠️ belum yakin judul aslinya apa
  "cmr": "cmr.png",         // ⚠️ belum yakin judul aslinya apa
};

// Cari file logo yang cocok dari judul show. Return "" kalau gak ada yang cocok
// (nanti otomatis fallback ke kotak tanggal biasa, gak error).
function getShowLogoPath(title) {
  if (!title) return "";
  const lower = title.toLowerCase();
  const matchedKey = Object.keys(window.SHOW_LOGO_MAP).find((keyword) => lower.includes(keyword));
  return matchedKey ? `assets/show/${window.SHOW_LOGO_MAP[matchedKey]}` : "";
}

function handleLogoFallback(imgEl, day, month) {
  const div = document.createElement("div");
  div.className = "date-box";
  div.innerHTML = `<div class="d">${day}</div><div class="m">${month}</div>`;
  imgEl.replaceWith(div);
}
