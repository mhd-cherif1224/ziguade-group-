const tbody = document.getElementById("utilisateursBody");

const modal = document.getElementById("addUserModal");
const form = document.querySelector(".user-form");

const openBtn = document.getElementById("openAddUserModal");
const editBtn = document.getElementById("editUserBtn");
const deleteBtn = document.getElementById("deleteUserBtn");

const closeBtn = document.querySelector(".modal-close");
const cancelBtn = document.querySelector(".btn-cancel");

let selectedUserId = null;
let selectedRow = null;
let editingUserId = null;

// ==========================
// Modal
// ==========================

function openModal() {
    modal.classList.add("show");
}

function closeModal() {
    modal.classList.remove("show");
    form.reset();

    editingUserId = null;

    document.querySelector(".modal-header h2").textContent =
        "Ajouter un utilisateur";

    form.querySelector('button[type="submit"]').textContent =
        "Ajouter";
}

openBtn.addEventListener("click", () => {
    openModal();
});

closeBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// ==========================
// Load Users
// ==========================

async function loadUtilisateurs() {

    selectedUserId = null;
    selectedRow = null;

    tbody.innerHTML = "";

    try {

        const response = await fetch("/api/utilisateurs");

        if (!response.ok) {
            throw new Error("Erreur lors du chargement.");
        }

        const utilisateurs = await response.json();

        if (utilisateurs.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        Aucun utilisateur trouvé.
                    </td>
                </tr>
            `;

            return;
        }

        utilisateurs.forEach(utilisateur => {

            const row = document.createElement("tr");

            const fullName =
                [utilisateur.prenom, utilisateur.nom]
                .filter(Boolean)
                .join(" ")
                || utilisateur.username;

            row.innerHTML = `
                <td>${utilisateur.id}</td>

                <td>
                    <div class="user-cell">

                        <a
                            class="image-link"
                            href="../images/avatar-placeholder.svg"
                            target="_blank">

                            <img
                                src="../images/avatar-placeholder.svg"
                                alt="${fullName}">
                        </a>

                        <div>
                            <strong>${fullName}</strong>
                            <span>Utilisateur</span>
                        </div>

                    </div>
                </td>

                <td>${utilisateur.username}</td>

                <td>**************</td>
            `;

            row.addEventListener("click", () => {

                if (selectedRow) {
                    selectedRow.classList.remove("selected");
                }

                selectedRow = row;
                selectedUserId = utilisateur.id;

                row.classList.add("selected");

            });

            tbody.appendChild(row);

        });

    } catch (err) {

        console.error(err);

        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    Erreur lors du chargement des utilisateurs.
                </td>
            </tr>
        `;
    }
}
// ==========================
// Edit User
// ==========================

editBtn.addEventListener("click", async () => {

    if (selectedUserId === null) {
        alert("Veuillez sélectionner un utilisateur d'abord.");
        return;
    }

    try {

        const response = await fetch(`/api/utilisateurs/${selectedUserId}`);

        if (!response.ok) {
            throw new Error("Impossible de récupérer l'utilisateur.");
        }

        const utilisateur = await response.json();

        document.getElementById("userNom").value =
            utilisateur.nom || "";

        document.getElementById("userPrenom").value =
            utilisateur.prenom || "";

        document.getElementById("userUsername").value =
            utilisateur.username || "";

        document.getElementById("userPassword").value = "";

        editingUserId = utilisateur.id;

        document.querySelector(".modal-header h2").textContent =
            "Modifier un utilisateur";

        form.querySelector('button[type="submit"]').textContent =
            "Enregistrer";

        openModal();

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

});

// ==========================
// Add / Update User
// ==========================

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const nom = document.getElementById("userNom").value.trim();
    const prenom = document.getElementById("userPrenom").value.trim();
    const username = document.getElementById("userUsername").value.trim();
    const password = document.getElementById("userPassword").value.trim();

    if (!username || !password) {
        alert("Le surnom et le mot de passe sont obligatoires.");
        return;
    }

    const url = editingUserId
        ? `/api/utilisateurs/${editingUserId}`
        : "/api/utilisateurs";

    const method = editingUserId
        ? "PUT"
        : "POST";

    try {

        const response = await fetch(url, {

            method,

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                nom,
                prenom,
                username,
                password
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Une erreur est survenue.");
        }

        alert(
            editingUserId
                ? "Utilisateur modifié avec succès."
                : "Utilisateur ajouté avec succès."
        );

        closeModal();

        loadUtilisateurs();

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

});

// ==========================
// Delete User
// ==========================

deleteBtn.addEventListener("click", async () => {

    if (selectedUserId === null) {
        alert("Veuillez sélectionner un utilisateur d'abord.");
        return;
    }

    const confirmation = confirm(
        "Voulez-vous vraiment supprimer cet utilisateur ?"
    );

    if (!confirmation) {
        return;
    }

    try {

        const response = await fetch(
            `/api/utilisateurs/${selectedUserId}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {

            const data = await response.json();

            throw new Error(
                data.error ||
                "Impossible de supprimer l'utilisateur."
            );
        }

        alert("Utilisateur supprimé avec succès.");

        selectedUserId = null;
        selectedRow = null;

        loadUtilisateurs();

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

});

// ==========================
// Initialisation
// ==========================

document.addEventListener("DOMContentLoaded", () => {

    loadUtilisateurs();

});