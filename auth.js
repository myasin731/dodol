/* ============================================================
   ClassRoom Lite — auth.js
   Guard halaman + logika login/register (index.html)
   ============================================================ */

const Auth = {
  /** Panggil di guru.html / siswa.html. Mengembalikan user atau null (lalu redirect). */
  guard(role) {
    const u = Session.user();
    if (!Session.token() || !u || Session.expired()) {
      Session.clear();
      location.replace('index.html' + (Session.token() ? '?expired=1' : ''));
      return null;
    }
    if (role && u.role !== role) {
      Auth.redirect(u);
      return null;
    }
    return u;
  },

  /** guru → guru.html, siswa → siswa.html */
  redirect(user) {
    location.replace(user.role === 'guru' ? 'guru.html' : 'siswa.html');
  },

  logout() {
    Session.clear();
    location.replace('index.html');
  }
};

/* ---------------- Halaman index.html ---------------- */
(function initLoginPage() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return; // bukan halaman login

  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const alertBox = document.getElementById('alert-box');

  function showAlert(msg, type) {
    alertBox.className = 'text-sm rounded-lg px-3 py-2 mb-4 ' + (type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-800');
    alertBox.textContent = msg;
    alertBox.classList.remove('hidden');
  }
  function hideAlert() { alertBox.classList.add('hidden'); }

  function switchTab(which) {
    const isLogin = which === 'login';
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    hideAlert();
  }
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  // Sudah login? langsung arahkan ke dashboard
  const existing = Session.user();
  if (Session.token() && existing && !Session.expired()) { Auth.redirect(existing); return; }

  const params = new URLSearchParams(location.search);
  if (params.get('expired')) showAlert('Sesi Anda berakhir. Silakan login kembali.', 'info');
  if (!API.isConfigured()) {
    document.getElementById('config-warning').classList.remove('hidden');
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();
    const btn = loginForm.querySelector('[type=submit]');
    UI.busy(btn, true);
    try {
      const data = await API.call('login', {
        email: loginForm.email.value.trim(),
        password: loginForm.password.value
      });
      Session.save(data.token, data.user);
      Auth.redirect(data.user); // role terdeteksi otomatis dari data Users
    } catch (err) {
      showAlert(err.message, 'error');
      UI.busy(btn, false);
    }
  });

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();
    const f = registerForm;
    if (f.password.value.length < 6) { showAlert('Password minimal 6 karakter.', 'error'); return; }
    if (f.password.value !== f.password2.value) { showAlert('Konfirmasi password tidak sama.', 'error'); return; }
    const btn = f.querySelector('[type=submit]');
    UI.busy(btn, true);
    try {
      const data = await API.call('register', {
        nama: f.nama.value.trim(),
        email: f.email.value.trim(),
        password: f.password.value,
        kode_kelas: f.kode_kelas.value.trim().toUpperCase()
      });
      Session.save(data.token, data.user);
      Auth.redirect(data.user);
    } catch (err) {
      showAlert(err.message, 'error');
      UI.busy(btn, false);
    }
  });
})();
