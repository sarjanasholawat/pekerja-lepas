// ============================================================
//  PEKERJA LEPAS — app.js v3
//  Fitur: kategori proyek, mode stopwatch/WIB, tahun dropdown,
//         kop surat dari admin (read-only user), edit & hapus
// ============================================================

// ==================== SESSION ====================
const plSession = JSON.parse(sessionStorage.getItem('pl_session') || 'null');
if (!plSession) { window.location.href = 'login.html'; }
else if (plSession.role === 'admin') { window.location.href = 'admin.html'; }

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar & topbar user info
  function initials(n){return n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}
  if(plSession){
    const av=initials(plSession.nama);
    ['sb-avatar','topbar-avatar'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=av;});
    ['sb-user-name','topbar-name','user-display-name'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=plSession.nama;});
  }
  const el = document.getElementById('user-display-name');
  if (el && plSession) el.textContent = plSession.nama;
});
function doLogout() { sessionStorage.removeItem('pl_session'); window.location.href = 'login.html'; }

// ==================== KONSTANTA ====================
const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const KOP_KEY = 'pl_kop_surat';

// ==================== STATE ====================
let jobs = [], filterMonth = 'all', laporanFilter = 'all', laporanFilterKat = 'all';
let editJobId = null, hapusTargetId = null;
let timerMode = 'stopwatch'; // 'stopwatch' | 'wib'

// Stopwatch
let swInterval = null, swSec = 0, swRunning = false;
// WIB live clock
let wibClockInterval = null, wibCalcInterval = null;

// ==================== UTILS ====================
const fmtSec = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60; return [h,m,sc].map(v=>String(v).padStart(2,'0')).join(':'); };
const fmtTgl = t => { const d=new Date(t); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const todayStr = () => new Date().toISOString().slice(0,10);
const parseDurasi = str => { const p=str.split(':').map(Number); return p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:parseInt(str)||0; };

// ==================== INIT FORM ====================
function initForm() {
  const now = new Date();
  // Tanggal hari ini
  const tglInput = document.getElementById('inp-tgl');
  tglInput.value = now.toISOString().slice(0,10);
  document.getElementById('inp-hari').value = HARI[now.getDay()];
  tglInput.addEventListener('change', function() {
    const d = new Date(this.value);
    document.getElementById('inp-hari').value = HARI[d.getDay()];
  });
  // WIB jam input → hitung durasi otomatis
  ['wib-mulai','wib-selesai'].forEach(id => {
    document.getElementById(id).addEventListener('change', hitungDurasiWIB);
  });
  // Populate proyek dropdown dari projects.js
  populateProyekDropdown();
}

// Isi dropdown proyek di form pekerjaan dari data projects
function populateProyekDropdown() {
  const sel = document.getElementById('inp-kategori');
  if (!sel) return;
  const prjs = JSON.parse(localStorage.getItem('pl_projects') || '[]');
  const cur  = sel.value;
  sel.innerHTML = '<option value="">— Pilih Proyek —</option>';
  prjs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nama; opt.textContent = p.nama;
    sel.appendChild(opt);
  });
  // Tambah opsi tanpa proyek
  const noProj = document.createElement('option');
  noProj.value = 'Umum'; noProj.textContent = '📁 Umum / Tanpa Proyek';
  sel.appendChild(noProj);
  if ([...sel.options].find(o=>o.value===cur)) sel.value = cur;
}

// ==================== MODE TIMER ====================
function setMode(mode) {
  timerMode = mode;
  document.getElementById('mode-sw').classList.toggle('active', mode==='stopwatch');
  document.getElementById('mode-wib').classList.toggle('active', mode==='wib');
  document.getElementById('sw-block').style.display  = mode==='stopwatch' ? 'block' : 'none';
  document.getElementById('wib-block').style.display = mode==='wib'       ? 'block' : 'none';

  if (mode === 'wib') {
    startWIBClock();
    // Reset state tombol
    document.getElementById('wib-btn-mulai').disabled  = false;
    document.getElementById('wib-btn-selesai').disabled = false;
  } else {
    stopWIBClock();
  }
}

// ── Ambil jam WIB sekarang ──
function getWIBNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset()*60000;
  return new Date(utc + 7*3600000);
}

function wibStr(wib) {
  return String(wib.getHours()).padStart(2,'0') + ':' + String(wib.getMinutes()).padStart(2,'0');
}

function startWIBClock() {
  stopWIBClock();
  function tick() {
    const wib = getWIBNow();
    document.getElementById('jam-wib-live').textContent =
      fmtSec(wib.getHours()*3600 + wib.getMinutes()*60 + wib.getSeconds());
    hitungDurasiWIB();
  }
  tick();
  wibClockInterval = setInterval(tick, 1000);
}

