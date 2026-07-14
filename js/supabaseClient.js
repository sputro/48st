const { createClient } = supabase;
const sb = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = window.APP_CONFIG.LOGIN_URL;
    return null;
  }
  return session;
}

async function redirectIfAuthed() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) window.location.href = window.APP_CONFIG.MEMBER_REDIRECT_URL;
}
