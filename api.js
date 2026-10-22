/* ============================================================
   ClassRoom Lite — api.js
   Wrapper fetch ke Google Apps Script + helper UI bersama
   ============================================================ */

// ⚠️ GANTI dengan URL Web App hasil deploy Apps Script (berakhiran /exec)
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzFHjn_RBHzGmmvijg3kIq5NTBSYiQTXoRJV2YVzB7SB8Oht23cbnFdaYryoxJPXDqm8A/exec',
  APP_NAME: 'ClassRoom Lite'
};

/* ---------------- Sesi (localStorage) ---------------- */
const Session = {
  save(token, user) {
    localStorage.setItem('crl_token', token);
    localStorage.setItem('crl_user', JSON.stringify(user));
    localStorage.setItem('crl_exp', String(Date.now() + 24 * 60 * 60 * 1000)); // 24 jam
  },
  token() { return localStorage.getItem('crl_token'); },
  user() {
    try { return JSON.parse(localStorage.getItem('crl_user') || 'null'); } catch (e) { return null; }
  },
  expired() { return Date.now() > Number(localStorage.getItem('crl_exp') || 0); },
  clear() { ['crl_token', 'crl_user', 'crl_exp'].forEach(k => localStorage.removeItem(k)); }
};

/* ---------------- Panggilan API ---------------- */
const API = {
  isConfigured() {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(CONFIG.API_URL);
  },

  /**
   * Semua request memakai POST + Content-Type text/plain agar termasuk "simple request"
   * (tanpa preflight CORS yang tidak didukung Apps Script).
   */
  async call(action, params = {}) {
    if (!API.isConfigured()) {
      throw new Error('URL API belum diatur. Edit file js/api.js lalu isi CONFIG.API_URL dengan URL Web App Apps Script.');
    }
    let res;
    try {
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, params, { action, token: Session.token() })),
        redirect: 'follow'
      });
    } catch (e) {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet dan URL API.');
    }
    let json;
    try { json = await res.json(); } catch (e) {
      throw new Error('Respons server tidak valid. Pastikan Web App di-deploy dengan akses "Anyone" dan URL berakhiran /exec.');
    }
    if (!json.success) {
      const err = new Error(json.message || 'Terjadi kesalahan');
      err.code = json.code;
      if (json.code === 'AUTH') {
        // Token habis / tidak valid → paksa login ulang
        Session.clear();
        if (!/index\.html$|\/$/.test(location.pathname)) location.replace('index.html?expired=1');
      }
      throw err;
    }
    return json.data;
  },

  /** Baca File → base64 lalu upload ke Google Drive via Apps Script. */
  async upload(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran file maksimal 5 MB');
    const b64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(new Error('Gagal membaca file'));
      fr.readAsDataURL(file);
    });
    return API.call('uploadFile', { name: file.name, mime: file.type, data: b64 });
  }
};

/* ---------------- Ikon (SVG) ---------------- */
const ICON_PATHS = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  classes: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
  tasks: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9z"/><path d="M9 12h6M9 16h4"/>',
  grade: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  announce: '<path d="M3 11v2a1 1 0 0 0 1 1h3l7 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  stream: '<path d="M4 5h16v11H9l-5 4z"/>',
  userx: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0M17 8l5 5M22 8l-5 5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
};
function icon(name, cls) {
  return '<svg class="' + (cls || 'w-5 h-5') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || '') + '</svg>';
}