function stopWIBClock() {
  if (wibClockInterval) { clearInterval(wibClockInterval); wibClockInterval = null; }
}

// Tombol Mulai WIB — catat jam mulai
function wibCatatMulai() {
  const wib = getWIBNow();
  const jam  = wibStr(wib);
  document.getElementById('wib-mulai').value         = jam;
  document.getElementById('wib-mulai-display').textContent = jam;
  // Reset selesai
  document.getElementById('wib-selesai').value           = '';
  document.getElementById('wib-selesai-display').textContent = '—';
  document.getElementById('wib-durasi-display').textContent  = '00:00:00';
  // Disable tombol mulai, enable selesai
  document.getElementById('wib-btn-mulai').disabled  = true;
  document.getElementById('wib-btn-selesai').disabled = false;
  showToast('Jam mulai tercatat: ' + jam);
}

// Tombol Selesai WIB — catat jam selesai
function wibCatatSelesai() {
  const mulai = document.getElementById('wib-mulai').value;
  if (!mulai) { showToast('Klik Mulai terlebih dahulu','error'); return; }
  const wib  = getWIBNow();
  const jam  = wibStr(wib);
  document.getElementById('wib-selesai').value              = jam;
  document.getElementById('wib-selesai-display').textContent = jam;
  hitungDurasiWIB();
  document.getElementById('wib-btn-selesai').disabled = true;
  showToast('Jam selesai tercatat: ' + jam);
}

