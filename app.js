// ============================================================
//  PEKERJA LEPAS — app.js  (v2: edit, hapus, laporan filter, responsif)
// ============================================================

// ==================== SESSION ====================
const plSession = JSON.parse(sessionStorage.getItem('pl_session') || 'null');
if (!plSession) { window.location.href = 'login.html'; }
else if (plSession.role === 'admin') { window.location.href = 'admin.html'; }

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('user-display-name');
  if (el && plSession) el.textContent = plSession.nama;
  // Isi nama desainer di ttd otomatis
  const ttdNama = document.getElementById('ttd-nama-desainer');
  if (ttdNama && plSession) ttdNama.textContent = plSession.nama;
});

function doLogout() { sessionStorage.removeItem('pl_session'); window.location.href = 'login.html'; }

// ==================== KONSTANTA ====================
const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ==================== STATE ====================
let jobs          = [];
let filterMonth   = 'all';
let laporanFilter = 'all'; // filter bulan di halaman laporan
let editJobId     = null;  // null = mode tambah, string = mode edit
let hapusTargetId = null;

// Stopwatch
let swInterval = null, swSec = 0, swRunning = false;

// ==================== UTILS ====================
const fmtSec = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60; return [h,m,sc].map(v=>String(v).padStart(2,'0')).join(':'); };
const fmtTgl = t => { const d=new Date(t); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const todayStr = () => new Date().toISOString().slice(0,10);
const parseDurasi = str => {
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parseInt(str) || 0;
};

// ==================== LOAD DATA ====================
async function loadJobs() {
  try {
    const res = await API.getJobs(plSession.id);
    if (res.success) { jobs = res.data; renderDash(); renderPekList(); }
    else showToast('Gagal memuat data: ' + res.error, 'error');
  } catch(err) { showToast('Gagal terhubung ke server', 'error'); }
}

// ==================== NAVIGASI ====================
function showPage(p) {
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b,i)=>b.classList.toggle('active',['dashboard','pekerjaan','laporan'][i]===p));
  document.getElementById(p).classList.add('active');
  if (p==='dashboard') renderDash();
  if (p==='pekerjaan') { cancelEdit(); renderPekList(); }
  if (p==='laporan')   renderLaporan();
}

// ==================== STOPWATCH ====================
function swToggle() {
  const btn = document.getElementById('btn-mulai');
  if (!swRunning) {
    swRunning = true;
    btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="4" height="12" rx="1.5" fill="currentColor"/><rect x="9" y="2" width="4" height="12" rx="1.5" fill="currentColor"/></svg> Jeda`;
    btn.className = 'sw-btn btn-stop';
    swInterval = setInterval(()=>{ swSec++; document.getElementById('sw-display').textContent = fmtSec(swSec); }, 1000);
  } else {
    clearInterval(swInterval); swRunning = false;
    btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg> Lanjut`;
    btn.className = 'sw-btn btn-mulai';
  }
}
function swStop() {
  clearInterval(swInterval); swRunning = false;
  const btn = document.getElementById('btn-mulai');
  btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg> Mulai`;
  btn.className = 'sw-btn btn-mulai';
}
function swReset() { swStop(); swSec = 0; document.getElementById('sw-display').textContent = '00:00:00'; }

// ==================== INIT FORM ====================
function initForm() {
  const now = new Date();
  const tglInput = document.getElementById('inp-tgl');
  tglInput.value = now.toISOString().slice(0,10);
  document.getElementById('inp-tahun').value = now.getFullYear();
  document.getElementById('inp-hari').value  = HARI[now.getDay()];
  tglInput.addEventListener('change', function() {
    const d = new Date(this.value);
    document.getElementById('inp-hari').value  = HARI[d.getDay()];
    document.getElementById('inp-tahun').value = d.getFullYear();
  });
}

// ==================== SIMPAN / UPDATE PEKERJAAN ====================
async function savePekerjaan() {
  const nama = document.getElementById('inp-nama').value.trim();
  const tgl  = document.getElementById('inp-tgl').value;
  const hari = document.getElementById('inp-hari').value;
  if (!nama) { showToast('Nama pekerjaan wajib diisi', 'error'); return; }

  let durasi;
  if (editJobId) {
    // Mode edit: ambil dari input manual
    const dStr = document.getElementById('inp-durasi-edit').value.trim();
    durasi = parseDurasi(dStr);
    if (!durasi) { showToast('Format durasi tidak valid (gunakan HH:MM:SS)', 'error'); return; }
  } else {
    // Mode tambah: ambil dari stopwatch
    if (!swSec) { showToast('Jalankan stopwatch terlebih dahulu', 'error'); return; }
    durasi = swSec;
  }

  const job = { nama, tgl, hari, tahun: new Date(tgl).getFullYear(), durasi, status: 'selesai' };
  const btn = document.getElementById('btn-simpan');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    let res;
    if (editJobId) {
      // Hapus lama lalu simpan baru (Apps Script tidak ada update row by ID yang simple)
      await API.deleteJob(plSession.id, editJobId);
      res = await API.saveJob(plSession.id, job);
    } else {
      res = await API.saveJob(plSession.id, job);
    }

    if (!res.success) { showToast('Gagal: ' + res.error, 'error'); return; }

    showToast(editJobId ? 'Pekerjaan berhasil diperbarui!' : 'Pekerjaan berhasil disimpan!');
    cancelEdit();
    document.getElementById('inp-nama').value = '';
    swReset();
    await loadJobs();
  } catch(err) { showToast('Error: ' + err.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" style="width:14px;height:14px"><path d="M13 5l-6 6-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Simpan Pekerjaan`; }
}

