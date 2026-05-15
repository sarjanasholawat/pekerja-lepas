// ============================================================
//  PEKERJA LEPAS — projects.js
//  Manajemen Proyek & Papan Tugas (Kanban)
//  Data: localStorage (siap diganti ke Apps Script)
// ============================================================

const PRJ_KEY  = 'pl_projects';
const TASK_KEY = 'pl_tasks';

// ── STATE ──
let projects      = JSON.parse(localStorage.getItem(PRJ_KEY)  || '[]');
let tasks         = JSON.parse(localStorage.getItem(TASK_KEY) || '[]');
let prjFilterUser = 'all';
let editPrjId     = null;
let editTaskId    = null;
let dragTaskId    = null;

// ── SAVE ──
function savePrj()  { localStorage.setItem(PRJ_KEY,  JSON.stringify(projects)); }
function saveTask() { localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); }

// ── UTILS ──
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function getUserList() {
  // Ambil semua user (termasuk admin) dari localStorage pl_users
  // pl_users diisi saat syncUsersForProjects() berhasil memanggil API
  return JSON.parse(localStorage.getItem('pl_users') || '[]');
}

const STATUS_LABELS = { planning:'Planning', proses:'Proses', done:'Done' };
const STATUS_COLORS = {
  planning: { bg:'#FFF8E6', text:'#A05A00', bdr:'#F5C842' },
  proses:   { bg:'#E6F1FB', text:'#0C447C', bdr:'#85B7EB' },
  done:     { bg:'#E1F5EE', text:'#085041', bdr:'#5DCAA5' },
};

function statusBadge(s) {
  const c = STATUS_COLORS[s] || STATUS_COLORS.planning;
  return `<span style="display:inline-block;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:${c.bg};color:${c.text};border:1px solid ${c.bdr}">${STATUS_LABELS[s]||s}</span>`;
}

// ══════════════════════════════════════════════
//  PROYEK
// ══════════════════════════════════════════════

