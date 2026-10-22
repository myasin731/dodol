/* ============================================================
   ClassRoom Lite — guru.js
   SPA dashboard Guru/Admin (routing berbasis hash: #/dashboard, #/kelas/ID/tugas, dst.)
   ============================================================ */

const ME = Auth.guard('guru');
const $ = (sel, root) => (root || document).querySelector(sel);
const $view = document.getElementById('view');

// State aplikasi: seluruh data guru dimuat sekali (getGuruData) lalu di-refresh setelah setiap perubahan
const S = {
  data: null,
  filters: { tugas: '', pengumuman: '', materi: '', siswa: '', nilaiKelas: '', nilaiTugas: '', nilaiAll: false, q: '' }
};

const MENU = [
  { key: 'dashboard',  label: 'Dashboard',  icon: 'dashboard' },
  { key: 'kelas',      label: 'Kelas Saya', icon: 'classes' },
  { key: 'tugas',      label: 'Tugas',      icon: 'tasks' },
  { key: 'penilaian',  label: 'Penilaian',  icon: 'grade' },
  { key: 'pengumuman', label: 'Pengumuman', icon: 'announce' },
  { key: 'materi',     label: 'Materi',     icon: 'folder' },
  { key: 'siswa',      label: 'Siswa',      icon: 'users' }
];

/* ---------------- Utilitas data ---------------- */
const D = () => S.data;
const classById = id => (D() ? D().classes.find(c => c.id === id) : null) || null;
const classOptionsHtml = sel => D().classes.map(c => '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + UI.esc(c.nama_kelas) + '</option>').join('');
const classOptions = () => D().classes.map(c => ({ value: c.id, label: c.nama_kelas }));
const isLate = s => s && s.deadline && new Date(s.submitted_at) > new Date(s.deadline);

/** Pasang satu listener klik yang menangani semua elemen [data-act] di dalam el. */
function bind(el, handlers) {
  el._handlers = handlers;          // handler terbaru selalu menggantikan yang lama
  if (el._bound) return;            // listener hanya dipasang sekali per elemen (hindari klik ganda)
  el._bound = true;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !el.contains(b)) return;
    const h = el._handlers[b.dataset.act];
    if (h) { e.preventDefault(); h(b.dataset.id, b, e); }
  });
}

function ensureClasses() {
  if (!D().classes.length) { UI.toast('Buat kelas terlebih dahulu di menu "Kelas Saya"', 'error'); return false; }
  return true;
}

async function loadData() { S.data = await API.call('getGuruData'); }

/** Muat ulang data dari server lalu gambar ulang halaman aktif. */
async function refresh() {
  try { await loadData(); } catch (e) { UI.toast(e.message, 'error'); }
  render();
}

/** Jalankan aksi API dengan toast sukses + refresh. */
async function act(action, params, okMsg) {
  await API.call(action, params);
  if (okMsg) UI.toast(okMsg);
  await refresh();
}

/* ---------------- Boot & routing ---------------- */
function boot() {
  $('#hdr-name').textContent = ME.nama;
  $('#hdr-avatar').innerHTML = UI.avatar(ME.nama);
  $('#btn-menu').innerHTML = icon('menu');
  $('#nav').innerHTML = MENU.map(m =>
    '<a class="nav-item" href="#/' + m.key + '" data-key="' + m.key + '">' + icon(m.icon) + '<span>' + m.label + '</span></a>'
  ).join('') + '<a class="nav-item" href="#" id="btn-logout">' + icon('logout') + '<span>Logout</span></a>';

  $('#btn-logout').addEventListener('click', async e => {
    e.preventDefault();
    if (await UI.confirm({ title: 'Logout', message: 'Keluar dari akun ini?', confirmText: 'Logout', danger: false })) Auth.logout();
  });

  const sidebar = $('#sidebar'), overlay = $('#drawer-overlay');
  const toggle = open => { sidebar.classList.toggle('open', open); overlay.classList.toggle('show', open); };
  $('#btn-menu').addEventListener('click', () => toggle(true));
  overlay.addEventListener('click', () => toggle(false));
  window.addEventListener('hashchange', () => { toggle(false); render(); window.scrollTo(0, 0); });

  $view.innerHTML = UI.skeletonCards(3);
  loadData().then(render).catch(err => {
    $view.innerHTML = UI.empty('Gagal memuat data', err.message, '<button class="btn btn-primary" onclick="location.reload()">Coba lagi</button>');
  });
}