/* ---------------- Helper UI ---------------- */
const UI = {
  /** Escape HTML — WAJIB dipakai untuk semua data dari server sebelum masuk innerHTML. */
  esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  /** Hanya izinkan URL http(s) (cegah javascript:). */
  url(u) {
    u = String(u || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  },
  initials(name) {
    const p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  },
  avatar(name, cls) {
    return '<span class="avatar ' + (cls || '') + '">' + UI.esc(UI.initials(name)) + '</span>';
  },
  fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  fmtDateTime(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
  timeAgo(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (isNaN(s)) return '';
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' hari lalu';
    return UI.fmtDate(iso);
  },
  /** "Sisa 2 hari 3 jam" / "Terlambat 5 jam" */
  countdown(iso) {
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    const d = Math.floor(abs / 86400000), h = Math.floor(abs % 86400000 / 3600000), m = Math.floor(abs % 3600000 / 60000), s = Math.floor(abs % 60000 / 1000);
    let t;
    if (d > 0) t = d + ' hari ' + h + ' jam';
    else if (h > 0) t = h + ' jam ' + m + ' menit';
    else t = m + ' menit ' + s + ' detik';
    return { late: diff < 0, text: (diff < 0 ? 'Terlambat ' : 'Sisa ') + t };
  },
  /** ISO → nilai untuk <input type="datetime-local"> */
  toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  },
  fromLocalInput(v) { return v ? new Date(v).toISOString() : ''; },

  /** Warna banner kelas (konsisten per id). */
  classColor(id) {
    const colors = ['#1a73e8', '#188038', '#e37400', '#a142f4', '#d93025', '#129eaf', '#d01884', '#5f6368'];
    let h = 0;
    String(id).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return colors[h % colors.length];
  },

  /* ----- Toast ----- */
  toast(msg, type) {
    type = type || 'success';
    let root = document.getElementById('toast-root');
    if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', 'status');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'error' ? 5000 : 3000);
  },

  /* ----- Tombol loading ----- */
  busy(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-busy', !!on);
    btn.disabled = !!on;
  },

  /* ----- Skeleton & Empty state ----- */
  skeletonCards(n) {
    let h = '<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">';
    for (let i = 0; i < (n || 3); i++) {
      h += '<div class="card p-4"><div class="skeleton" style="height:5rem"></div><div class="skeleton mt-4" style="height:.9rem;width:70%"></div><div class="skeleton mt-2" style="height:.9rem;width:45%"></div></div>';
    }
    return h + '</div>';
  },
  skeletonList(n) {
    let h = '<div class="card">';
    for (let i = 0; i < (n || 4); i++) {
      h += '<div class="row-item"><div class="skeleton" style="width:2.2rem;height:2.2rem;border-radius:9999px"></div><div class="flex-1"><div class="skeleton" style="height:.9rem;width:60%"></div><div class="skeleton mt-2" style="height:.75rem;width:35%"></div></div></div>';
    }
    return h + '</div>';
  },
  empty(title, text, actionHtml) {
    return '<div class="empty"><svg class="illus" viewBox="0 0 200 140" fill="none" aria-hidden="true">' +
      '<ellipse cx="100" cy="124" rx="70" ry="8" fill="#e8eaed"/>' +
      '<rect x="48" y="22" width="104" height="92" rx="8" fill="#e8f0fe" stroke="#aecbfa" stroke-width="2"/>' +
      '<rect x="64" y="42" width="72" height="8" rx="4" fill="#aecbfa"/>' +
      '<rect x="64" y="60" width="52" height="8" rx="4" fill="#d2e3fc"/>' +
      '<rect x="64" y="78" width="62" height="8" rx="4" fill="#d2e3fc"/>' +
      '<circle cx="146" cy="98" r="20" fill="#fff" stroke="#1a73e8" stroke-width="3"/>' +
      '<path d="M138 98h16M146 90v16" stroke="#1a73e8" stroke-width="3" stroke-linecap="round"/></svg>' +
      '<h3>' + UI.esc(title) + '</h3><p class="text-sm">' + UI.esc(text || '') + '</p>' +
      (actionHtml ? '<div class="mt-4">' + actionHtml + '</div>' : '') + '</div>';
  },

  /* ----- Modal ----- */
  _modals: [],
  /**
   * opts: { title, body (HTML), size: 'sm'|'md'|'lg', onClose }
   * return: { el, body, close }
   */
  modal(opts) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h2>' + UI.esc(opts.title || '') + '</h2><button type="button" class="btn-icon" data-close aria-label="Tutup">' + icon('close') + '</button></div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div></div>';
    document.body.appendChild(back);
    document.body.classList.add('no-scroll');
    const api = {
      el: back,
      body: back.querySelector('.modal-body'),
      close() {
        if (!back.isConnected) return;
        back.remove();
        UI._modals = UI._modals.filter(m => m !== api);
        if (!UI._modals.length) document.body.classList.remove('no-scroll');
        if (opts.onClose) opts.onClose();
      }
    };
    UI._modals.push(api);
    back.addEventListener('mousedown', e => { if (e.target === back) api.close(); });
    back.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
    return api;
  },

  /** Konfirmasi (dipakai sebelum delete). Resolve true/false. */
  confirm(opts) {
    if (typeof opts === 'string') opts = { message: opts };
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (!done) { done = true; resolve(v); } };
      const m = UI.modal({
        title: opts.title || 'Konfirmasi', size: 'sm', onClose: () => finish(false),
        body: '<p class="text-sm text-gray-700 pre-wrap">' + UI.esc(opts.message || 'Yakin?') + '</p>' +
          '<div class="flex justify-end gap-2 mt-5"><button type="button" class="btn btn-ghost" data-close>Batal</button>' +
          '<button type="button" class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + '" id="cf-ok">' + UI.esc(opts.confirmText || 'Hapus') + '</button></div>'
      });
      m.el.querySelector('#cf-ok').addEventListener('click', () => { finish(true); m.close(); });
    });
  },

  /**
   * Modal berisi form otomatis.
   * fields: [{name,label,type,value,required,options:[{value,label}],placeholder,rows,hint,maxlength,min,max}]
   * onSubmit(values, modal) → Promise; modal otomatis tertutup jika sukses.
   */
  formModal(opts) {
    const fieldHtml = f => {
      const id = 'f_' + f.name;
      const req = f.required ? ' required' : '';
      const common = ' id="' + id + '" name="' + f.name + '" class="input"' + req + (f.placeholder ? ' placeholder="' + UI.esc(f.placeholder) + '"' : '') + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '');
      let input;
      if (f.type === 'textarea') {
        input = '<textarea' + common + ' rows="' + (f.rows || 4) + '">' + UI.esc(f.value || '') + '</textarea>';
      } else if (f.type === 'select') {
        input = '<select' + common + '>' + (f.options || []).map(o => '<option value="' + UI.esc(o.value) + '"' + (String(o.value) === String(f.value) ? ' selected' : '') + '>' + UI.esc(o.label) + '</option>').join('') + '</select>';
      } else {
        input = '<input type="' + (f.type || 'text') + '"' + common + ' value="' + UI.esc(f.value || '') + '"' +
          (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + (f.step ? ' step="' + f.step + '"' : '') + ' autocomplete="off">';
      }
      return '<div><label class="label" for="' + id + '">' + UI.esc(f.label) + (f.required ? ' <span class="text-red-600">*</span>' : '') + '</label>' + input + (f.hint ? '<p class="hint">' + UI.esc(f.hint) + '</p>' : '') + '</div>';
    };
    const m = UI.modal({
      title: opts.title, size: opts.size,
      body: (opts.intro ? '<p class="text-sm text-gray-600 mb-4 pre-wrap">' + UI.esc(opts.intro) + '</p>' : '') +
        '<form class="space-y-4" novalidate>' + opts.fields.map(fieldHtml).join('') +
        '<div class="flex justify-end gap-2 pt-2"><button type="button" class="btn btn-ghost" data-close>Batal</button>' +
        '<button type="submit" class="btn btn-primary">' + UI.esc(opts.submitText || 'Simpan') + '</button></div></form>'
    });
    const form = m.el.querySelector('form');
    const submitBtn = form.querySelector('[type=submit]');
    const first = form.querySelector('input,textarea,select');
    if (first) setTimeout(() => first.focus(), 50);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const values = {};
      opts.fields.forEach(f => { values[f.name] = form.elements[f.name].value.trim(); });
      UI.busy(submitBtn, true);
      try {
        await opts.onSubmit(values, m);
        m.close();
      } catch (err) {
        UI.toast(err.message || 'Gagal menyimpan', 'error');
        UI.busy(submitBtn, false);
      }
    });
    return m;
  },

  /** Salin teks ke clipboard. */
  async copy(text) {
    try { await navigator.clipboard.writeText(text); UI.toast('Disalin: ' + text, 'info'); }
    catch (e) { UI.toast('Gagal menyalin, salin manual: ' + text, 'error'); }
  }
};

// Tutup modal teratas dengan tombol Esc
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI._modals.length) UI._modals[UI._modals.length - 1].close();
});