function wibReset() {
  ['wib-mulai','wib-selesai'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('wib-mulai-display').textContent   = '—';
  document.getElementById('wib-selesai-display').textContent  = '—';
  document.getElementById('wib-durasi-display').textContent   = '00:00:00';
  document.getElementById('wib-btn-mulai').disabled  = false;
  document.getElementById('wib-btn-selesai').disabled = false;
}

function hitungDurasiWIB() {
  const mulai   = document.getElementById('wib-mulai').value;
  const selesai = document.getElementById('wib-selesai').value;
  if (!mulai) return;
  const [mh,mm] = mulai.split(':').map(Number);
  let totalSec;
  if (selesai) {
    const [sh,sm] = selesai.split(':').map(Number);
    let diff = (sh*60+sm)-(mh*60+mm);
    if (diff < 0) diff += 24*60;
    totalSec = diff * 60;
  } else {
    // Hitung live sampai sekarang
    const wib = getWIBNow();
    let diff = (wib.getHours()*60+wib.getMinutes())-(mh*60+mm);
    if (diff < 0) diff = 0;
    totalSec = diff * 60 + wib.getSeconds();
  }
  document.getElementById('wib-durasi-display').textContent = fmtSec(Math.max(0, totalSec));
}

function getDurasi() {
  if (editJobId) return parseDurasi(document.getElementById('inp-durasi-edit').value.trim());
  if (timerMode === 'stopwatch') return swSec;
  // WIB: hitung dari jam mulai & selesai
  const mulai   = document.getElementById('wib-mulai').value;
  const selesai = document.getElementById('wib-selesai').value;
  if (!mulai) return 0;
  const [mh,mm] = mulai.split(':').map(Number);
  if (selesai) {
    const [sh,sm] = selesai.split(':').map(Number);
    let diff = (sh*60+sm)-(mh*60+mm);
    if (diff < 0) diff += 24*60;
    return diff * 60;
  }
  return parseDurasi(document.getElementById('wib-durasi-display').textContent);
}

// ==================== STOPWATCH ====================
function swToggle() {
  const btn = document.getElementById('btn-mulai');
  if (!swRunning) {
    swRunning = true;
    btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="4" height="12" rx="1.5" fill="currentColor"/><rect x="9" y="2" width="4" height="12" rx="1.5" fill="currentColor"/></svg> Jeda`;
    btn.className = 'sw-btn btn-stop';
    swInterval = setInterval(()=>{ swSec++; document.getElementById('sw-display').textContent=fmtSec(swSec); },1000);
  } else {
    clearInterval(swInterval); swRunning=false;
    btn.innerHTML=`<svg viewBox="0 0 16 16" fill="none"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg> Lanjut`;
    btn.className='sw-btn btn-mulai';
  }
}
function swStop() {
  clearInterval(swInterval); swRunning=false;
  const btn=document.getElementById('btn-mulai');
  btn.innerHTML=`<svg viewBox="0 0 16 16" fill="none"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg> Mulai`;
  btn.className='sw-btn btn-mulai';
}
function swReset() { swStop(); swSec=0; document.getElementById('sw-display').textContent='00:00:00'; }

// ==================== PROYEK / KATEGORI ====================
function onKategoriChange(val) {} // tidak dipakai, dibiarkan agar tidak error
function konfirmasiKategori() {}
function getKategori() {
  const sel = document.getElementById('inp-kategori');
  return sel ? (sel.value || '—') : '—';
}

// ==================== LOAD DATA ====================
async function loadJobs() {
  try {
    const res = await API.getJobs(plSession.id);
    if (res.success) { jobs=res.data; renderDash(); renderPekList(); updateKategoriFilter(); }
    else showToast('Gagal memuat data','error');
  } catch(err) { showToast('Gagal terhubung ke server','error'); }
}

function updateKategoriFilter() {
  const kats = [...new Set(jobs.map(j=>j.kategori).filter(Boolean))];
  const sel = document.getElementById('laporan-filter-kategori');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">Semua Kategori</option>';
  kats.forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; sel.appendChild(o); });
  if ([...sel.options].find(o=>o.value===cur)) sel.value=cur;
}

// ==================== NAVIGASI ====================
function showPage(p) {
  // Update sidebar active state
  document.querySelectorAll('.sb-nav-item').forEach(b=>b.classList.remove('active'));
  const nb=document.getElementById('nav-'+p);
  if(nb) nb.classList.add('active');
  // Update topbar title
  const titles={dashboard:'Dashboard',pekerjaan:'Pekerjaan',laporan:'Laporan PDF'};
  if(window._setTopbarTitle) window._setTopbarTitle(titles[p]||p);
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b,i)=>b.classList.toggle('active',['dashboard','pekerjaan','laporan'][i]===p));
  document.getElementById(p).classList.add('active');
  if (p==='dashboard') renderDash();
  if (p==='pekerjaan') { cancelEdit(); renderPekList(); }
  if (p==='laporan')   renderLaporan();
  if (p!=='pekerjaan') stopWIBClock();
}

// ==================== SIMPAN / UPDATE ====================
async function savePekerjaan() {
  const nama = document.getElementById('inp-nama').value.trim();
  const tgl  = document.getElementById('inp-tgl').value;
  const hari = document.getElementById('inp-hari').value;
  const tahun= document.getElementById('inp-tahun').value; // tempat kerja
  const kat  = getKategori();

  if (!nama) { showToast('Nama pekerjaan wajib diisi','error'); return; }

  const durasi = getDurasi();
  if (!durasi) {
    if (editJobId)         showToast('Durasi tidak valid (format HH:MM:SS)','error');
    else if (timerMode==='stopwatch') showToast('Jalankan stopwatch terlebih dahulu','error');
    else                   showToast('Isi jam mulai dan selesai','error');
    return;
  }

  // Ambil jam mulai/selesai
  // Mode edit: pertahankan dari data lama kecuali user ganti ke mode WIB
  let wibMulai   = '';
  let wibSelesai = '';
  if (editJobId) {
    // Edit: pakai data lama (tidak ada input WIB di mode edit)
    const oldJob = jobs.find(j => String(j.id) === String(editJobId));
    wibMulai   = oldJob?.wibMulai   || '';
    wibSelesai = oldJob?.wibSelesai || '';
  } else if (timerMode === 'wib') {
    wibMulai   = document.getElementById('wib-mulai')?.value   || '';
    wibSelesai = document.getElementById('wib-selesai')?.value || '';
  }
  const job = { nama, tgl, hari, tahun, durasi, status:'selesai', kategori:kat, wibMulai, wibSelesai };
  const btn = document.getElementById('btn-simpan');
  btn.disabled=true; btn.textContent='Menyimpan...';

  try {
    let res;
    if (editJobId) {
      await API.deleteJob(plSession.id, editJobId);
      res = await API.saveJob(plSession.id, job);
    } else {
      res = await API.saveJob(plSession.id, job);
    }
    if (!res.success) { showToast('Gagal: '+res.error,'error'); return; }
    showToast(editJobId ? 'Pekerjaan diperbarui!' : 'Pekerjaan disimpan!');
    cancelEdit();
    document.getElementById('inp-nama').value='';
    document.getElementById('inp-kategori').value='';
    swReset();
    await loadJobs();
  } catch(err) { showToast('Error: '+err.message,'error'); }
  finally {
    btn.disabled=false;
    btn.innerHTML=`<svg viewBox="0 0 16 16" fill="none" style="width:14px;height:14px"><path d="M13 5l-6 6-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Simpan Pekerjaan`;
  }
}

// ==================== EDIT ====================
function openEdit(id) {
  const j = jobs.find(j => String(j.id) === String(id));
  if (!j) return;
  editJobId = id;

  // Isi semua field form
  document.getElementById('inp-nama').value = j.nama;
  document.getElementById('inp-tgl').value  = j.tgl;
  document.getElementById('inp-hari').value = j.hari;

  // Tempat kerja
  const twEl = document.getElementById('inp-tahun');
  if (twEl) twEl.value = j.tahun || 'Dirumah';

  // Proyek/kategori
  const selKat = document.getElementById('inp-kategori');
  if (selKat) {
    const exists = [...selKat.options].find(o => o.value === j.kategori);
    if (!exists && j.kategori && j.kategori !== '—') {
      const o = document.createElement('option');
      o.value = j.kategori; o.textContent = j.kategori;
      selKat.appendChild(o);
    }
    selKat.value = j.kategori || '';
  }

  // ── Nonaktifkan mode toggle pencatatan waktu ──
  const modeGroup = document.querySelector('.mode-toggle')?.closest('.form-group');
  if (modeGroup) {
    modeGroup.style.opacity     = '0.4';
    modeGroup.style.pointerEvents = 'none';
    modeGroup.title = 'Mode pencatatan waktu tidak tersedia saat mengedit';
  }
  document.getElementById('sw-block').style.display  = 'none';
  document.getElementById('wib-block').style.display = 'none';

  // ── Tampilkan info jam lama (read-only) jika ada ──
  const jamInfo = document.getElementById('edit-jam-info');
  if (jamInfo) {
    if (j.wibMulai) {
      const jamTeks = j.wibSelesai ? `${j.wibMulai} – ${j.wibSelesai}` : `${j.wibMulai} – ...`;
      jamInfo.textContent = `⏰ Jam tercatat: ${jamTeks}`;
      jamInfo.style.display = 'block';
    } else {
      jamInfo.style.display = 'none';
    }
  }

  // Input durasi manual
  document.getElementById('edit-durasi-wrap').style.display = 'block';
  const inpDur = document.getElementById('inp-durasi-edit');
  inpDur.value       = fmtSec(j.durasi || 0);
  inpDur.placeholder = '00:00:00';

  document.getElementById('btn-batal-edit').style.display = 'inline-flex';
  document.getElementById('form-title-label').textContent  = '✏️ Edit Pekerjaan';

  showPage('pekerjaan');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editJobId = null;

  // Aktifkan kembali mode toggle
  const modeGroup = document.querySelector('.mode-toggle')?.closest('.form-group');
  if (modeGroup) {
    modeGroup.style.opacity       = '';
    modeGroup.style.pointerEvents = '';
    modeGroup.title = '';
  }

  document.getElementById('sw-block').style.display  = timerMode === 'stopwatch' ? 'block' : 'none';
  document.getElementById('wib-block').style.display = timerMode === 'wib'        ? 'block' : 'none';

  const jamInfo = document.getElementById('edit-jam-info');
  if (jamInfo) jamInfo.style.display = 'none';

  document.getElementById('edit-durasi-wrap').style.display = 'none';
  document.getElementById('btn-batal-edit').style.display   = 'none';
  document.getElementById('form-title-label').textContent   = 'Input Pekerjaan Baru';

  if (timerMode === 'wib') wibReset();
}

// ==================== HAPUS ====================
function openHapus(id) {
  const j=jobs.find(j=>String(j.id)===String(id));
  hapusTargetId=id;
  document.getElementById('hapus-target-nama').textContent=j?j.nama:'';
  document.getElementById('modal-hapus').classList.add('show');
}
async function confirmHapus() {
  try {
    const res=await API.deleteJob(plSession.id,hapusTargetId);
    if(!res.success){showToast('Gagal: '+res.error,'error');return;}
    closeModal('modal-hapus'); showToast('Pekerjaan dihapus'); await loadJobs();
  } catch(err){showToast('Error: '+err.message,'error');}
}

// ==================== RENDER ROW ====================
function katBadge(k) {
  return `<span class="badge badge-done" style="font-size:10.5px;white-space:nowrap">${k||'—'}</span>`;
}
function actionBtns(id) {
  return `<div style="display:flex;gap:4px">
    <button class="btn-icon" onclick="openEdit('${id}')" title="Edit"><svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button>
    <button class="btn-icon danger" onclick="openHapus('${id}')" title="Hapus"><svg viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
  </div>`;
}
const TEMPAT_ICON  = {'Dirumah':'🏠','DiKantor':'🏢','Remote':'💻','Coworking':'☕'};
const TEMPAT_LABEL = {'Dirumah':'Di Rumah','DiKantor':'Di Kantor','Remote':'Remote','Coworking':'Coworking'};

function renderRow(j) {
  const icon       = TEMPAT_ICON[j.tahun]  || '';
  const label      = TEMPAT_LABEL[j.tahun] || j.tahun || '—';
  const tempatStr  = `${icon} ${label}`.trim();

  // Jam kerja
  const jamStr = (j.wibMulai && j.wibSelesai)
    ? `${j.wibMulai} – ${j.wibSelesai}`
    : j.wibMulai
      ? `${j.wibMulai} – ...`
      : '—';

  return `<tr>
    <td title="${j.nama}">${j.nama}</td>
    <td>${katBadge(j.kategori)}</td>
    <td>${fmtTgl(j.tgl)}</td>
    <td style="font-family:var(--mono);font-size:12px;white-space:nowrap">${jamStr}</td>
    <td style="font-family:var(--mono);font-size:12px">${fmtSec(j.durasi)}</td>
    <td style="font-size:12px;white-space:nowrap">${tempatStr}</td>
    <td>${actionBtns(j.id)}</td>
  </tr>`;
}


// ============================================================
//  GRAFIK DASHBOARD — Chart.js
// ============================================================

let chartInstance  = null;
let chartPeriod    = 'mingguan'; // mingguan | bulanan | tahunan
let chartType      = 'bar';      // bar | line | pie

const CHART_COLORS = [
  '#1a6fca','#2a8ef0','#1D9E75','#F5C842','#E05C3A',
  '#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1'
];

function setChartPeriod(p) {
  chartPeriod = p;
  ['mingguan','bulanan','tahunan'].forEach(x => {
    document.getElementById('tab-'+x).classList.toggle('active', x===p);
  });
  renderChart();
}

function setChartType(t) {
  chartType = t;
  ['bar','line','pie'].forEach(x => {
    document.getElementById('ctype-'+x).classList.toggle('active', x===t);
  });
  renderChart();
}

function initChartYearSelector() {
  const sel  = document.getElementById('chart-year-sel');
  if (!sel) return;
  const now  = new Date().getFullYear();
  const years = [...new Set(jobs.map(j => new Date(j.tgl).getFullYear()))].sort((a,b)=>b-a);
  if (!years.includes(now)) years.unshift(now);
  const cur = sel.value || String(now);
  sel.innerHTML = years.map(y => `<option value="${y}" ${String(y)===cur?'selected':''}>${y}</option>`).join('');
}

function renderChart() {
  const canvas   = document.getElementById('main-chart');
  const emptyEl  = document.getElementById('chart-empty');
  const legendEl = document.getElementById('chart-legend');
  if (!canvas) return;

  const selYear  = document.getElementById('chart-year-sel');
  const year     = parseInt(selYear?.value) || new Date().getFullYear();

  // Hitung data sesuai periode
  let labels = [], counts = [], durations = [], colors = [];

  if (chartPeriod === 'tahunan') {
    // 5 tahun terakhir
    const thisYear = new Date().getFullYear();
    for (let y = thisYear - 4; y <= thisYear; y++) {
      labels.push(String(y));
      const jj = jobs.filter(j => new Date(j.tgl).getFullYear() === y);
      counts.push(jj.length);
      durations.push(+(jj.reduce((a,b)=>a+b.durasi,0)/3600).toFixed(1));
    }
    colors = labels.map((_,i) => CHART_COLORS[i % CHART_COLORS.length]);

  } else if (chartPeriod === 'bulanan') {
    const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    for (let m = 0; m < 12; m++) {
      labels.push(BULAN_SHORT[m]);
      const jj = jobs.filter(j => {
        const d = new Date(j.tgl);
        return d.getFullYear()===year && d.getMonth()===m;
      });
      counts.push(jj.length);
      durations.push(+(jj.reduce((a,b)=>a+b.durasi,0)/3600).toFixed(1));
    }
    colors = labels.map((_,i) => CHART_COLORS[i % CHART_COLORS.length]);

  } else {
    // Mingguan — 8 minggu terakhir
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - w*7 - now.getDay());
      weekStart.setHours(0,0,0,0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23,59,59,999);
      const label = `${weekStart.getDate()}/${weekStart.getMonth()+1}`;
      labels.push(label);
      const jj = jobs.filter(j => {
        const d = new Date(j.tgl);
        return d >= weekStart && d <= weekEnd;
      });
      counts.push(jj.length);
      durations.push(+(jj.reduce((a,b)=>a+b.durasi,0)/3600).toFixed(1));
    }
    colors = labels.map((_,i) => CHART_COLORS[i % CHART_COLORS.length]);
  }

  const hasData = counts.some(c=>c>0);
  emptyEl.style.display = hasData ? 'none' : 'flex';
  canvas.style.display  = hasData ? 'block' : 'none';

  if (!hasData) { legendEl.innerHTML=''; return; }

  // Destroy chart lama
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const ctx = canvas.getContext('2d');

  if (chartType === 'pie') {
    // Pie: distribusi per proyek
    const prjMap = {};
    jobs.filter(j => {
      if (chartPeriod==='tahunan') return true;
      if (chartPeriod==='bulanan') return new Date(j.tgl).getFullYear()===year;
      const now2=new Date(), wStart=new Date(now2); wStart.setDate(now2.getDate()-56-now2.getDay()); wStart.setHours(0,0,0,0);
      return new Date(j.tgl)>=wStart;
    }).forEach(j => {
      const k = j.kategori||'Umum';
      prjMap[k] = (prjMap[k]||0)+1;
    });
    const pieLabels = Object.keys(prjMap);
    const pieData   = Object.values(prjMap);
    const pieColors = pieLabels.map((_,i)=>CHART_COLORS[i%CHART_COLORS.length]);

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: pieColors,
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw} pekerjaan`
            }
          }
        }
      }
    });

    legendEl.innerHTML = pieLabels.map((l,i)=>`
      <div class="legend-item">
        <div class="legend-dot" style="background:${pieColors[i]}"></div>
        ${l} (${pieData[i]})
      </div>`).join('');

  } else {
    // Bar / Line
    const isLine = chartType === 'line';
    const barColor   = 'rgba(26,111,202,0.8)';
    const barColor2  = 'rgba(29,158,117,0.7)';
    const lineColor  = '#1a6fca';
    const lineColor2 = '#1D9E75';

    chartInstance = new Chart(ctx, {
      type: isLine ? 'line' : 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Jumlah Pekerjaan',
            data: counts,
            backgroundColor: isLine ? 'rgba(26,111,202,0.12)' : barColor,
            borderColor: lineColor,
            borderWidth: isLine ? 2.5 : 0,
            borderRadius: isLine ? 0 : 6,
            fill: isLine,
            tension: 0.4,
            pointBackgroundColor: lineColor,
            pointRadius: isLine ? 4 : 0,
            yAxisID: 'y',
          },
          {
            label: 'Durasi (jam)',
            data: durations,
            backgroundColor: isLine ? 'rgba(29,158,117,0.1)' : barColor2,
            borderColor: lineColor2,
            borderWidth: isLine ? 2.5 : 0,
            borderRadius: isLine ? 0 : 6,
            fill: isLine,
            tension: 0.4,
            pointBackgroundColor: lineColor2,
            pointRadius: isLine ? 4 : 0,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.datasetIndex===0) return ` ${ctx.raw} pekerjaan`;
                return ` ${ctx.raw} jam kerja`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { font: { size: 11, family: 'Plus Jakarta Sans' }, color: '#8BA5C4' }
          },
          y: {
            type: 'linear', position: 'left',
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              stepSize: 1,
              font: { size: 11, family: 'Plus Jakarta Sans' }, color: '#1a6fca',
              callback: v => v + ' pek'
            }
          },
          y1: {
            type: 'linear', position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              font: { size: 11, family: 'Plus Jakarta Sans' }, color: '#1D9E75',
              callback: v => v + ' jam'
            }
          }
        }
      }
    });

    legendEl.innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:${lineColor}"></div> Jumlah Pekerjaan</div>
      <div class="legend-item"><div class="legend-dot" style="background:${lineColor2}"></div> Durasi (jam)</div>`;
  }
}

