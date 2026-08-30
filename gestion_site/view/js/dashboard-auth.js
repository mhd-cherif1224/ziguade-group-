// Runs on dashboard load — confirms the session is valid,
// and displays the logged-in admin's info if you have a place for it.
(async () => {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });

    if (!res.ok) {
      window.location.href = '/html/login-admin.html';
      return;
    }

    const data = await res.json();
    console.log('Connecté en tant que:', data.admin.username);

    // Optional: if you have an element to show the admin's name, e.g.:
    // document.getElementById('admin-name').textContent = data.admin.username;

  } catch (err) {
    console.error('Erreur de vérification de session:', err);
    window.location.href = '/html/login-admin.html';
  }
})();

// Logout handler — wire this to a logout button if you have one, e.g.:
// <button id="logoutBtn">Déconnexion</button>
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/html/login-admin.html';
  });
}