function render() {
  if (!D()) return;
  const parts = (location.hash || '#/dashboard').replace(/^#\/?/, '').split('/');
  const page = parts[0] || 'dashboard';
  document.querySelectorAll('#nav .nav-item[data-key]').forEach(a => a.classList.toggle('active', a.dataset.key === page));
  document.body.classList.toggle('has-bottom-nav', page === 'kelas' && !!parts[1]);

  const titles = { dashboard: 'Dashboard', kelas: 'Kelas Saya', tugas: 'Tugas', penilaian: 'Penilaian', pengumuman: 'Pengumuman', materi: 'Materi', siswa: 'Siswa' };
  $('#page-title').textContent = titles[page] || 'ClassRoom Lite';

  switch (page) {
    case 'dashboard': return pageDashboard();
    case 'kelas': return parts[1] ? pageKelasDetail(parts[1], parts[2]) : pageKelas();
    case 'tugas': case 'pengumuman': case 'materi': case 'siswa': return pageList(page);
    case 'penilaian': return pagePenilaian();
    default: location.hash = '#/dashboard';
  }
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function pageDashboard() {
  const d = D();
  const ungraded = d.submissions.filter(s => s.nilai === null).length;
  const totalSiswa = new Set(d.students.map(s => s.siswa_id)).size;
  const stats = [
    { label: 'Total Kelas', value: d.classes.length, icon: 'classes', color: '#1a73e8', href: '#/kelas' },
    { label: 'Total Siswa', value: totalSiswa, icon: 'users', color: '#188038', href: '#/siswa' },
    { label: 'Total Tugas', value: d.assignments.length, icon: 'tasks', color: '#e37400', href: '#/tugas' },
    { label: 'Belum Dinilai', value: ungraded, icon: 'grade', color: '#d93025', href: '#/penilaian' }
  ];
  const recent = d.submissions.slice(0, 5);

  $view.innerHTML =
    '<p class="text-gray-600 mb-4">Halo, <b>' + UI.esc(ME.nama) + '</b> 👋 Berikut ringkasan kelasmu.</p>' +
    '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">' + stats.map(s =>
      '<a href="' + s.href + '" class="card card-hover p-4 block no-underline" style="color:inherit">' +
      '<div class="flex items-center justify-between"><span class="text-sm text-gray-500">' + s.label + '</span>' +
      '<span style="color:' + s.color + '">' + icon(s.icon) + '</span></div>' +
      '<div class="text-3xl font-medium mt-2" style="color:' + s.color + '">' + s.value + '</div></a>').join('') + '</div>' +
    '<section class="card"><div class="px-4 py-3 border-b border-[#dadce0] flex items-center justify-between">' +
    '<h2 class="font-medium">Pengumpulan tugas terbaru</h2><a href="#/penilaian" class="text-sm">Lihat penilaian</a></div>' +
    '<div id="recent">' + (recent.length ? recent.map(s =>
      '<div class="row-item">' + UI.avatar(s.siswa_nama) +
      '<div class="flex-1 min-w-0"><p class="text-sm truncate"><b>' + UI.esc(s.siswa_nama) + '</b> mengumpulkan <b>' + UI.esc(s.assignment_judul) + '</b></p>' +
      '<p class="text-xs text-gray-500">' + UI.esc(s.nama_kelas) + ' · ' + UI.timeAgo(s.submitted_at) + (isLate(s) ? ' · <span class="text-red-600">terlambat</span>' : '') + '</p></div>' +
      (s.nilai === null ? '<span class="badge badge-yellow hidden sm:inline-flex">Belum dinilai</span>' : '<span class="badge badge-green">Nilai ' + s.nilai + '</span>') +
      '<button class="btn btn-outline btn-sm" data-act="grade" data-id="' + s.id + '">' + (s.nilai === null ? 'Nilai' : 'Lihat') + '</button></div>').join('')
      : UI.empty('Belum ada pengumpulan', 'Pengumpulan tugas dari siswa akan muncul di sini.')) + '</div></section>';

  bind($('#recent'), { grade: id => { const s = D().submissions.find(x => x.id === id); if (s) openGradeModal(s); } });
}

/* ============================================================
   KELAS SAYA
   ============================================================ */
function pageKelas() {
  const d = D();
  $view.innerHTML = '<div id="pg">' +
    '<div class="flex items-center justify-between mb-4"><p class="text-sm text-gray-600">' + d.classes.length + ' kelas</p>' +
    '<button class="btn btn-primary" data-act="new">' + icon('plus', 'w-4 h-4') + ' Buat Kelas Baru</button></div><div id="cls"></div></div>';
  const box = $('#cls');
  box.innerHTML = d.classes.length
    ? '<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">' + d.classes.map(classCard).join('') + '</div>'
    : UI.empty('Belum ada kelas', 'Buat kelas pertamamu, lalu bagikan kode kelas kepada siswa.', '<button class="btn btn-primary" data-act="new">Buat Kelas Baru</button>');

  const handlers = {
    new: () => classForm(null),
    open: id => { location.hash = '#/kelas/' + id; },
    edit: id => classForm(classById(id)),
    copy: (id, b) => UI.copy(b.dataset.kode),
    del: async id => {
      const c = classById(id);
      if (await UI.confirm({ title: 'Hapus kelas', message: 'Hapus kelas "' + c.nama_kelas + '" beserta seluruh tugas, pengumuman, materi, dan nilai di dalamnya?\nTindakan ini tidak dapat dibatalkan.' })) {
        try { await act('deleteClass', { id }, 'Kelas dihapus'); } catch (e) { UI.toast(e.message, 'error'); }
      }
    }
  };
  bind($('#pg'), handlers);
}

function classCard(c) {
  return '<article class="card class-card card-hover" data-act="open" data-id="' + c.id + '">' +
    '<div class="banner" style="background:' + UI.classColor(c.id) + '"><h3 class="truncate">' + UI.esc(c.nama_kelas) + '</h3>' +
    '<p class="line-clamp-2">' + UI.esc(c.deskripsi || 'Tanpa deskripsi') + '</p></div>' +
    '<div class="px-4 pt-3 pb-2 flex items-center justify-between text-sm">' +
    '<button class="inline-flex items-center gap-1.5 font-mono tracking-widest px-2 py-1 rounded bg-[#e8f0fe] text-[#1557b0]" data-act="copy" data-id="' + c.id + '" data-kode="' + UI.esc(c.kode_kelas) + '" title="Salin kode kelas">' + UI.esc(c.kode_kelas) + icon('copy', 'w-3.5 h-3.5') + '</button>' +
    '<span class="text-gray-500">' + c.siswa_count + ' siswa · ' + c.tugas_count + ' tugas</span></div>' +
    '<div class="flex justify-end gap-1 px-2 pb-2 mt-auto">' +
    '<button class="btn-icon" data-act="edit" data-id="' + c.id + '" aria-label="Edit kelas">' + icon('edit', 'w-4 h-4') + '</button>' +
    '<button class="btn-icon danger" data-act="del" data-id="' + c.id + '" aria-label="Hapus kelas">' + icon('trash', 'w-4 h-4') + '</button></div></article>';
}

function classForm(c) {
  UI.formModal({
    title: c ? 'Edit Kelas' : 'Buat Kelas Baru',
    intro: c ? '' : 'Kode kelas 6 karakter akan dibuat otomatis untuk dibagikan ke siswa.',
    submitText: c ? 'Simpan' : 'Buat Kelas',
    fields: [
      { name: 'nama_kelas', label: 'Nama kelas', required: true, value: c ? c.nama_kelas : '', maxlength: 80, placeholder: 'mis. Matematika 7A' },
      { name: 'deskripsi', label: 'Deskripsi', type: 'textarea', rows: 3, value: c ? c.deskripsi : '', maxlength: 300 }
    ],
    onSubmit: async v => {
      if (c) await act('updateClass', { id: c.id, nama_kelas: v.nama_kelas, deskripsi: v.deskripsi }, 'Kelas diperbarui');
      else {
        const nc = await API.call('createClass', v);
        UI.toast('Kelas dibuat. Kode kelas: ' + nc.kode_kelas);
        await refresh();
      }
    }
  });
}

/* ---------- Detail kelas (tab: Stream, Tugas, Materi, Siswa) ---------- */
function pageKelasDetail(id, tab) {
  const c = classById(id);
  if (!c) {
    $view.innerHTML = UI.empty('Kelas tidak ditemukan', 'Kelas mungkin sudah dihapus.', '<a class="btn btn-primary" href="#/kelas">Kembali ke Kelas Saya</a>');
    return;
  }
  const tabs = [
    { key: 'stream', label: 'Stream', icon: 'stream', kind: 'pengumuman' },
    { key: 'tugas', label: 'Tugas', icon: 'tasks', kind: 'tugas' },
    { key: 'materi', label: 'Materi', icon: 'folder', kind: 'materi' },
    { key: 'siswa', label: 'Siswa', icon: 'users', kind: 'siswa' }
  ];
  const cur = tabs.find(t => t.key === tab) || tabs[0];
  $('#page-title').textContent = c.nama_kelas;

  $view.innerHTML =
    '<a href="#/kelas" class="text-sm inline-block mb-3">← Semua kelas</a>' +
    '<div class="card overflow-hidden mb-4"><div class="p-5 text-white" style="background:' + UI.classColor(c.id) + '">' +
    '<h2 class="text-2xl font-medium">' + UI.esc(c.nama_kelas) + '</h2><p class="text-sm opacity-90">' + UI.esc(c.deskripsi || '') + '</p>' +
    '<div class="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>Kode kelas:</span>' +
    '<button class="font-mono tracking-widest px-2 py-0.5 rounded bg-white/20 hover:bg-white/30" id="cp" title="Salin">' + UI.esc(c.kode_kelas) + '</button>' +
    '<span>' + c.siswa_count + ' siswa</span></div></div>' +
    '<nav class="tabbar bottom-nav" aria-label="Tab kelas">' + tabs.map(t =>
      '<a class="tab' + (t.key === cur.key ? ' active' : '') + '" href="#/kelas/' + c.id + '/' + t.key + '">' + icon(t.icon, 'w-5 h-5') + '<span>' + t.label + '</span></a>').join('') + '</nav></div>' +
    '<div id="tab-content"></div>';
  $('#cp').addEventListener('click', () => UI.copy(c.kode_kelas));
  renderSection(cur.kind, $('#tab-content'), c.id, true);
}

/* ============================================================
   HALAMAN LIST (Tugas / Pengumuman / Materi / Siswa) + filter kelas
   ============================================================ */
function pageList(kind) {
  if (!classById(S.filters[kind])) S.filters[kind] = '';
  $view.innerHTML =
    '<div class="flex flex-wrap items-center gap-3 mb-4"><label class="text-sm text-gray-600" for="flt">Kelas:</label>' +
    '<select id="flt" class="input" style="width:auto;min-width:12rem"><option value="">Semua kelas</option>' + classOptionsHtml(S.filters[kind]) + '</select></div><div id="sec"></div>';
  const draw = () => renderSection(kind, $('#sec'), S.filters[kind], false);
  $('#flt').addEventListener('change', e => { S.filters[kind] = e.target.value; draw(); });
  draw();
}

function renderSection(kind, el, classId, fixed) {
  ({ pengumuman: secPengumuman, tugas: secTugas, materi: secMateri, siswa: secSiswa })[kind](el, classId, fixed);
}

const kelasBadge = (item, fixed) => fixed ? '' : '<span class="badge badge-blue">' + UI.esc(item.nama_kelas) + '</span>';
const editDelBtns = id =>
  '<button class="btn-icon" data-act="edit" data-id="' + id + '" aria-label="Edit">' + icon('edit', 'w-4 h-4') + '</button>' +
  '<button class="btn-icon danger" data-act="del" data-id="' + id + '" aria-label="Hapus">' + icon('trash', 'w-4 h-4') + '</button>';

async function confirmDelete(message, action, id, okMsg) {
  if (await UI.confirm({ title: 'Konfirmasi hapus', message })) {
    try { await act(action, { id }, okMsg); } catch (e) { UI.toast(e.message, 'error'); }
  }
}

/* ---------------- Pengumuman (Stream) ---------------- */
function secPengumuman(el, classId, fixed) {
  const items = D().announcements.filter(a => !classId || a.class_id === classId);
  el.innerHTML =
    '<div class="flex items-center justify-between mb-3"><h2 class="font-medium">Pengumuman <span class="text-gray-400 font-normal">(' + items.length + ')</span></h2>' +
    '<button class="btn btn-primary" data-act="new">' + icon('plus', 'w-4 h-4') + ' Buat Pengumuman</button></div>' +
    (items.length ? '<div class="space-y-3">' + items.map(a =>
      '<article class="card p-4"><div class="flex gap-3">' + UI.avatar(a.guru_nama) +
      '<div class="flex-1 min-w-0"><div class="flex items-start justify-between gap-2"><div class="min-w-0">' +
      '<h3 class="font-medium">' + UI.esc(a.judul) + '</h3>' +
      '<p class="text-xs text-gray-500 flex flex-wrap items-center gap-2">' + UI.esc(a.guru_nama) + ' · ' + UI.fmtDateTime(a.created_at) + ' ' + kelasBadge(a, fixed) + '</p></div>' +
      '<div class="flex flex-none">' + editDelBtns(a.id) + '</div></div>' +
      '<p class="mt-2 text-sm pre-wrap">' + UI.esc(a.isi) + '</p></div></div></article>').join('') + '</div>'
      : UI.empty('Belum ada pengumuman', 'Pengumuman akan tampil di stream kelas siswa.'));

  bind(el, {
    new: () => announcementForm(null, classId),
    edit: id => announcementForm(items.find(x => x.id === id)),
    del: id => confirmDelete('Hapus pengumuman ini?', 'deleteAnnouncement', id, 'Pengumuman dihapus')
  });
}

function announcementForm(item, classId) {
  if (!item && !ensureClasses()) return;
  const fields = [];
  if (!item) fields.push({ name: 'class_id', label: 'Kelas', type: 'select', required: true, options: classOptions(), value: classId || D().classes[0].id });
  fields.push(
    { name: 'judul', label: 'Judul', required: true, value: item ? item.judul : '', maxlength: 150 },
    { name: 'isi', label: 'Isi pengumuman', type: 'textarea', rows: 5, required: true, value: item ? item.isi : '' }
  );
  UI.formModal({
    title: item ? 'Edit Pengumuman' : 'Buat Pengumuman', fields, submitText: item ? 'Simpan' : 'Terbitkan',
    onSubmit: v => item
      ? act('updateAnnouncement', { id: item.id, judul: v.judul, isi: v.isi }, 'Pengumuman diperbarui')
      : act('createAnnouncement', v, 'Pengumuman diterbitkan')
  });
}

/* ---------------- Tugas ---------------- */
function secTugas(el, classId, fixed) {
  const items = D().assignments.filter(a => !classId || a.class_id === classId);
  el.innerHTML =
    '<div class="flex items-center justify-between mb-3"><h2 class="font-medium">Tugas <span class="text-gray-400 font-normal">(' + items.length + ')</span></h2>' +
    '<button class="btn btn-primary" data-act="new">' + icon('plus', 'w-4 h-4') + ' Buat Tugas</button></div>' +
    (items.length ? '<div class="card">' + items.map(a => {
      const late = new Date(a.deadline) < new Date();
      const ungraded = a.submitted_count - a.graded_count;
      return '<div class="row-item card-hover" data-act="detail" data-id="' + a.id + '" style="cursor:pointer">' +
        '<span class="avatar" style="background:#e8f0fe;color:#1a73e8">' + icon('tasks', 'w-4 h-4') + '</span>' +
        '<div class="flex-1 min-w-0"><p class="font-medium truncate">' + UI.esc(a.judul) + '</p>' +
        '<p class="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">' + kelasBadge(a, fixed) +
        '<span class="' + (late ? 'text-red-600' : '') + '">Deadline ' + UI.fmtDateTime(a.deadline) + '</span>' +
        '<span>' + a.submitted_count + '/' + a.siswa_count + ' mengumpulkan</span>' +
        (ungraded > 0 ? '<span class="badge badge-yellow">' + ungraded + ' belum dinilai</span>' : '') + '</p></div>' +
        '<div class="flex flex-none">' + editDelBtns(a.id) + '</div></div>';
    }).join('') + '</div>' : UI.empty('Belum ada tugas', 'Buat tugas untuk dikerjakan siswa.'));

  bind(el, {
    new: () => assignmentForm(null, classId),
    edit: id => assignmentForm(items.find(x => x.id === id)),
    del: id => confirmDelete('Hapus tugas ini beserta semua pengumpulan & nilainya?', 'deleteAssignment', id, 'Tugas dihapus'),
    detail: id => openAssignmentDetail(id)
  });
}

function assignmentForm(item, classId) {
  if (!item && !ensureClasses()) return;
  const fields = [];
  if (!item) fields.push({ name: 'class_id', label: 'Kelas', type: 'select', required: true, options: classOptions(), value: classId || D().classes[0].id });
  fields.push(
    { name: 'judul', label: 'Judul tugas', required: true, value: item ? item.judul : '', maxlength: 150 },
    { name: 'deskripsi', label: 'Deskripsi / instruksi', type: 'textarea', rows: 5, value: item ? item.deskripsi : '' },
    { name: 'deadline', label: 'Deadline', type: 'datetime-local', required: true, value: item ? UI.toLocalInput(item.deadline) : '' },
    { name: 'file_url', label: 'Lampiran URL (opsional)', type: 'url', value: item ? item.file_url : '', placeholder: 'https://drive.google.com/...', hint: 'Link Google Drive / dokumen pendukung.' }
  );
  UI.formModal({
    title: item ? 'Edit Tugas' : 'Buat Tugas', fields, submitText: item ? 'Simpan' : 'Buat Tugas',
    onSubmit: v => {
      v.deadline = UI.fromLocalInput(v.deadline);
      return item ? act('updateAssignment', Object.assign({ id: item.id }, { judul: v.judul, deskripsi: v.deskripsi, deadline: v.deadline, file_url: v.file_url }), 'Tugas diperbarui')
                  : act('createAssignment', v, 'Tugas dibuat');
    }
  });
}

/** Detail tugas: daftar siswa sudah/belum mengumpulkan + tombol beri nilai. */
async function openAssignmentDetail(id) {
  const a = D().assignments.find(x => x.id === id);
  if (!a) return;
  const m = UI.modal({ title: a.judul, size: 'lg', body: UI.skeletonList(4) });

  async function load() {
    try {
      const res = await API.call('getAssignmentStatus', { assignment_id: id });
      const done = res.students.filter(s => s.submission).length;
      m.body.innerHTML =
        '<div class="mb-4 text-sm"><p class="text-gray-500 mb-1">' + UI.esc(a.nama_kelas) + ' · Deadline ' + UI.fmtDateTime(a.deadline) + '</p>' +
        (a.deskripsi ? '<p class="pre-wrap mb-2">' + UI.esc(a.deskripsi) + '</p>' : '') +
        (UI.url(a.file_url) ? '<a href="' + UI.esc(UI.url(a.file_url)) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1">' + icon('link', 'w-4 h-4') + ' Lampiran</a>' : '') + '</div>' +
        '<div class="flex gap-2 mb-3"><span class="badge badge-green">' + done + ' sudah mengumpulkan</span><span class="badge badge-gray">' + (res.students.length - done) + ' belum</span></div>' +
        (res.students.length ? '<div class="card table-wrap"><table class="tbl"><thead><tr><th>Siswa</th><th>Status</th><th>Dikumpulkan</th><th>Nilai</th><th></th></tr></thead><tbody>' +
          res.students.map(s => {
            const sub = s.submission;
            let badge = '<span class="badge badge-gray">Belum mengumpulkan</span>';
            if (sub) {
              const late = new Date(sub.submitted_at) > new Date(a.deadline);
              badge = sub.nilai !== null ? '<span class="badge badge-green">Dinilai</span>' : '<span class="badge badge-blue">Sudah mengumpulkan</span>';
              if (late) badge += ' <span class="badge badge-yellow">Terlambat</span>';
            }
            return '<tr><td><div class="flex items-center gap-2">' + UI.avatar(s.nama) + '<div><div>' + UI.esc(s.nama) + '</div><div class="text-xs text-gray-500">' + UI.esc(s.email) + '</div></div></div></td>' +
              '<td>' + badge + '</td><td>' + (sub ? UI.fmtDateTime(sub.submitted_at) : '-') + '</td><td>' + (sub && sub.nilai !== null ? '<b>' + sub.nilai + '</b>' : '-') + '</td>' +
              '<td>' + (sub ? '<button class="btn btn-outline btn-sm" data-act="grade" data-id="' + s.siswa_id + '">' + (sub.nilai === null ? 'Nilai' : 'Ubah') + '</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : UI.empty('Belum ada siswa', 'Belum ada siswa yang bergabung di kelas ini.'));

      bind(m.body, {
        grade: sid => {
          const st = res.students.find(x => x.siswa_id === sid);
          openGradeModal(Object.assign({}, st.submission, { siswa_nama: st.nama, assignment_judul: a.judul, deadline: a.deadline, nama_kelas: a.nama_kelas }), async () => { await refresh(); load(); });
        }
      });
    } catch (e) {
      m.body.innerHTML = UI.empty('Gagal memuat', e.message);
    }
  }
  load();
}

/** Modal penilaian satu pengumpulan. sub: submission + siswa_nama, assignment_judul, deadline, nama_kelas */
function openGradeModal(sub, onDone) {
  const late = isLate(sub);
  const m = UI.modal({
    title: 'Penilaian — ' + sub.siswa_nama, size: 'lg',
    body: '<div class="text-sm mb-3"><p><b>' + UI.esc(sub.assignment_judul) + '</b> · ' + UI.esc(sub.nama_kelas) + '</p>' +
      '<p class="text-gray-500">Dikumpulkan ' + UI.fmtDateTime(sub.submitted_at) + (late ? ' <span class="badge badge-yellow">Terlambat</span>' : '') + '</p></div>' +
      '<div class="rounded-lg bg-[#f8f9fa] border border-[#dadce0] p-3 mb-3 text-sm"><p class="label">Jawaban siswa</p>' +
      (sub.jawaban ? '<p class="pre-wrap">' + UI.esc(sub.jawaban) + '</p>' : '<p class="text-gray-400">(tidak ada jawaban teks)</p>') +
      (UI.url(sub.file_url) ? '<p class="mt-2"><a href="' + UI.esc(UI.url(sub.file_url)) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1">' + icon('external', 'w-4 h-4') + ' Buka file / link jawaban</a></p>' : '') + '</div>' +
      '<form class="space-y-3" novalidate><div><label class="label" for="g-nilai">Nilai (0–100)</label>' +
      '<input id="g-nilai" class="input" type="number" min="0" max="100" step="0.1" required value="' + (sub.nilai === null || sub.nilai === undefined ? '' : sub.nilai) + '" style="max-width:10rem"></div>' +
      '<div><label class="label" for="g-fb">Feedback</label><textarea id="g-fb" class="input" rows="3" maxlength="1000" placeholder="Komentar untuk siswa...">' + UI.esc(sub.feedback || '') + '</textarea></div>' +
      '<div class="flex justify-end gap-2"><button type="button" class="btn btn-ghost" data-close>Batal</button><button type="submit" class="btn btn-primary">Simpan Nilai</button></div></form>'
  });
  const form = m.el.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    if (!form.reportValidity()) return;
    UI.busy(btn, true);
    try {
      await API.call('gradeSubmission', { submission_id: sub.id, nilai: m.el.querySelector('#g-nilai').value, feedback: m.el.querySelector('#g-fb').value });
      UI.toast('Nilai tersimpan');
      m.close();
      if (onDone) await onDone(); else await refresh();
    } catch (err) {
      UI.toast(err.message, 'error');
      UI.busy(btn, false);
    }
  });
}

/* ---------------- Materi ---------------- */
function secMateri(el, classId, fixed) {
  const items = D().materials.filter(a => !classId || a.class_id === classId);
  el.innerHTML =
    '<div class="flex items-center justify-between mb-3"><h2 class="font-medium">Materi <span class="text-gray-400 font-normal">(' + items.length + ')</span></h2>' +
    '<button class="btn btn-primary" data-act="new">' + icon('plus', 'w-4 h-4') + ' Tambah Materi</button></div>' +
    (items.length ? '<div class="card">' + items.map(m => {
      const href = UI.url(m.url);
      return '<div class="row-item"><span class="avatar" style="background:#e8f0fe;color:#1a73e8">' + icon(m.tipe === 'file' ? 'file' : 'link', 'w-4 h-4') + '</span>' +
        '<div class="flex-1 min-w-0">' + (href ? '<a class="font-medium truncate block" href="' + UI.esc(href) + '" target="_blank" rel="noopener noreferrer">' + UI.esc(m.judul) + '</a>' : '<span class="font-medium">' + UI.esc(m.judul) + '</span>') +
        '<p class="text-xs text-gray-500 flex flex-wrap items-center gap-2"><span class="badge badge-gray">' + (m.tipe === 'file' ? 'File Drive' : 'Link') + '</span>' + kelasBadge(m, fixed) + '<span>' + UI.fmtDate(m.created_at) + '</span></p></div>' +
        '<div class="flex flex-none">' + editDelBtns(m.id) + '</div></div>';
    }).join('') + '</div>' : UI.empty('Belum ada materi', 'Bagikan link Google Drive, YouTube, atau halaman web ke siswa.'));

  bind(el, {
    new: () => materialForm(null, classId),
    edit: id => materialForm(items.find(x => x.id === id)),
    del: id => confirmDelete('Hapus materi ini?', 'deleteMaterial', id, 'Materi dihapus')
  });
}

function materialForm(item, classId) {
  if (!item && !ensureClasses()) return;
  const fields = [];
  if (!item) fields.push({ name: 'class_id', label: 'Kelas', type: 'select', required: true, options: classOptions(), value: classId || D().classes[0].id });
  fields.push(
    { name: 'judul', label: 'Judul materi', required: true, value: item ? item.judul : '', maxlength: 150 },
    { name: 'tipe', label: 'Tipe', type: 'select', value: item ? item.tipe : 'link', options: [{ value: 'link', label: 'Link / embed URL' }, { value: 'file', label: 'File (link Google Drive)' }] },
    { name: 'url', label: 'URL', type: 'url', required: true, value: item ? item.url : '', placeholder: 'https://...', hint: 'Pastikan akses berbagi di Drive diatur "Siapa saja yang memiliki link".' }
  );
  UI.formModal({
    title: item ? 'Edit Materi' : 'Tambah Materi', fields, submitText: item ? 'Simpan' : 'Tambah',
    onSubmit: v => item
      ? act('updateMaterial', { id: item.id, judul: v.judul, tipe: v.tipe, url: v.url }, 'Materi diperbarui')
      : act('createMaterial', v, 'Materi ditambahkan')
  });
}

/* ---------------- Siswa ---------------- */
function secSiswa(el, classId, fixed) {
  el.innerHTML =
    '<div class="flex flex-wrap items-center justify-between gap-3 mb-3"><h2 class="font-medium">Daftar Siswa</h2>' +
    '<input id="q" class="input" style="max-width:16rem" type="search" placeholder="Cari nama / email..." value="' + UI.esc(S.filters.q) + '"></div><div id="stu"></div>';
  const draw = () => {
    const q = S.filters.q.toLowerCase();
    const list = D().students.filter(s => (!classId || s.class_id === classId) && (!q || (s.nama + ' ' + s.email).toLowerCase().includes(q)));
    $('#stu', el).innerHTML = list.length
      ? '<div class="card table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Email</th>' + (fixed ? '' : '<th>Kelas</th>') + '<th>Bergabung</th><th class="text-right">Aksi</th></tr></thead><tbody>' +
        list.map(s => '<tr><td><div class="flex items-center gap-2">' + UI.avatar(s.nama) + UI.esc(s.nama) + '</div></td><td>' + UI.esc(s.email) + '</td>' +
          (fixed ? '' : '<td><span class="badge badge-blue">' + UI.esc(s.nama_kelas) + '</span></td>') + '<td>' + UI.fmtDate(s.joined_at) + '</td>' +
          '<td><div class="flex justify-end gap-1"><button class="btn btn-outline btn-sm" data-act="reset" data-id="' + s.siswa_id + '">' + icon('key', 'w-4 h-4') + ' Reset Password</button>' +
          '<button class="btn-icon danger" data-act="remove" data-id="' + s.siswa_id + '" data-cls="' + s.class_id + '" title="Hapus dari kelas" aria-label="Hapus dari kelas">' + icon('userx', 'w-4 h-4') + '</button></div></td></tr>').join('') +
        '</tbody></table></div>'
      : UI.empty('Belum ada siswa', q ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Bagikan kode kelas agar siswa dapat bergabung.');
  };
  draw();
  $('#q', el).addEventListener('input', e => { S.filters.q = e.target.value; draw(); });

  bind(el, {
    reset: id => {
      const s = D().students.find(x => x.siswa_id === id);
      UI.formModal({
        title: 'Reset Password', submitText: 'Reset Password',
        intro: 'Atur password baru untuk ' + s.nama + ' (' + s.email + '). Kosongkan untuk membuat password acak otomatis.',
        fields: [{ name: 'new_password', label: 'Password baru (opsional)', value: '', hint: 'Minimal 6 karakter.' }],
        onSubmit: async v => {
          const r = await API.call('resetPassword', { siswa_id: id, new_password: v.new_password });
          const res = UI.modal({
            title: 'Password berhasil direset', size: 'sm',
            body: '<p class="text-sm mb-2">Password baru untuk <b>' + UI.esc(r.nama) + '</b>:</p>' +
              '<div class="flex items-center gap-2"><code class="flex-1 text-lg tracking-wider bg-[#f1f3f4] rounded px-3 py-2">' + UI.esc(r.password) + '</code>' +
              '<button class="btn btn-outline" id="cpw">' + icon('copy', 'w-4 h-4') + ' Salin</button></div>' +
              '<p class="hint mt-2">Sampaikan ke siswa. Password ini tidak akan ditampilkan lagi.</p>' +
              '<div class="flex justify-end mt-4"><button class="btn btn-primary" data-close>Selesai</button></div>'
          });
          res.el.querySelector('#cpw').addEventListener('click', () => UI.copy(r.password));
        }
      });
    },
    remove: async (id, b) => {
      const s = D().students.find(x => x.siswa_id === id && x.class_id === b.dataset.cls);
      if (await UI.confirm({ title: 'Hapus siswa dari kelas', message: 'Keluarkan ' + s.nama + ' dari kelas "' + s.nama_kelas + '"?\nPengumpulan tugas & nilainya di kelas ini juga akan dihapus.', confirmText: 'Keluarkan' })) {
        try { await act('removeStudent', { class_id: b.dataset.cls, siswa_id: id }, 'Siswa dikeluarkan dari kelas'); } catch (e) { UI.toast(e.message, 'error'); }
      }
    }
  });
}

/* ============================================================
   PENILAIAN
   ============================================================ */
function pagePenilaian() {
  const F = S.filters;
  if (!classById(F.nilaiKelas)) F.nilaiKelas = '';
  const tugasOpts = D().assignments.filter(a => !F.nilaiKelas || a.class_id === F.nilaiKelas);
  if (!tugasOpts.some(a => a.id === F.nilaiTugas)) F.nilaiTugas = '';

  const list = D().submissions.filter(s =>
    (F.nilaiAll || s.nilai === null) && (!F.nilaiKelas || s.class_id === F.nilaiKelas) && (!F.nilaiTugas || s.assignment_id === F.nilaiTugas));

  $view.innerHTML =
    '<div class="card p-4 mb-4 flex flex-wrap items-end gap-3">' +
    '<div><label class="label" for="f-k">Kelas</label><select id="f-k" class="input" style="min-width:11rem"><option value="">Semua kelas</option>' + classOptionsHtml(F.nilaiKelas) + '</select></div>' +
    '<div><label class="label" for="f-t">Tugas</label><select id="f-t" class="input" style="min-width:13rem"><option value="">Semua tugas</option>' +
    tugasOpts.map(a => '<option value="' + a.id + '"' + (a.id === F.nilaiTugas ? ' selected' : '') + '>' + UI.esc(a.judul) + '</option>').join('') + '</select></div>' +
    '<label class="flex items-center gap-2 text-sm pb-2"><input type="checkbox" id="f-all"' + (F.nilaiAll ? ' checked' : '') + '> Tampilkan yang sudah dinilai</label>' +
    '<span class="ml-auto text-sm text-gray-500 pb-2">' + list.length + ' pengumpulan</span></div>' +
    '<div class="card" id="grade-list">' + (list.length ? list.map(s =>
      '<div class="grade-row" data-sid="' + s.id + '">' +
      '<div class="flex gap-3 min-w-0">' + UI.avatar(s.siswa_nama) + '<div class="min-w-0"><p class="font-medium truncate">' + UI.esc(s.siswa_nama) + '</p>' +
      '<p class="text-sm truncate">' + UI.esc(s.assignment_judul) + '</p><p class="text-xs text-gray-500">' + UI.esc(s.nama_kelas) + ' · ' + UI.fmtDateTime(s.submitted_at) + '</p>' +
      (isLate(s) ? '<span class="badge badge-yellow mt-1">Terlambat</span>' : '') + '</div></div>' +
      '<div class="text-sm min-w-0">' + (s.jawaban ? '<p class="pre-wrap" style="max-height:7rem;overflow:auto">' + UI.esc(s.jawaban) + '</p>' : '<p class="text-gray-400">(tanpa jawaban teks)</p>') +
      (UI.url(s.file_url) ? '<a class="inline-flex items-center gap-1 mt-1" href="' + UI.esc(UI.url(s.file_url)) + '" target="_blank" rel="noopener noreferrer">' + icon('external', 'w-4 h-4') + ' Buka file / link</a>' : '') + '</div>' +
      '<div class="space-y-2"><input type="number" class="input g-nilai" min="0" max="100" step="0.1" placeholder="Nilai 0–100" aria-label="Nilai" value="' + (s.nilai === null ? '' : s.nilai) + '">' +
      '<textarea class="input g-fb" rows="2" maxlength="1000" placeholder="Feedback..." aria-label="Feedback">' + UI.esc(s.feedback || '') + '</textarea>' +
      '<button class="btn btn-primary btn-sm w-full" data-act="save" data-id="' + s.id + '">Simpan</button></div></div>').join('')
      : UI.empty(F.nilaiAll ? 'Tidak ada pengumpulan' : 'Semua tugas sudah dinilai 🎉', 'Pengumpulan baru dari siswa akan muncul di sini.')) + '</div>';

  $('#f-k').addEventListener('change', e => { F.nilaiKelas = e.target.value; pagePenilaian(); });
  $('#f-t').addEventListener('change', e => { F.nilaiTugas = e.target.value; pagePenilaian(); });
  $('#f-all').addEventListener('change', e => { F.nilaiAll = e.target.checked; pagePenilaian(); });
  bind($('#grade-list'), {
    save: async (id, btn) => {
      const row = btn.closest('.grade-row');
      const nilai = row.querySelector('.g-nilai').value;
      if (nilai === '' || Number(nilai) < 0 || Number(nilai) > 100) { UI.toast('Nilai harus 0–100', 'error'); return; }
      UI.busy(btn, true);
      try { await act('gradeSubmission', { submission_id: id, nilai, feedback: row.querySelector('.g-fb').value }, 'Nilai tersimpan'); }
      catch (e) { UI.toast(e.message, 'error'); UI.busy(btn, false); }
    }
  });
}

if (ME) boot();
