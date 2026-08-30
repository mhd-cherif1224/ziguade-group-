async function loadAdmins() {
    const tbody = document.getElementById('adminsBody');
    

    try {
        const response = await fetch('/api/admins');

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const admins = await response.json();

        tbody.innerHTML = '';

        if (admins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Aucun administrateur trouvé.</td></tr>';
            return;
        }

        admins.forEach((admin) => {
            const row = document.createElement('tr');
            const fullName = [admin.prenom, admin.nom].filter(Boolean).join(' ') || admin.username;

            row.innerHTML = `
                <td>${admin.id}</td>
                <td>
                    <div class="user-cell">
                        <a class="image-link" href="../images/avatar-placeholder.svg" target="_blank" rel="noopener noreferrer">
                            <img src="../images/avatar-placeholder.svg" alt="Photo de ${fullName}">
                        </a>
                        <div>
                            <strong>${fullName}</strong>
                            <span>Administrateur</span>
                        </div>
                    </div>
                </td>
                <td>${admin.username ?? '—'}</td>
                <td>***************</td>
            `;

            tbody.appendChild(row);
        });
    } catch (err) {
        console.error('Erreur lors du chargement des admins:', err);
        tbody.innerHTML = '<tr><td colspan="4">Erreur lors du chargement des administrateurs.</td></tr>';
    }

}

document.addEventListener('DOMContentLoaded', loadAdmins);