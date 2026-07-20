// =========================================================
// CONFIG — isi dengan data project Supabase kamu.
// SUPABASE_ANON_KEY aman untuk ditaruh di frontend (public by design)
// SELAMA Row Level Security (RLS) di setiap tabel sudah aktif & benar
// (lihat supabase/schema.sql). JANGAN PERNAH taruh service_role key di sini.
// =========================================================
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-PUBLIC-ANON-KEY",

  MEMBER_REDIRECT_URL: "index.html",
  LOGIN_URL: "login.html",

  BRAND_NAME: "48ST",
  BRAND_TAGLINE: "Fan Hub",

  // 10 avatar preset — taruh file 1.png ... 10.png di folder assets/profile/
  AVATAR_PRESET_COUNT: 10,
  AVATAR_PRESET_PATH: "assets/profile/",
};