// ==================== DASHBOARD ====================
function renderDash() {
  const fl=filterMonth==='all'?jobs:jobs.filter(j=>new Date(j.tgl).getMonth()===parseInt(filterMonth));
  const totalSec=fl.reduce((a,b)=>a+b.durasi,0);
  const today=todayStr();
  document.getElementById('stat-grid').innerHTML=`
    <div class="stat"><div class="stat-label">Total Pekerjaan</div><div class="stat-val">${fl.length}</div></div>
    <div class="stat"><div class="stat-label">Total Durasi</div><div class="stat-val" style="font-size:18px">${fmtSec(totalSec)}</div></div>
    <div class="stat"><div class="stat-label">Hari Ini</div><div class="stat-val">${jobs.filter(j=>j.tgl===today).length}</div></div>
  `;
  const months=[...new Set(jobs.map(j=>new Date(j.tgl).getMonth()))].sort((a,b)=>a-b);
  let fr=`<button class="fbtn ${filterMonth==='all'?'active':''}" onclick="setFilter('all')">Semua</button>`;
  months.forEach(m=>{fr+=`<button class="fbtn ${filterMonth==m?'active':''}" onclick="setFilter(${m})">${BULAN[m]}</button>`;});
  document.getElementById('filter-row').innerHTML=fr;
  document.getElementById('dash-tbody').innerHTML=fl.length?fl.map(renderRow).join(''):`<tr><td colspan="6" class="empty">Belum ada data</td></tr>`;

  // Render grafik
  initChartYearSelector();
  renderChart();
}
function setFilter(m){filterMonth=m;renderDash();}

