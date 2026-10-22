/* ============================================================
   ClassRoom Lite — siswa.js
   SPA dashboard Siswa (routing hash: #/ , #/kelas/ID/stream|tugas|materi|teman)
   ============================================================ */

const ME = Auth.guard('siswa');
const $ = (sel, root) => (root || document).querySelector(sel);
const $view = document.getElementById('view');

const S = { data: null };
const D = () => S.data;
const classById = id => (D() ? D().classes.find(c => c.id === id) : null) || null;

/** Satu listener klik per elemen; handler terbaru menggantikan yang lama (hindari klik ganda). */
function bind(el, handlers) {
  el._handlers = handlers;
  if (el._bound) return;
  el._bound = true;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !el.contains(b)) return;
    const h = el._handlers[b.dataset.act];
    if (h) { e.preventDefault(); h(b.dataset.id, b, e); }
  });
}

async function loadData() { S.data = await API.call('getSiswaData'); }
async function refresh() {
  try { await loadData(); } catch (e) { UI.toast(e.message, 'error'); }
  render();
}

/** Status tugas: Belum Dikerjakan / Terlambat / Sudah Dikumpulkan / Dinilai */
function statusOf(a) {
  const s = a.submission;
  if (s) {
    if (s.nilai !== null) return { key: 'graded', label: 'Dinilai', cls: 'badge-green' };
    const late = new Date(s.submitted_at) > new Date(a.deadline);
    return { key: 'submitted', label: 'Sudah Dikumpulkan' + (late ? ' (terlambat)' : ''), cls: 'badge-blue' };
  }
  if (new Date(a.deadline) < new Date()) return { key: 'late', label: 'Terlambat', cls: 'badge-red' };
  return { key: 'todo', label: 'Belum Dikerjakan', cls: 'badge-gray' };
}

/* ---------------- Boot ---------------- */
function boot() {
  $('#hdr-avatar').innerHTML = UI.avatar(ME.nama);
  $('#hdr-name').textContent = ME.nama;
  $('#um-name').textContent = ME.nama;
  $('#um-email').textContent = ME.email;
  $('#btn-join').innerHTML = icon('plus', 'w-4 h-4') + '<span>Gabung Kelas</span>';
  $('#btn-logout').innerHTML = icon('logout') + '<span>Keluar</span>';

  const menu = $('#user-menu');
  $('#btn-user').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.add('hidden'); });
  $('#btn-logout').addEventListener('click', async () => {
    menu.classList.add('hidden');
    if (await UI.confirm({ title: 'Keluar', message: 'Keluar dari akun ini?', confirmText: 'Keluar', danger: false })) Auth.logout();
  });
  $('#btn-join').addEventListener('click', joinClassForm);
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  $view.innerHTML = UI.skeletonCards(3);
  loadData().then(render).catch(err => {
    $view.innerHTML = UI.empty('Gagal memuat data', err.message, '<button class="btn btn-primary" onclick="location.reload()">Coba lagi</button>');
  });
}

function render() {
  if (!D()) return;
  const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  document.body.classList.toggle('has-bottom-nav', parts[0] === 'kelas' && !!parts[1]);
  if (parts[0] === 'kelas' && parts[1]) return pageKelas(parts[1], parts[2]);
  $('#page-title').textContent = '';
  pageHome();
}

/* ============================================================
   HOME — daftar kelas
   ============================================================ */
