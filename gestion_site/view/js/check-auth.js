// Include this script FIRST (before any other page logic) on every
// protected admin page. It replaces the old server-side requirePageAuth
// cookie check — since there's no cookie anymore, the browser can't
// enforce this on page load automatically, so we do it here instead.
 
(async function checkAuth() {
  const token = localStorage.getItem('token');
  console.log('[check-auth] token from localStorage:', token);
 
  if (!token) {
    console.log('[check-auth] no token found, redirecting to login');
    window.location.href = '/html/login-admin.html';
    return;
  }
 
  try {
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
 
    console.log('[check-auth] /api/me status:', res.status);
 
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.log('[check-auth] /api/me error body:', body);
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/html/admin-dashboard.html';
      return;
    }
 
    // Auth confirmed — reveal the page.
    document.body.style.visibility = 'visible';
  } catch (err) {
    console.error('[check-auth] fetch failed:', err);
    window.location.href = '/html/admin-dashboard.html';
  }
})();