// ============================================================
//  PEKERJA LEPAS — api.js
//  Semua komunikasi ke Google Apps Script
//
//  ⚠️  WAJIB: Ganti API_URL dengan URL deployment Apps Script
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbzCuf5vKkybs0iP6k7EqM8S0JWQCP6RfiyY3QLGOhPxyLmVfJ4LPrEk40sz92VeV-wy/exec';
// Contoh: 'https://script.google.com/macros/s/AKfycbXXXX/exec'

// ==================== FETCH WRAPPER ====================
async function apiFetch(action, body = {}) {
  // Apps Script hanya butuh Content-Type: text/plain untuk hindari CORS preflight
  const res = await fetch(API_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body   : JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error('HTTP error: ' + res.status);
  return res.json();
}

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('HTTP error: ' + res.status);
  return res.json();
}

// ==================== API OBJECT ====================
const API = {

  // Test koneksi
  ping()                            { return apiGet('ping'); },

  // ── AUTH ──
  login(username, password, role)   { return apiFetch('login', { username, password, role }); },

  // ── USER (admin only) ──
  getUsers(requesterId)             { return apiFetch('getUsers',   { requesterId }); },
  createUser(requesterId, data)     { return apiFetch('createUser', { requesterId, ...data }); },
  updateUser(requesterId, data)     { return apiFetch('updateUser', { requesterId, ...data }); },
  deleteUser(requesterId, id)       { return apiFetch('deleteUser', { requesterId, id }); },

  // ── PEKERJAAN ──
  getJobs(userId)                   { return apiFetch('getJobs',    { userId }); },
  getAllJobs(requesterId)            { return apiFetch('getAllJobs', { requesterId }); },
  saveJob(userId, job)              { return apiFetch('saveJob',    { userId, ...job }); },
  deleteJob(requesterId, id)        { return apiFetch('deleteJob',  { requesterId, id }); },

  // Init (jalankan sekali via browser atau Apps Script langsung)
  initSheets()                      { return apiGet('initSheets'); },
};