function pageHome() {
  const d = D();
  const upcoming = d.assignments.filter(a => !a.submission).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6);

  $view.innerHTML = '<div id="pg"><div class="mb-5"><h2 class="text-xl font-medium">Halo, ' + UI.esc(ME.nama.split(' ')[0]) + '! 👋</h2>' +
    '<p class="text-sm text-gray-600">Berikut kelas yang kamu ikuti.</p></div>' +
    (d.classes.length ? '<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">' + d.classes.map(c => {
      const todo = d.assignments.filter(a => a.class_id === c.id && !a.submission).length;
      return '<article class="card class-card card-hover" data-act="open" data-id="' + c.id + '">' +
        '<div class="banner" style="background:' + UI.classColor(c.id) + '"><h3 class="truncate">' + UI.esc(c.nama_kelas) + '</h3><p>' + UI.esc(c.guru_nama) + '</p>' +
        '<span class="avatar avatar-lg" style="background:#fff;color:' + UI.classColor(c.id) + '">' + UI.esc(UI.initials(c.guru_nama)) + '</span></div>' +
        '<div class="px-4 pt-6 pb-3 mt-auto text-sm text-gray-600 flex items-center justify-between"><span>' + c.siswa_count + ' siswa</span>' +
        (todo ? '<span class="badge badge-yellow">' + todo + ' tugas belum selesai</span>' : '<span class="badge badge-green">Semua tugas beres</span>') + '</div></article>';
    }).join('') + '</div>'
      : '<div class="card">' + UI.empty('Kamu belum bergabung di kelas manapun', 'Masukkan kode kelas dari gurumu untuk bergabung.', '<button class="btn btn-primary" data-act="join">Gabung Kelas</button>') + '</div>') +
    (upcoming.length ? '<section><h2 class="font-medium mb-2">Tugas yang perlu dikerjakan</h2><div class="card">' + upcoming.map(a => taskRow(a, true)).join('') + '</div></section>' : '') + '</div>';

  bind($('#pg'), {
    open: id => { location.hash = '#/kelas/' + id; },
    join: joinClassForm,
    task: id => openAssignment(id)
  });
}

/** Baris tugas (dipakai di home & tab tugas). */
function taskRow(a, showClass) {
  const st = statusOf(a);
  const cd = UI.countdown(a.deadline);
  return '<div class="row-item card-hover" data-act="task" data-id="' + a.id + '" style="cursor:pointer">' +
    '<span class="avatar" style="background:#e8f0fe;color:#1a73e8">' + icon('tasks', 'w-4 h-4') + '</span>' +
    '<div class="flex-1 min-w-0"><p class="font-medium truncate">' + UI.esc(a.judul) + '</p>' +
    '<p class="text-xs text-gray-500">' + (showClass ? UI.esc(a.nama_kelas) + ' · ' : '') + 'Deadline ' + UI.fmtDateTime(a.deadline) +
    (!a.submission ? ' · <span class="' + (cd.late ? 'text-red-600' : '') + '">' + cd.text + '</span>' : '') + '</p></div>' +
    (a.submission && a.submission.nilai !== null ? '<b class="text-[#188038]">' + a.submission.nilai + '</b>' : '') +
    '<span class="badge ' + st.cls + ' hidden sm:inline-flex">' + st.label + '</span></div>';
}

function joinClassForm() {
  UI.formModal({
    title: 'Gabung Kelas', size: 'sm', submitText: 'Gabung',
    intro: 'Minta kode kelas (6 karakter) dari gurumu, lalu masukkan di sini.',
    fields: [{ name: 'kode_kelas', label: 'Kode kelas', required: true, maxlength: 6, placeholder: 'mis. MTK7A1' }],
    onSubmit: async v => {
      const r = await API.call('joinClass', { kode_kelas: v.kode_kelas.toUpperCase() });
      UI.toast('Berhasil bergabung di ' + r.nama_kelas);
      await refresh();
      location.hash = '#/kelas/' + r.id;
    }
  });
}

/* ============================================================
   DETAIL KELAS — Stream / Tugas / Materi / Teman
   ============================================================ */