function renderProyek() {
  // Isi dropdown filter user
  const users = getUserList();
  let fr = `<button class="fbtn ${prjFilterUser==='all'?'active':''}" onclick="setPrjFilter('all')">Semua</button>`;
  users.forEach(u => {
    fr += `<button class="fbtn ${prjFilterUser===u.id||prjFilterUser===u.username?'active':''}" onclick="setPrjFilter('${u.id||u.username}')">${u.nama}</button>`;
  });
  document.getElementById('prj-filter-row').innerHTML = fr;

  const fl = prjFilterUser === 'all'
    ? projects
    : projects.filter(p => p.managerId === prjFilterUser);

  const grid = document.getElementById('prj-grid');
  if (!fl.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:3rem">Belum ada proyek. Klik "Buat Proyek" untuk memulai.</div>`;
    return;
  }

  grid.innerHTML = fl.map(p => {
    const taskCount = tasks.filter(t => t.projectId === p.id).length;
    const doneCount = tasks.filter(t => t.projectId === p.id && t.status === 'done').length;
    const pct = taskCount ? Math.round(doneCount/taskCount*100) : 0;
    return `
    <div class="prj-card" onclick="openPrjDetail('${p.id}')">
      <div class="prj-card-header">
        <div class="prj-card-icon">${p.nama.slice(0,2).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div class="prj-card-title" title="${p.nama}">${p.nama}</div>
          <div class="prj-card-mgr">
            <svg viewBox="0 0 14 14" fill="none" style="width:11px;height:11px;flex-shrink:0"><circle cx="7" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 12c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            ${p.managerName||'—'}
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn-icon" onclick="event.stopPropagation();openEditPrj('${p.id}')" title="Edit"><svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button>
          <button class="btn-icon danger" onclick="event.stopPropagation();hapusPrj('${p.id}')" title="Hapus"><svg viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
        </div>
      </div>
      <div style="margin:10px 0 6px">${statusBadge(p.status)}</div>
      ${p.link ? `<a href="${p.link}" target="_blank" onclick="event.stopPropagation()" class="prj-link">
        <svg viewBox="0 0 14 14" fill="none" style="width:11px;height:11px"><path d="M6 3H3a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 2h3v3M12 2L7 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Referensi
      </a>` : ''}
      <div class="prj-progress">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400);margin-bottom:5px">
          <span>${doneCount}/${taskCount} tugas selesai</span><span>${pct}%</span>
        </div>
        <div style="height:5px;background:var(--gray-100);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#1a6fca,#2a8ef0);border-radius:99px;transition:width 0.4s"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setPrjFilter(v) { prjFilterUser = v; renderProyek(); }

function openModalPrj(id) {
  editPrjId = id || null;
  const p = id ? projects.find(x=>x.id===id) : null;
  document.getElementById('modal-prj-title').textContent = p ? 'Edit Proyek' : 'Buat Proyek Baru';
  document.getElementById('prj-inp-nama').value   = p ? p.nama   : '';
  document.getElementById('prj-inp-link').value   = p ? p.link   : '';
  document.getElementById('prj-inp-status').value = p ? p.status : 'planning';

  // Populate manager dulu dari cache, lalu refresh dari API
  populateManagerDropdown(p);
  syncUsersForProjects().then(() => populateManagerDropdown(p));

  document.getElementById('modal-prj').classList.add('show');
  document.getElementById('prj-inp-nama').focus();
}

function populateManagerDropdown(p) {
  const users = JSON.parse(localStorage.getItem('pl_users') || '[]');
  const sel   = document.getElementById('prj-inp-manager');
  const curVal = sel.value; // simpan pilihan saat ini jika sudah dipilih
  sel.innerHTML = '<option value="">— Pilih Manager —</option>';

  if (users.length === 0) {
    // Fallback minimum: user yang sedang login
    const sess = JSON.parse(sessionStorage.getItem('pl_session') || 'null');
    if (sess) {
      const opt = document.createElement('option');
      opt.value = sess.id;
      opt.textContent = sess.nama + ' (Anda)';
      if (p && p.managerId === sess.id) opt.selected = true;
      sel.appendChild(opt);
    }
  } else {
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id || u.username;
      opt.textContent = u.nama + (u.role === 'admin' ? ' · Admin' : '');
      if (p && p.managerId === String(u.id || u.username)) opt.selected = true;
      else if (!p && curVal && curVal === String(u.id || u.username)) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

function openEditPrj(id) { openModalPrj(id); }

function simpanPrj() {
  const nama   = document.getElementById('prj-inp-nama').value.trim();
  const mgr    = document.getElementById('prj-inp-manager');
  const status = document.getElementById('prj-inp-status').value;
  const link   = document.getElementById('prj-inp-link').value.trim();
  if (!nama) { showToast('Nama proyek wajib diisi','error'); return; }

  const managerId   = mgr.value;
  const managerName = mgr.options[mgr.selectedIndex]?.text || '—';

  if (editPrjId) {
    const idx = projects.findIndex(p=>p.id===editPrjId);
    if (idx>-1) projects[idx] = {...projects[idx], nama, managerId, managerName, status, link};
  } else {
    projects.unshift({ id: uid(), nama, managerId, managerName, status, link, createdAt: Date.now() });
  }
  savePrj();
  closeModal('modal-prj');
  renderProyek();
  refreshProjectDropdowns();
  showToast(editPrjId ? 'Proyek diperbarui!' : 'Proyek berhasil dibuat!');
}

function hapusPrj(id) {
  if (!confirm('Hapus proyek ini beserta semua tugasnya?')) return;
  projects = projects.filter(p=>p.id!==id);
  tasks    = tasks.filter(t=>t.projectId!==id);
  savePrj(); saveTask();
  renderProyek(); renderKanban();
  refreshProjectDropdowns();
  showToast('Proyek dihapus');
}

function openPrjDetail(id) {
  // Langsung filter papan tugas berdasarkan proyek ini
  showPage('kanban');
  setTimeout(() => {
    document.getElementById('kanban-filter-prj').value = id;
    renderKanban();
  }, 50);
}

// ══════════════════════════════════════════════
//  PAPAN TUGAS — KANBAN
// ══════════════════════════════════════════════

function renderKanban() {
  const filterPrj  = document.getElementById('kanban-filter-prj')?.value  || 'all';
  const filterUser = document.getElementById('kanban-filter-user')?.value || 'all';

  let fl = [...tasks];
  if (filterPrj  !== 'all') fl = fl.filter(t=>t.projectId===filterPrj);
  if (filterUser !== 'all') fl = fl.filter(t=>t.assigneeId===filterUser);

  ['todo','inprogress','done-col'].forEach(colId => {
    const statusMap = { 'todo':'planning','inprogress':'proses','done-col':'done' };
    const status    = statusMap[colId];
    const colTasks  = fl.filter(t=>t.status===status);
    const tbody     = document.getElementById('col-'+colId);
    if (!tbody) return;

    document.getElementById('count-'+colId).textContent = colTasks.length;

    if (!colTasks.length) {
      tbody.innerHTML = `<div class="kanban-empty">Tidak ada tugas</div>`;
      return;
    }

    tbody.innerHTML = colTasks.map(t => {
      const prj = projects.find(p=>p.id===t.projectId);
      return `
      <div class="kanban-card" draggable="true"
        ondragstart="dragStart(event,'${t.id}')"
        ondragend="dragEnd(event)">
        <div class="kanban-card-title">${t.judul}</div>
        ${t.deskripsi ? `<div class="kanban-card-desc">${t.deskripsi}</div>` : ''}
        <div class="kanban-card-meta">
          ${prj ? `<span class="kanban-tag">${prj.nama}</span>` : ''}
          ${t.assigneeName ? `<span class="kanban-tag kanban-tag-user">
            <svg viewBox="0 0 12 12" fill="none" style="width:9px;height:9px"><circle cx="6" cy="4" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M2 10c0-1.7 1.8-3 4-3s4 1.3 4 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            ${t.assigneeName}
          </span>` : ''}
          ${t.link ? `<a href="${t.link}" target="_blank" class="kanban-tag" style="color:var(--blue);text-decoration:none" onclick="event.stopPropagation()">↗ Ref</a>` : ''}
        </div>
        <div class="kanban-card-actions">
          <button class="btn-icon" style="width:24px;height:24px" onclick="openEditTask('${t.id}')" title="Edit"><svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button>
          <div style="display:flex;gap:3px">
            ${status!=='planning'?`<button class="btn-icon" style="width:24px;height:24px" onclick="moveTask('${t.id}',-1)" title="Mundur">←</button>`:''}
            ${status!=='done'    ?`<button class="btn-icon" style="width:24px;height:24px" onclick="moveTask('${t.id}',1)" title="Maju">→</button>`:''}
          </div>
          <button class="btn-icon danger" style="width:24px;height:24px" onclick="hapusTask('${t.id}')" title="Hapus"><svg viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
        </div>
      </div>`;
    }).join('');
  });
}

function moveTask(id, dir) {
  const order = ['planning','proses','done'];
  const t = tasks.find(t=>t.id===id);
  if (!t) return;
  const idx = order.indexOf(t.status);
  const next = order[idx+dir];
  if (!next) return;
  t.status = next;
  saveTask();
  renderKanban();
  showToast('Tugas dipindah ke '+STATUS_LABELS[next]);
}

function hapusTask(id) {
  if (!confirm('Hapus tugas ini?')) return;
  tasks = tasks.filter(t=>t.id!==id);
  saveTask();
  renderKanban();
  showToast('Tugas dihapus');
}

// ── MODAL TUGAS ──
function openModalTask(id) {
  editTaskId = id || null;
  const t = id ? tasks.find(x=>x.id===id) : null;
  document.getElementById('modal-task-title').textContent = t ? 'Edit Tugas' : 'Buat Tugas Baru';
  document.getElementById('task-inp-judul').value       = t ? t.judul       : '';
  document.getElementById('task-inp-deskripsi').value   = t ? t.deskripsi   : '';
  document.getElementById('task-inp-link').value        = t ? t.link        : '';
  document.getElementById('task-inp-status').value      = t ? t.status      : 'planning';

  // Dropdown proyek
  const selPrj = document.getElementById('task-inp-project');
  selPrj.innerHTML = '<option value="">— Pilih Proyek —</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.nama;
    if (t && t.projectId === p.id) opt.selected = true;
    selPrj.appendChild(opt);
  });

  // Dropdown assignee dari semua user yang ada
  const usersForTask = getUserList();
  const selAss = document.getElementById('task-inp-assignee');
  selAss.innerHTML = '<option value="">— Pilih Assignee —</option>';
  if (usersForTask.length === 0) {
    const sess = JSON.parse(sessionStorage.getItem('pl_session') || 'null');
    if (sess) {
      const opt = document.createElement('option');
      opt.value = sess.id; opt.textContent = sess.nama + ' (Anda)';
      if (t && t.assigneeId === sess.id) opt.selected = true;
      selAss.appendChild(opt);
    }
  } else {
    usersForTask.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id||u.username;
      opt.textContent = u.nama + (u.role === 'admin' ? ' (Admin)' : '');
      if (t && t.assigneeId === (u.id||u.username)) opt.selected = true;
      selAss.appendChild(opt);
    });
  }

  document.getElementById('modal-task').classList.add('show');
  document.getElementById('task-inp-judul').focus();
}

function openEditTask(id) { openModalTask(id); }

function simpanTask() {
  const judul    = document.getElementById('task-inp-judul').value.trim();
  const deskripsi= document.getElementById('task-inp-deskripsi').value.trim();
  const link     = document.getElementById('task-inp-link').value.trim();
  const status   = document.getElementById('task-inp-status').value;
  const selPrj   = document.getElementById('task-inp-project');
  const selAss   = document.getElementById('task-inp-assignee');
  if (!judul) { showToast('Judul tugas wajib diisi','error'); return; }

  const projectId    = selPrj.value;
  const projectName  = selPrj.options[selPrj.selectedIndex]?.text || '';
  const assigneeId   = selAss.value;
  const assigneeName = selAss.options[selAss.selectedIndex]?.text || '';

  if (editTaskId) {
    const idx = tasks.findIndex(t=>t.id===editTaskId);
    if (idx>-1) tasks[idx] = {...tasks[idx], judul, deskripsi, link, status, projectId, projectName, assigneeId, assigneeName};
  } else {
    tasks.unshift({ id:uid(), judul, deskripsi, link, status, projectId, projectName, assigneeId, assigneeName, createdAt:Date.now() });
  }
  saveTask();
  closeModal('modal-task');
  renderKanban();
  renderProyek(); // update progress bar
  showToast(editTaskId ? 'Tugas diperbarui!' : 'Tugas berhasil dibuat!');
}

// ── DRAG AND DROP ──
function dragStart(e, id) {
  dragTaskId = id;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(()=>e.target.classList.add('dragging'), 0);
}
function dragEnd(e) {
  e.target.classList.remove('dragging');
  dragTaskId = null;
}
function dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function dragLeave(e){ e.currentTarget.classList.remove('drag-over'); }
function dropOn(e, status) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragTaskId) return;
  const t = tasks.find(t=>t.id===dragTaskId);
  if (t && t.status !== status) {
    t.status = status;
    saveTask();
    renderKanban();
    renderProyek();
    showToast('Dipindah ke '+STATUS_LABELS[status]);
  }
}

// ── REFRESH DROPDOWNS ──
function refreshProjectDropdowns() {
  // Update kanban filter proyek
  const sel = document.getElementById('kanban-filter-prj');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="all">Semua Proyek</option>';
    projects.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.nama;
      sel.appendChild(o);
    });
    if ([...sel.options].find(o=>o.value===cur)) sel.value = cur;
  }
  // Juga update dropdown proyek di form pekerjaan
  if (typeof populateProyekDropdown === 'function') populateProyekDropdown();
}

function refreshUserDropdowns() {
  const sel = document.getElementById('kanban-filter-user');
  if (!sel) return;
  const users = getUserList();
  sel.innerHTML = '<option value="all">Semua Anggota</option>';
  users.forEach(u => {
    const o = document.createElement('option');
    o.value = u.id||u.username; o.textContent = u.nama;
    sel.appendChild(o);
  });
}

// ── INIT ──
function initProjectsPage() {
  syncUsersForProjects().then(() => {
    refreshProjectDropdowns();
    refreshUserDropdowns();
    renderProyek();
  });
}

function initKanbanPage() {
  syncUsersForProjects().then(() => {
    refreshProjectDropdowns();
    refreshUserDropdowns();
    renderKanban();
  });
}

// Muat semua user dari API, simpan ke localStorage, return data
async function syncUsersForProjects() {
  const sess = JSON.parse(sessionStorage.getItem('pl_session') || 'null');
  if (!sess) return;

  try {
    const res = await API.getUsers(sess.id).catch(() => null);
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      const prev = localStorage.getItem('pl_users');
      const next = JSON.stringify(res.data);
      if (prev !== next) {
        // Data berubah — simpan dan refresh dropdown yang terbuka
        localStorage.setItem('pl_users', next);
        refreshUserDropdowns();
      }
      return res.data;
    }
  } catch (_) {}

  // Fallback: pastikan minimal user yang sedang login tersimpan
  const existing = JSON.parse(localStorage.getItem('pl_users') || '[]');
  const alreadyThere = existing.find(u => String(u.id) === String(sess.id));
  if (!alreadyThere) {
    existing.push({ id: sess.id, username: sess.username, nama: sess.nama, role: sess.role });
    localStorage.setItem('pl_users', JSON.stringify(existing));
  }
  return existing;
}

// ── AUTO SYNC: polling setiap 30 detik selama halaman terbuka ──
setInterval(() => {
  syncUsersForProjects();
}, 30000);

// ── STORAGE EVENT: update instan jika admin ubah user di tab lain ──
window.addEventListener('storage', (e) => {
  if (e.key !== 'pl_users') return;
  // pl_users berubah (misal dari tab admin) → refresh semua dropdown
  refreshUserDropdowns();
  // Jika modal proyek sedang terbuka, refresh dropdown manager juga
  const modalPrj = document.getElementById('modal-prj');
  if (modalPrj && modalPrj.classList.contains('show')) {
    const editingId = editPrjId ? projects.find(p => p.id === editPrjId) : null;
    populateManagerDropdown(editingId || null);
  }
  // Jika modal tugas sedang terbuka, refresh assignee juga
  const modalTask = document.getElementById('modal-task');
  if (modalTask && modalTask.classList.contains('show')) {
    const editingTask = editTaskId ? tasks.find(t => t.id === editTaskId) : null;
    repopulateAssigneeDropdown(editingTask || null);
  }
});

// Helper: refresh assignee dropdown saat modal task terbuka
function repopulateAssigneeDropdown(t) {
  const users  = JSON.parse(localStorage.getItem('pl_users') || '[]');
  const selAss = document.getElementById('task-inp-assignee');
  if (!selAss) return;
  const cur = selAss.value;
  selAss.innerHTML = '<option value="">— Pilih Assignee —</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id || u.username;
    opt.textContent = u.nama + (u.role === 'admin' ? ' · Admin' : '');
    if (t && t.assigneeId === String(u.id || u.username)) opt.selected = true;
    else if (!t && cur === String(u.id || u.username)) opt.selected = true;
    selAss.appendChild(opt);
  });
}

// Panggil pertama kali saat script load
syncUsersForProjects();
