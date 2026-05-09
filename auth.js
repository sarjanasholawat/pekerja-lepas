// ============================================================
//  PEKERJA LEPAS — auth.js  (versi Google Sheets)
//  Login terhubung ke Apps Script
// ============================================================

let activeRole = 'user';

function switchRole(role) {
  activeRole = role;
  document.getElementById('tab-user').classList.toggle('active', role === 'user');
  document.getElementById('tab-admin').classList.toggle('active', role === 'admin');
  document.getElementById('form-title').textContent =
    role === 'admin' ? 'Masuk sebagai Admin' : 'Masuk sebagai User';
  clearError();
  document.getElementById('inp-username').value = '';
  document.getElementById('inp-password').value = '';
  document.getElementById('inp-username').focus();
}

async function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('inp-username').value.trim();
  const password = document.getElementById('inp-password').value;
  const btn      = document.getElementById('btn-login');

  if (!username || !password) { showError('Username dan password wajib diisi.'); return; }

  btn.disabled  = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="width:17px;height:17px;animation:spin 0.8s linear infinite"><circle cx="12" cy="12" r="9" stroke="white" stroke-width="2" stroke-dasharray="40" stroke-dashoffset="15"/></svg> Memverifikasi...`;

  try {
    const result = await API.login(username, password, activeRole);
    if (!result.success) { showError(result.error || 'Username atau password tidak sesuai.'); return; }
    sessionStorage.setItem('pl_session', JSON.stringify({ ...result.user, loginAt: Date.now() }));
    window.location.href = result.user.role === 'admin' ? 'admin.html' : 'index.html';
  } catch (err) {
    showError('Gagal terhubung ke server. Periksa koneksi internet.');
    console.error(err);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<svg viewBox="0 0 18 18" fill="none" style="width:17px;height:17px"><path d="M7 9h7M11 6l3 3-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 4H5a2 2 0 00-2 2v6a2 2 0 002 2h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Masuk`;
  }
}

function showError(msg) {
  document.getElementById('error-text').textContent = msg;
  document.getElementById('error-msg').classList.add('show');
  const card = document.querySelector('.login-card');
  card.style.animation = 'shake 0.35s ease';
  setTimeout(() => card.style.animation = '', 400);
}

function clearError() { document.getElementById('error-msg').classList.remove('show'); }

const style = document.createElement('style');
style.textContent = `
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
`;
document.head.appendChild(style);

const existingSession = sessionStorage.getItem('pl_session');
if (existingSession) {
  const s = JSON.parse(existingSession);
  window.location.href = s.role === 'admin' ? 'admin.html' : 'index.html';
}