function pageKelas(id, tab) {
  const c = classById(id);
  if (!c) {
    $('#page-title').textContent = '';
    $view.innerHTML = '<div class="card">' + UI.empty('Kelas tidak ditemukan', 'Kamu mungkin sudah keluar dari kelas ini.', '<a class="btn btn-primary" href="#/">Kembali</a>') + '</div>';
    return;
  }
  $('#page-title').textContent = c.nama_kelas;
  const tabs = [
    { key: 'stream', label: 'Stream', icon: 'stream' },
    { key: 'tugas', label: 'Tugas', icon: 'tasks' },
    { key: 'materi', label: 'Materi', icon: 'folder' },
    { key: 'teman', label: 'Teman', icon: 'users' }
  ];
  const cur = tabs.find(t => t.key === tab) || tabs[0];

  $view.innerHTML = '<div id="pg"><a href="#/" class="text-sm inline-block mb-3">← Semua kelas</a>' +
    '<div class="card overflow-hidden mb-4"><div class="p-5 text-white" style="background:' + UI.classColor(c.id) + '">' +
    '<h2 class="text-2xl font-medium">' + UI.esc(c.nama_kelas) + '</h2><p class="text-sm opacity-90">' + UI.esc(c.guru_nama) + (c.deskripsi ? ' · ' + UI.esc(c.deskripsi) : '') + '</p></div>' +
    '<nav class="tabbar bottom-nav" aria-label="Tab kelas">' + tabs.map(t =>
      '<a class="tab' + (t.key === cur.key ? ' active' : '') + '" href="#/kelas/' + c.id + '/' + t.key + '">' + icon(t.icon, 'w-5 h-5') + '<span>' + t.label + '</span></a>').join('') + '</nav></div>' +
    '<div id="tab-content"></div></div>';

  const el = $('#tab-content');
  ({ stream: tabStream, tugas: tabTugas, materi: tabMateri, teman: tabTeman })[cur.key](el, c);
  bind($('#pg'), {
    task: aid => openAssignment(aid),
    leave: async () => {
      if (await UI.confirm({ title: 'Keluar dari kelas', message: 'Keluar dari kelas "' + c.nama_kelas + '"?\nPengumpulan tugasmu di kelas ini tidak akan tersimpan lagi.', confirmText: 'Keluar' })) {
        try { await API.call('leaveClass', { class_id: c.id }); UI.toast('Kamu telah keluar dari kelas'); location.hash = '#/'; await refresh(); }
        catch (e) { UI.toast(e.message, 'error'); }
      }
    }
  });
}

/* ---------- Stream ---------- */
function tabStream(el, c) {
  const items = D().announcements.filter(a => a.class_id === c.id);
  const upcoming = D().assignments.filter(a => a.class_id === c.id && !a.submission).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
  el.innerHTML = '<div class="grid gap-4 lg:grid-cols-[15rem_1fr]">' +
    '<aside class="space-y-4"><div class="card p-4"><p class="text-xs text-gray-500">Kode kelas</p><p class="font-mono text-lg tracking-widest">' + UI.esc(c.kode_kelas) + '</p>' +
    '<button class="btn btn-ghost btn-sm mt-2 -ml-2" data-act="leave">Keluar dari kelas</button></div>' +
    '<div class="card p-4"><p class="font-medium text-sm mb-2">Tugas mendatang</p>' + (upcoming.length ? upcoming.map(a => {
      const cd = UI.countdown(a.deadline);
      return '<div class="py-1.5 cursor-pointer" data-act="task" data-id="' + a.id + '"><p class="text-sm truncate hover:underline">' + UI.esc(a.judul) + '</p><p class="text-xs ' + (cd.late ? 'text-red-600' : 'text-gray-500') + '">' + cd.text + '</p></div>';
    }).join('') : '<p class="text-xs text-gray-500">Tidak ada tugas yang menunggu 🎉</p>') + '</div></aside>' +
    '<div class="space-y-3">' + (items.length ? items.map(a =>
      '<article class="card p-4"><div class="flex gap-3">' + UI.avatar(a.guru_nama) + '<div class="flex-1 min-w-0">' +
      '<p class="text-sm"><b>' + UI.esc(a.guru_nama) + '</b> <span class="text-gray-500">· ' + UI.timeAgo(a.created_at) + '</span></p>' +
      '<h3 class="font-medium mt-1">' + UI.esc(a.judul) + '</h3><p class="mt-1 text-sm pre-wrap">' + UI.esc(a.isi) + '</p></div></div></article>').join('')
      : '<div class="card">' + UI.empty('Belum ada pengumuman', 'Pengumuman dari gurumu akan muncul di sini.') + '</div>') + '</div></div>';
}

/* ---------- Tugas ---------- */
function tabTugas(el, c) {
  const order = { todo: 0, late: 1, submitted: 2, graded: 3 };
  const items = D().assignments.filter(a => a.class_id === c.id)
    .sort((a, b) => (order[statusOf(a).key] - order[statusOf(b).key]) || a.deadline.localeCompare(b.deadline));
  el.innerHTML = items.length
    ? '<div class="card">' + items.map(a => taskRow(a, false)).join('') + '</div>'
    : '<div class="card">' + UI.empty('Belum ada tugas', 'Tugas dari gurumu akan muncul di sini.') + '</div>';
}

