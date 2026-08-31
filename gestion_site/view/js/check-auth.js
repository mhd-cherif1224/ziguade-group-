// Include this script FIRST (before any other page logic) on every
// protected admin page. It replaces the old server-side requirePageAuth
// cookie check — since there's no cookie anymore, the browser can't
// enforce this on page load automatically, so we do it here instead.

(async function checkAuth() {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = '/html/login-admin.html';
    return;
  }

  try {
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/html/login-admin.html';
      return;
    }

    // Auth confirmed — reveal the page.
    document.body.style.visibility = 'visible';
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = '/html/login-admin.html';
  }
})();