// ==================== DAFTAR PEKERJAAN ====================
function renderPekList(){
  document.getElementById('pek-tbody').innerHTML=jobs.length?jobs.map(renderRow).join(''):`<tr><td colspan="6" class="empty">Belum ada data</td></tr>`;
}

// ==================== KOP SURAT DARI ADMIN ====================
function loadKopFromAdmin() {
  const kop=JSON.parse(localStorage.getItem(KOP_KEY)||'null');
  if(!kop)return;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el&&val)el.textContent=val; };
  set('rpt-nama', kop.nama);
  set('rpt-alamat', kop.alamat);
  set('rpt-judul', kop.judul);
  set('rpt-kota1', kop.kota1);
  set('rpt-kota2', kop.kota2);
  set('rpt-ttd1',  kop.ttd1);
  set('rpt-ttd2',  kop.ttd2);
  set('rpt-jab1',  kop.jab1);
  set('rpt-jab2',  kop.jab2);
  if(kop.logo) document.getElementById('logo-display').innerHTML=`<img src="${kop.logo}" alt="logo">`;
}

// ==================== LAPORAN ====================
function renderLaporan() {
  loadKopFromAdmin();
  const now=new Date();
  const tglStr=`${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;
  ['ttd-tgl-1','ttd-tgl-2'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=tglStr;});

  // Filter bulan
  const months=[...new Set(jobs.map(j=>new Date(j.tgl).getMonth()))].sort((a,b)=>a-b);
  let fr=`<button class="fbtn ${laporanFilter==='all'?'active':''}" onclick="setLaporanFilter('all')">Semua</button>`;
  months.forEach(m=>{fr+=`<button class="fbtn ${laporanFilter==m?'active':''}" onclick="setLaporanFilter(${m})">${BULAN[m]}</button>`;});
  document.getElementById('laporan-filter').innerHTML=fr;

  updateKategoriFilter();

  let fl=laporanFilter==='all'?jobs:jobs.filter(j=>new Date(j.tgl).getMonth()===parseInt(laporanFilter));
  if(laporanFilterKat!=='all') fl=fl.filter(j=>j.kategori===laporanFilterKat);

  const periodeLabel=laporanFilter==='all'?'Semua Periode':BULAN[parseInt(laporanFilter)]+' '+now.getFullYear();
  document.getElementById('report-period').textContent='Periode: '+periodeLabel+(laporanFilterKat!=='all'?' — '+laporanFilterKat:'');
  document.getElementById('report-no').textContent='LAP/'+now.getFullYear()+'/'+String(now.getMonth()+1).padStart(2,'0')+'/'+String(fl.length||1).padStart(3,'0');
  const totalSec=fl.reduce((a,b)=>a+b.durasi,0);
  const today=todayStr();
  document.getElementById('rstat-grid').innerHTML=`
    <div class="rstat"><div class="rstat-label">Total Pekerjaan</div><div class="rstat-val">${fl.length}</div></div>
    <div class="rstat"><div class="rstat-label">Total Durasi</div><div class="rstat-val" style="font-size:14px">${fmtSec(totalSec)}</div></div>
    <div class="rstat"><div class="rstat-label">Hari Ini</div><div class="rstat-val">${jobs.filter(j=>j.tgl===today).length}</div></div>
  `;
  document.getElementById('print-tbody').innerHTML=fl.length
    ?fl.map((j,i)=>{
      const tIcon = TEMPAT_ICON[j.tahun]||'';
      const durSec = j.durasi||0;
      const jamMulai   = j.wibMulai   || '';
      const jamSelesai = j.wibSelesai || '';
      const jamStr = (jamMulai && jamSelesai)
        ? `${jamMulai} – ${jamSelesai}`
        : jamMulai
          ? `${jamMulai} – sekarang`
          : fmtSec(durSec);
      return `<tr>
        <td>${i+1}</td>
        <td title="${j.nama}">${j.nama}</td>
        <td>${katBadge(j.kategori)}</td>
        <td>${fmtTgl(j.tgl)}</td>
        <td style="font-family:var(--mono);font-size:12px">${jamStr}</td>
        <td style="font-family:var(--mono);font-size:12px">${fmtSec(durSec)}</td>
        <td style="font-size:12px">${tIcon} ${j.tahun||'—'}</td>
      </tr>`;}).join('')
    :`<tr><td colspan="7" class="empty">Belum ada data</td></tr>`;
}
function setLaporanFilter(m){laporanFilter=m;renderLaporan();}
function setLaporanFilterKategori(v){laporanFilterKat=v;renderLaporan();}

// ==================== PRINT PDF ====================
function doPrint(){
  const content=document.getElementById('report-wrap').innerHTML;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html lang="id"><head>
<meta charset="UTF-8"><title>Laporan Pekerja Lepas</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1C2D40;padding:18px}
.report-wrap{border:1px solid #D8E4F2;border-radius:12px;overflow:hidden}
.kop{background:linear-gradient(135deg,#0C447C 0%,#1a6fca 60%,#2a8ef0 100%);padding:18px 22px;display:flex;align-items:center;gap:14px}
.kop-logo-box{width:60px;height:60px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.kop-logo-box img{width:100%;height:100%;object-fit:contain}
.logo-placeholder{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px}
.logo-placeholder svg{width:22px;height:22px}
.logo-placeholder span{font-size:8.5px;color:#185FA5;text-align:center}
.kop-name{font-size:17px;font-weight:700;color:#fff;margin-bottom:3px}
.kop-sub{font-size:11px;color:rgba(255,255,255,0.7)}
.kop-stripe{height:3px;background:linear-gradient(90deg,#B5D4F4,#E6F1FB,#B5D4F4)}
.report-body{padding:18px 22px}
.report-meta{display:flex;justify-content:space-between;margin-bottom:14px;gap:10px}
.report-title{font-size:15px;font-weight:700;color:#0C447C;margin-bottom:3px}
.report-period{font-size:11.5px;color:#8BA5C4}
.report-no-wrap{text-align:right;flex-shrink:0}
.report-no-label{font-size:10px;color:#8BA5C4;text-transform:uppercase;margin-bottom:2px}
.report-no-val{font-size:12.5px;font-weight:600;color:#0C447C;font-family:'JetBrains Mono',monospace}
.rstat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.rstat{background:#E6F1FB;border:1px solid #B5D4F4;border-radius:6px;padding:9px 11px}
.rstat-label{font-size:10px;color:#185FA5;font-weight:600;text-transform:uppercase;margin-bottom:3px}
.rstat-val{font-size:15px;font-weight:700;color:#0C447C;font-family:'JetBrains Mono',monospace}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}
th{text-align:left;padding:6px 8px;background:#E6F1FB;color:#185FA5;border-bottom:1px solid #B5D4F4;font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px}
td{padding:6px 8px;border-bottom:1px solid #EEF2F8;color:#1C2D40;font-size:11.5px}
tr:last-child td{border-bottom:none}
.badge{display:inline-block;font-size:10px;padding:2px 7px;border-radius:99px;background:#E6F1FB;color:#0C447C;font-weight:600}
.empty{text-align:center;padding:1rem;color:#8BA5C4;font-style:italic}
.ttd-section{display:grid;grid-template-columns:1fr 1fr;gap:2rem;padding-top:14px;border-top:1px solid #D8E4F2}
.ttd-box{text-align:center}
.ttd-label{font-size:11px;color:#8BA5C4;margin-bottom:3px}
.ttd-city{font-size:12px;color:#4A6280;margin-bottom:10px}
.ttd-space{height:55px;border-bottom:1px solid #D8E4F2;margin-bottom:7px}
.ttd-name{font-size:12.5px;font-weight:700;color:#1C2D40}
.ttd-role{font-size:11px;color:#8BA5C4;margin-top:2px}
@media print{body{padding:0}.report-wrap{border:none;border-radius:0}}
</style>
</head><body><div class="report-wrap">${content}</div></body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}

// ==================== MODAL & TOAST ====================
function closeModal(id){document.getElementById(id).classList.remove('show');}
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',function(e){if(e.target===this)this.classList.remove('show');});});

function showToast(msg,type='success'){
  const ex=document.getElementById('pl-toast');if(ex)ex.remove();
  const t=document.createElement('div');t.id='pl-toast';t.textContent=msg;
  Object.assign(t.style,{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',
    background:type==='error'?'#A32D2D':'#085041',color:'#fff',padding:'11px 22px',
    borderRadius:'10px',fontSize:'13.5px',fontWeight:'600',zIndex:'9999',
    boxShadow:'0 4px 20px rgba(0,0,0,0.2)',fontFamily:'var(--font-body)',whiteSpace:'nowrap'});
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// ==================== INIT ====================
initForm();
loadJobs();
