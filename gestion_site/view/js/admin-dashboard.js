async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');

        if (!response.ok) {
            throw new Error('Erreur');
        }

        const stats = await response.json();

        document.getElementById('stat-admins').textContent = stats.admins;
        document.getElementById('stat-users').textContent = stats.utilisateurs;
        document.getElementById('stat-messages').textContent = stats.messages;
    } catch (err) {
        console.error(err);

        document.getElementById('stat-admins').textContent = '0';
        document.getElementById('stat-users').textContent = '0';
        document.getElementById('stat-messages').textContent = '0';
    }
}

document.addEventListener('DOMContentLoaded', loadDashboard);