/* ---------- Materi ---------- */
function tabMateri(el, c) {
  const items = D().materials.filter(m => m.class_id === c.id);
  el.innerHTML = items.length ? '<div class="card">' + items.map(m => {
    const href = UI.url(m.url);
    return '<div class="row-item"><span class="avatar" style="background:#e8f0fe;color:#1a73e8">' + icon(m.tipe === 'file' ? 'file' : 'link', 'w-4 h-4') + '</span>' +
      '<div class="flex-1 min-w-0"><p class="font-medium truncate">' + UI.esc(m.judul) + '</p><p class="text-xs text-gray-500">' + (m.tipe === 'file' ? 'File' : 'Link') + ' · ' + UI.fmtDate(m.created_at) + '</p></div>' +
      (href ? '<a class="btn btn-outline btn-sm" href="' + UI.esc(href) + '" target="_blank" rel="noopener noreferrer">Buka ' + icon('external', 'w-4 h-4') + '</a>' : '') + '</div>';
  }).join('') + '</div>' : '<div class="card">' + UI.empty('Belum ada materi', 'Materi yang dibagikan guru akan muncul di sini.') + '</div>';
}

/* ---------- Teman ---------- */
function tabTeman(el, c) {
  const mates = D().students.filter(s => s.class_id === c.id);
  el.innerHTML = '<div class="card"><div class="px-4 py-3 border-b border-[#dadce0] text-lg font-medium" style="color:' + UI.classColor(c.id) + '">Guru</div>' +
    '<div class="row-item">' + UI.avatar(c.guru_nama) + '<span>' + UI.esc(c.guru_nama) + '</span></div></div>' +
    '<div class="card mt-4"><div class="px-4 py-3 border-b border-[#dadce0] flex items-center justify-between"><span class="text-lg font-medium" style="color:' + UI.classColor(c.id) + '">Teman sekelas</span><span class="text-sm text-gray-500">' + mates.length + ' siswa</span></div>' +
    (mates.length ? mates.map(s => '<div class="row-item">' + UI.avatar(s.nama) + '<span>' + UI.esc(s.nama) + '</span>' + (s.siswa_id === ME.id ? '<span class="badge badge-blue">Kamu</span>' : '') + '</div>').join('')
      : UI.empty('Belum ada teman sekelas', '')) + '</div>';
}

/* ============================================================
   MODAL TUGAS — detail, kumpulkan, lihat nilai
   ============================================================ */
