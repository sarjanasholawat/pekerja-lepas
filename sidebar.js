// ============================================================
//  PEKERJA LEPAS — sidebar.js
//  Sidebar collapsible + swipe gesture mobile
// ============================================================

(function() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sb-overlay');
  const toggleBtn= document.getElementById('sb-toggle');
  const menuBtn  = document.getElementById('topbar-menu-btn');
  let isMobile   = () => window.innerWidth <= 768;

  // ── COLLAPSE / EXPAND (desktop) ──
  function toggleCollapse() {
    if (isMobile()) return;
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sb_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
  }

  // ── OPEN / CLOSE (mobile) ──
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

  if (toggleBtn) toggleBtn.addEventListener('click', toggleCollapse);
  if (menuBtn)   menuBtn.addEventListener('click', () => { isMobile() ? openMobile() : toggleCollapse(); });
  if (overlay)   overlay.addEventListener('click', closeMobile);

  // ── RESTORE SAVED STATE ──
  if (!isMobile() && localStorage.getItem('sb_collapsed') === '1') {
    sidebar.classList.add('collapsed');
  }

  // ── SWIPE GESTURE (mobile) ──
  let touchStartX = 0, touchStartY = 0;

  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!isMobile()) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (dy > 60) return; // terlalu vertikal → skip

    // Swipe kanan dari tepi kiri → buka sidebar
    if (dx > 60 && touchStartX < 40 && !sidebar.classList.contains('mobile-open')) {
      openMobile();
    }
    // Swipe kiri saat sidebar terbuka → tutup
    if (dx < -60 && sidebar.classList.contains('mobile-open')) {
      closeMobile();
    }
  }, { passive: true });

  // ── AUTO CLOSE saat resize ke desktop ──
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      closeMobile();
      document.body.style.overflow = '';
    }
  });

  // ── CLOSE sidebar mobile saat klik nav item ──
  document.querySelectorAll('.sb-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isMobile()) closeMobile();
    });
  });

  // ── UPDATE PAGE TITLE di topbar ──
  window._setTopbarTitle = function(title) {
    const el = document.getElementById('topbar-page-title');
    if (el) el.textContent = title;
  };
})();
