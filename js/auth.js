function showMsg(text, type) {
  const el = document.getElementById("msg");
  el.textContent = text;
  el.className = "form-msg " + type;
}
function setLoading(btn, loading, labelHtml) {
  btn.disabled = loading;
  btn.innerHTML = loading ? `<i class="fa-solid fa-spinner fa-spin"></i> Memproses...` : labelHtml;
}
function getNextUrl() {
  const next = new URLSearchParams(location.search).get("next");
  return next ? decodeURIComponent(next) : window.APP_CONFIG.MEMBER_REDIRECT_URL;
}

redirectIfAuthed();

const loginForm = document.getElementById("login-form");
if (loginForm) {
  const defaultLabel = document.getElementById("submit-btn").innerHTML;
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-btn");
    setLoading(btn, true, defaultLabel);

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      showMsg("Email atau password salah. Coba lagi.", "error");
      setLoading(btn, false, defaultLabel);
      return;
    }

    showMsg("Berhasil masuk. Mengalihkan...", "success");
    window.location.href = getNextUrl();
  });
}

const registerForm = document.getElementById("register-form");
if (registerForm) {
  const defaultLabel = document.getElementById("submit-btn").innerHTML;
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-btn");
    setLoading(btn, true, defaultLabel);

    const username = document.getElementById("username").value.trim();
    const fullname = document.getElementById("fullname").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (password.length < 8) {
      showMsg("Password minimal 8 karakter.", "error");
      setLoading(btn, false, defaultLabel);
      return;
    }

    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { username, full_name: fullname } },
    });

    if (error) {
      showMsg(error.message.includes("already registered")
        ? "Email sudah terdaftar. Silakan masuk."
        : "Pendaftaran gagal: " + error.message, "error");
      setLoading(btn, false, defaultLabel);
      return;
    }

    if (data.session) {
      window.location.href = getNextUrl();
    } else {
      showMsg("Pendaftaran berhasil! Cek email kamu untuk verifikasi sebelum masuk.", "success");
      setLoading(btn, false, defaultLabel);
      registerForm.reset();
    }
  });
}