// ==================== MODE EDIT ====================
function openEdit(id) {
  const j = jobs.find(j => String(j.id) === String(id));
  if (!j) return;
  editJobId = id;

  // Isi form
  document.getElementById('inp-nama').value  = j.nama;
  document.getElementById('inp-tgl').value   = j.tgl;
  document.getElementById('inp-hari').value  = j.hari;
  document.getElementById('inp-tahun').value = j.tahun;

  // Tampilkan input durasi manual, sembunyikan stopwatch
  document.getElementById('sw-block').style.display = 'none';
  document.getElementById('edit-durasi-wrap').style.display = 'block';
  document.getElementById('inp-durasi-edit').value = fmtSec(j.durasi);
  document.getElementById('btn-batal-edit').style.display = 'inline-flex';
  document.getElementById('form-title-label').textContent = 'Edit Pekerjaan';

  showPage('pekerjaan');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editJobId = null;
  document.getElementById('sw-block').style.display = 'block';
  document.getElementById('edit-durasi-wrap').style.display = 'none';
  document.getElementById('btn-batal-edit').style.display = 'none';
  document.getElementById('form-title-label').textContent = 'Input Pekerjaan Baru';
}

// ==================== HAPUS PEKERJAAN ====================
function openHapus(id) {
  const j = jobs.find(j => String(j.id) === String(id));
  hapusTargetId = id;
  document.getElementById('hapus-target-nama').textContent = j ? j.nama : '';
  document.getElementById('modal-hapus').classList.add('show');
}

async function confirmHapus() {
  try {
    const res = await API.deleteJob(plSession.id, hapusTargetId);
    if (!res.success) { showToast('Gagal: ' + res.error, 'error'); return; }
    closeModal('modal-hapus');
    showToast('Pekerjaan berhasil dihapus');
    await loadJobs();
  } catch(err) { showToast('Error: ' + err.message, 'error'); }
}

// ==================== RENDER ROW ====================
function actionBtns(id) {
  return `
    <div style="display:flex;gap:5px">
      <button class="btn-icon" onclick="openEdit('${id}')" title="Edit">
        <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
      </button>
      <button class="btn-icon danger" onclick="openHapus('${id}')" title="Hapus">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </button>
    </div>`;
}

function renderRow(j) {
  return `<tr>
    <td title="${j.nama}">${j.nama}</td>
    <td>${fmtTgl(j.tgl)}</td>
    <td><span style="font-family:var(--mono);font-size:13px">${fmtSec(j.durasi)}</span></td>
    <td><span class="badge badge-done">${j.status}</span></td>
    <td>${actionBtns(j.id)}</td>
  </tr>`;
}

