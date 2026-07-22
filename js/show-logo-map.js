// js/show-logo-map.js
//
// Peta "kata kunci di judul show" -> nama file logo di assets/show/.
// Sistem cari apakah judul show MENGANDUNG (case-insensitive) salah satu
// keyword ini, lalu pakai file yang cocok. Kalau nambah show baru, tinggal
// tambah baris baru di sini.
window.SHOW_LOGO_MAP = {
  "cara meminum ramune": "cmr.png",
  "menggandeng erat tanganku": "twt.png",
  "pertaruhan cinta": "percin.png",
  "kira-kira girls": "kkg.png",
  "aturan anti cinta": "rkj.png",
  "gadis gadis remaja": "ggr.png",
  "tunas di balik seragam": "tbs.png",
  "love": "love.png",
  "dream": "dream.png",
  "pajama": "pajama.png",
  "passion": "passion.png",
};

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
