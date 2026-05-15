// ============================================================
//  PEKERJA LEPAS — sidebar.js
//  Sidebar collapsible + swipe gesture + fixed toggle
//  Posisi & arah panah toggle dikendalikan CSS (.sidebar.collapsed ~ .sb-toggle)
// ============================================================

(function() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sb-overlay');
  const toggleBtn= document.getElementById('sb-toggle');
  const menuBtn  = document.getElementById('topbar-menu-btn');
  const isMobile = () => window.innerWidth <= 768;

  // ── COLLAPSE / EXPAND (desktop) ──
  function toggleCollapse() {
    if (isMobile()) return;
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sb_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
    // CSS sibling selector (.sidebar.collapsed ~ .sb-toggle) otomatis handle posisi & rotasi
  }

  // ── OPEN / CLOSE sidebar di mobile ──
  function openMobile() {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeMobile() {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  // Event listeners
  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    isMobile() ? openMobile() : toggleCollapse();
  });
  if (menuBtn) menuBtn.addEventListener('click', () => {
    isMobile() ? openMobile() : toggleCollapse();
  });
  if (overlay) overlay.addEventListener('click', closeMobile);

  // ── RESTORE STATE dari localStorage ──
  if (!isMobile() && localStorage.getItem('sb_collapsed') === '1') {
    sidebar.classList.add('collapsed');
    // CSS sibling selector langsung berlaku — tidak perlu JS tambahan
  }

  // ── SWIPE GESTURE (mobile) ──
  let tx = 0, ty = 0;
  document.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!isMobile()) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = Math.abs(e.changedTouches[0].clientY - ty);
    if (dy > 60) return; // gerakan terlalu vertikal, abaikan
    if (dx > 60 && tx < 40 && !sidebar.classList.contains('mobile-open')) openMobile();
    if (dx < -60 && sidebar.classList.contains('mobile-open')) closeMobile();
  }, { passive: true });

  // ── RESIZE: kembali ke desktop mode ──
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      closeMobile();
      document.body.style.overflow = '';
    }
  });

  // ── AUTO CLOSE nav item di mobile ──
  document.querySelectorAll('.sb-nav-item, .sb-logout').forEach(btn => {
    btn.addEventListener('click', () => { if (isMobile()) closeMobile(); });
  });

  // ── UPDATE TOPBAR TITLE ──
  window._setTopbarTitle = function(title) {
    const el = document.getElementById('topbar-page-title');
    if (el) el.textContent = title;
  };
})();