// ==================== DASHBOARD ====================
function renderDash() {
  const fl       = filterMonth==='all' ? jobs : jobs.filter(j=>new Date(j.tgl).getMonth()===parseInt(filterMonth));
  const totalSec = fl.reduce((a,b)=>a+b.durasi,0);
  const today    = todayStr();

  document.getElementById('stat-grid').innerHTML = `
    <div class="stat"><div class="stat-label">Total Pekerjaan</div><div class="stat-val">${fl.length}</div></div>
    <div class="stat"><div class="stat-label">Total Durasi</div><div class="stat-val" style="font-size:18px">${fmtSec(totalSec)}</div></div>
    <div class="stat"><div class="stat-label">Hari Ini</div><div class="stat-val">${jobs.filter(j=>j.tgl===today).length}</div></div>
  `;

  const months = [...new Set(jobs.map(j=>new Date(j.tgl).getMonth()))].sort((a,b)=>a-b);
  let fr = `<button class="fbtn ${filterMonth==='all'?'active':''}" onclick="setFilter('all')">Semua</button>`;
  months.forEach(m => { fr += `<button class="fbtn ${filterMonth==m?'active':''}" onclick="setFilter(${m})">${BULAN[m]}</button>`; });
  document.getElementById('filter-row').innerHTML = fr;

  document.getElementById('dash-tbody').innerHTML = fl.length
    ? fl.map(renderRow).join('')
    : `<tr><td colspan="5" class="empty">Belum ada data pekerjaan</td></tr>`;
}

function setFilter(m) { filterMonth = m; renderDash(); }

// ==================== DAFTAR PEKERJAAN ====================
function renderPekList() {
  document.getElementById('pek-tbody').innerHTML = jobs.length
    ? jobs.map(renderRow).join('')
    : `<tr><td colspan="5" class="empty">Belum ada data pekerjaan</td></tr>`;
}

