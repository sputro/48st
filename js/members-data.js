// js/members-data.js
//
// PENTING: array MEMBERS di bawah ini masih CONTOH (cuma 2 orang, dari yang
// kamu kasih). Ganti/tambah isinya dengan daftar LENGKAP member JKT48 kamu
// (paste seluruh array dari file config member yang udah kamu punya).
//
// Format tiap member:
//   name       -> nama lengkap (buat alt text foto)
//   slug       -> dipakai buat bentuk URL foto: baseURL + slug + extension
//   tim        -> kode tim satu huruf: "l" (Love), "d" (Dream), "h" (Happy), "t" (Trainee)
//   customImg  -> OPSIONAL. Kalau ada, dipakai langsung sebagai URL foto,
//                 mengabaikan pola baseURL+slug (buat kasus anomali kayak Gendis)

window.MEMBER_PHOTO_CONFIG = {
  baseURL: "https://images.weserv.nl/?url=https://jkt48.com/api/v1/storages/media/jkt48-member/",
  extension: ".jpg",
};

window.MEMBERS = [
  { name: "Hillary Abigail", slug: "hillary_abigail", tim: "l", gen: 12 },
  { name: "Gendis Mayrannisa", slug: "gendis_mayrannisa", tim: "d", gen: 11,
    customImg: "https://images.weserv.nl/?url=https://jkt48.com/api/v1/storages/media/jkt48-member/2026/05/gendismayrannisaphoto-1-8cfc14.jpg" },

  // TODO: tambahin sisa member di sini, format sama kayak di atas.
  // Contoh tambahan (isi dengan data asli kamu):
  // { name: "Nama Member", slug: "nama_member", tim: "d", gen: 11 },
];

// Kode tim di data schedule (dari API jkt48.com) pakai nama panjang huruf
// besar (LOVE, DREAM, HAPPY, TRAINEE) — ini konversinya ke kode satu huruf
// yang dipakai di field `tim` member.
window.TEAM_CODE_MAP = { LOVE: "l", DREAM: "d", HAPPY: "h", TRAINEE: "t" };

function getMemberPhotoUrl(member) {
  if (member.customImg) return member.customImg;
  return `${window.MEMBER_PHOTO_CONFIG.baseURL}${member.slug}${window.MEMBER_PHOTO_CONFIG.extension}`;
}

// Dipakai oleh landing.js/jadwal.js/schedule.js buat nampilin foto tim yang show hari itu.
function getTeamMemberPhotos(teamNameFromSchedule) {
  if (!teamNameFromSchedule) return [];
  const shortCode = window.TEAM_CODE_MAP[teamNameFromSchedule.toUpperCase()];
  if (!shortCode) return [];
  return window.MEMBERS.filter((m) => m.tim === shortCode).map(getMemberPhotoUrl);
}

// Dipanggil setelah kartu di-render, isi strip foto member ke dalam elemen kosong.
function injectMemberPhotoStrip(containerEl, teamName) {
  if (!containerEl) return;
  const photos = getTeamMemberPhotos(teamName);
  if (photos.length === 0) return;
  containerEl.innerHTML = photos
    .slice(0, 6)
    .map((src) => `<img class="member-photo-mini" src="${src}" alt="" loading="lazy">`)
    .join("");
}