function openAssignment(id) {
  const a = D().assignments.find(x => x.id === id);
  if (!a) return;
  const sub = a.submission;
  const st = statusOf(a);
  const graded = sub && sub.nilai !== null;
  let timer = null;

  const header =
    '<div class="flex flex-wrap items-center gap-2 mb-2"><span class="badge badge-blue">' + UI.esc(a.nama_kelas) + '</span><span class="badge ' + st.cls + '">' + st.label + '</span></div>' +
    '<div class="rounded-lg bg-[#f8f9fa] border border-[#dadce0] px-3 py-2 mb-3 text-sm flex flex-wrap items-center justify-between gap-2">' +
    '<span>' + icon('clock', 'w-4 h-4 inline -mt-0.5') + ' Deadline: <b>' + UI.fmtDateTime(a.deadline) + '</b></span><b id="cd"></b></div>' +
    (a.deskripsi ? '<p class="text-sm pre-wrap mb-3">' + UI.esc(a.deskripsi) + '</p>' : '') +
    (UI.url(a.file_url) ? '<p class="mb-3"><a class="inline-flex items-center gap-1 text-sm" href="' + UI.esc(UI.url(a.file_url)) + '" target="_blank" rel="noopener noreferrer">' + icon('link', 'w-4 h-4') + ' Lampiran dari guru</a></p>' : '');

  let body;
  if (graded) {
    // Sudah dinilai → tampilkan nilai & feedback
    body = header + '<div class="rounded-lg border border-[#ceead6] bg-[#e6f4ea] p-4 mb-3 text-center"><p class="text-sm text-[#188038]">Nilai kamu</p>' +
      '<p class="text-4xl font-medium text-[#188038]">' + sub.nilai + '<span class="text-lg text-gray-500">/100</span></p></div>' +
      '<div class="mb-3"><p class="label">Feedback guru</p><p class="text-sm pre-wrap">' + (sub.feedback ? UI.esc(sub.feedback) : '<span class="text-gray-400">Tidak ada feedback.</span>') + '</p></div>' +
      '<div class="rounded-lg bg-[#f8f9fa] border border-[#dadce0] p-3 text-sm"><p class="label">Jawabanmu (dikumpulkan ' + UI.fmtDateTime(sub.submitted_at) + ')</p>' +
      (sub.jawaban ? '<p class="pre-wrap">' + UI.esc(sub.jawaban) + '</p>' : '') +
      (UI.url(sub.file_url) ? '<p class="mt-1"><a href="' + UI.esc(UI.url(sub.file_url)) + '" target="_blank" rel="noopener noreferrer">Buka file / link jawaban</a></p>' : '') + '</div>' +
      '<div class="flex justify-end mt-4"><button class="btn btn-primary" data-close>Tutup</button></div>';
  } else {
    body = header +
      (sub ? '<div class="text-sm rounded-lg bg-[#e8f0fe] text-[#1557b0] px-3 py-2 mb-3">Kamu sudah mengumpulkan pada ' + UI.fmtDateTime(sub.submitted_at) + '. Kamu masih bisa memperbarui sampai guru memberi nilai.</div>' : '') +
      (new Date(a.deadline) < new Date() ? '<div class="text-sm rounded-lg bg-[#fef7e0] text-[#e37400] px-3 py-2 mb-3">Batas waktu sudah lewat — pengumpulanmu akan ditandai terlambat.</div>' : '') +
      '<form class="space-y-3" novalidate>' +
      '<div><label class="label" for="s-link">Link jawaban (Google Drive / Docs / dll)</label><input id="s-link" class="input" type="url" placeholder="https://..." value="' + UI.esc(sub ? sub.file_url : '') + '"></div>' +
      '<div><label class="label" for="s-file">atau unggah file (maks 5 MB)</label><input id="s-file" class="input" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.zip">' +
      '<p class="hint">File diunggah ke Google Drive milik guru/admin. Jika memilih file, link di atas diabaikan.</p></div>' +
      '<div><label class="label" for="s-jwb">Jawaban / catatan</label><textarea id="s-jwb" class="input" rows="4" maxlength="5000" placeholder="Tulis jawabanmu di sini...">' + UI.esc(sub ? sub.jawaban : '') + '</textarea></div>' +
      '<div class="flex justify-end gap-2"><button type="button" class="btn btn-ghost" data-close>Batal</button><button type="submit" class="btn btn-primary">' + (sub ? 'Perbarui Pengumpulan' : 'Kumpulkan') + '</button></div></form>';
  }

  const m = UI.modal({ title: a.judul, size: 'lg', body, onClose: () => clearInterval(timer) });

  // Countdown real-time
  const cdEl = m.el.querySelector('#cd');
  const tick = () => {
    const c = UI.countdown(a.deadline);
    cdEl.textContent = c.text;
    cdEl.style.color = c.late ? '#d93025' : '#188038';
  };
  tick();
  timer = setInterval(() => { if (!cdEl.isConnected) clearInterval(timer); else tick(); }, 1000);

  const form = m.el.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const link = m.el.querySelector('#s-link').value.trim();
    const file = m.el.querySelector('#s-file').files[0];
    const jawaban = m.el.querySelector('#s-jwb').value.trim();
    if (!link && !file && !jawaban) { UI.toast('Isi jawaban, link, atau pilih file terlebih dahulu', 'error'); return; }
    if (link && !UI.url(link)) { UI.toast('Link harus diawali http:// atau https://', 'error'); return; }
    UI.busy(btn, true);
    try {
      let fileUrl = link;
      if (file) {
        const up = await API.upload(file);
        fileUrl = up.url;
        if (!up.shared) UI.toast('File terunggah, tetapi pengaturan berbagi dibatasi domain sekolah. Pastikan guru dapat membukanya.', 'info');
      }
      await API.call('submitAssignment', { assignment_id: a.id, file_url: fileUrl, jawaban });
      UI.toast(sub ? 'Pengumpulan diperbarui' : 'Tugas berhasil dikumpulkan');
      m.close();
      await refresh();
    } catch (err) {
      UI.toast(err.message, 'error');
      UI.busy(btn, false);
    }
  });
}

if (ME) boot();