// ==================== LAPORAN ====================
function renderLaporan() {
  const now    = new Date();
  const tglStr = `${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;

  // Filter bulan laporan
  const months = [...new Set(jobs.map(j=>new Date(j.tgl).getMonth()))].sort((a,b)=>a-b);
  let fr = `<button class="fbtn ${laporanFilter==='all'?'active':''}" onclick="setLaporanFilter('all')">Semua</button>`;
  months.forEach(m => { fr += `<button class="fbtn ${laporanFilter==m?'active':''}" onclick="setLaporanFilter(${m})">${BULAN[m]}</button>`; });
  document.getElementById('laporan-filter').innerHTML = fr;

  const fl = laporanFilter==='all' ? jobs : jobs.filter(j=>new Date(j.tgl).getMonth()===parseInt(laporanFilter));

  // Update periode label
  let periodeLabel = 'Semua Periode';
  if (laporanFilter !== 'all') periodeLabel = `${BULAN[parseInt(laporanFilter)]} ${now.getFullYear()}`;
  document.getElementById('report-period').textContent = 'Periode: ' + periodeLabel;
  document.getElementById('report-no').textContent =
    'LAP/' + now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + String(fl.length||1).padStart(3,'0');

  ['ttd-tgl-1','ttd-tgl-2'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=tglStr; });

  const totalSec = fl.reduce((a,b)=>a+b.durasi,0);
  const today    = todayStr();
  document.getElementById('rstat-grid').innerHTML = `
    <div class="rstat"><div class="rstat-label">Total Pekerjaan</div><div class="rstat-val">${fl.length}</div></div>
    <div class="rstat"><div class="rstat-label">Total Durasi</div><div class="rstat-val" style="font-size:14px">${fmtSec(totalSec)}</div></div>
    <div class="rstat"><div class="rstat-label">Hari Ini</div><div class="rstat-val">${jobs.filter(j=>j.tgl===today).length}</div></div>
  `;

  document.getElementById('print-tbody').innerHTML = fl.length
    ? fl.map((j,i)=>`<tr>
        <td>${i+1}</td>
        <td title="${j.nama}">${j.nama}</td>
        <td>${fmtTgl(j.tgl)}</td>
        <td>${fmtSec(j.durasi)}</td>
        <td><span class="badge badge-done">${j.status}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="empty">Belum ada data</td></tr>`;
}

function setLaporanFilter(m) { laporanFilter = m; renderLaporan(); }

// ==================== GANTI LOGO ====================
document.getElementById('logo-input').addEventListener('change', function() {
  const file = this.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('logo-display').innerHTML = `<img src="${e.target.result}" alt="logo">`; };
  reader.readAsDataURL(file);
});

// ==================== PRINT PDF ====================
function doPrint() {
  const content = document.getElementById('report-wrap').innerHTML;
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html lang="id"><head>
<meta charset="UTF-8"><title>Laporan Pekerja Lepas</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1C2D40;padding:20px}
.report-wrap{border:1px solid #D8E4F2;border-radius:12px;overflow:hidden}
.kop{background:linear-gradient(135deg,#0C447C 0%,#1a6fca 60%,#2a8ef0 100%);padding:20px 24px;display:flex;align-items:center;gap:16px}
.kop-logo-box{width:64px;height:64px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.kop-logo-box img{width:100%;height:100%;object-fit:contain}
.logo-placeholder{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px}
.logo-placeholder svg{width:24px;height:24px}
.logo-placeholder span{font-size:9px;color:#185FA5;text-align:center}
.kop-name{font-size:18px;font-weight:700;color:#fff;margin-bottom:3px}
.kop-sub{font-size:11px;color:rgba(255,255,255,0.7)}
.kop-stripe{height:3px;background:linear-gradient(90deg,#B5D4F4,#E6F1FB,#B5D4F4)}
.report-body{padding:20px 24px}
.report-meta{display:flex;justify-content:space-between;margin-bottom:16px;gap:12px}
.report-title{font-size:16px;font-weight:700;color:#0C447C;margin-bottom:3px}
.report-period{font-size:12px;color:#8BA5C4}
.report-no-wrap{text-align:right;flex-shrink:0}
.report-no-label{font-size:10px;color:#8BA5C4;text-transform:uppercase;margin-bottom:2px}
.report-no-val{font-size:13px;font-weight:600;color:#0C447C;font-family:'JetBrains Mono',monospace}
.rstat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.rstat{background:#E6F1FB;border:1px solid #B5D4F4;border-radius:7px;padding:10px 12px}
.rstat-label{font-size:10px;color:#185FA5;font-weight:600;text-transform:uppercase;margin-bottom:3px}
.rstat-val{font-size:16px;font-weight:700;color:#0C447C;font-family:'JetBrains Mono',monospace}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:20px}
th{text-align:left;padding:8px 10px;background:#E6F1FB;color:#185FA5;border-bottom:1px solid #B5D4F4;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px}
td{padding:8px 10px;border-bottom:1px solid #EEF2F8;color:#1C2D40}
tr:last-child td{border-bottom:none}
.badge{display:inline-block;font-size:10.5px;padding:2px 8px;border-radius:99px;background:#E6F1FB;color:#0C447C;font-weight:600}
.ttd-section{display:grid;grid-template-columns:1fr 1fr;gap:2rem;padding-top:16px;border-top:1px solid #D8E4F2}
.ttd-box{text-align:center}
.ttd-label{font-size:11px;color:#8BA5C4;margin-bottom:4px}
.ttd-city{font-size:12px;color:#4A6280;margin-bottom:10px}
.ttd-space{height:60px;border-bottom:1px solid #D8E4F2;margin-bottom:8px}
.ttd-name{font-size:13px;font-weight:700;color:#1C2D40}
.ttd-role{font-size:11px;color:#8BA5C4;margin-top:2px}
@media print{body{padding:0}.report-wrap{border:none;border-radius:0}}
</style>
</head><body><div class="report-wrap">${content}</div></body></html>`);
  w.document.close();
  setTimeout(()=>{ w.print(); }, 500);
}

// ==================== MODAL & TOAST ====================
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(o=>{
  o.addEventListener('click', function(e){ if(e.target===this) this.classList.remove('show'); });
});

function showToast(msg, type='success') {
  const existing = document.getElementById('pl-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'pl-toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
    background: type==='error' ? '#A32D2D' : '#085041',
    color:'#fff', padding:'12px 24px', borderRadius:'10px',
    fontSize:'14px', fontWeight:'600', zIndex:'9999',
    boxShadow:'0 4px 20px rgba(0,0,0,0.2)', fontFamily:'var(--font-body)',
    animation:'fadeInUp 0.2s ease'
  });
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 3000);
}

// Tambah animasi toast
const ts = document.createElement('style');
ts.textContent = `@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
document.head.appendChild(ts);

// ==================== INIT ====================
initForm();
loadJobs();
