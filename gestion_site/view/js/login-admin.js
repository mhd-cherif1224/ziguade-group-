document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('in-username').value.trim();
  const password = document.getElementById('password').value;
  const notification = document.getElementById('notification');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // required so the cookie gets sent/stored
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok) {

    notification.textContent = data.message;
    notification.className = 'success';

    if (data.role === "admin") {

        window.location.href = "admin-dashboard.html";

    } else if (data.role === "utilisateur") {

        window.location.href = "/main/index.html ";

    } else {

        notification.textContent = "Rôle inconnu.";
        notification.className = "error";

    }

} else {

    notification.textContent = data.error || 'Erreur de connexion';
    notification.className = 'error';

}
  } catch (err) {
    console.error(err);
    notification.textContent = 'Impossible de contacter le serveur';
    notification.className = 'error';
  }
});

// Optional: toggle password visibility (matches the eye icon in your HTML)
const toggleIcon = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

if (toggleIcon && passwordInput) {
  toggleIcon.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    toggleIcon.classList.toggle('fa-eye');
    toggleIcon.classList.toggle('fa-eye-slash');
  });
}