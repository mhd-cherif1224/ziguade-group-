const pendingMessagesBody = document.getElementById('pendingMessagesBody');
const pendingSearchInput = document.getElementById('pendingSearchInput');

let allPendingMessages = [];

function getDisplayValue(value, fallback = '—') {
    return value ?? fallback;
}

function getClientName(message) {
    return getDisplayValue(
        message.client_name ??
        message.clientName ??
        message.sender_name ??
        message.senderName ??
        message.receiver_name ??
        message.receiverName ??
        message.client_phone ??
        message.clientPhone ??
        message.phone ??
        message.user_name ??
        message.userName ??
        null,
        'Client'
    );
}

function getMessageText(message) {
    return getDisplayValue(
        message.text ??
        message.caption ??
        message.message ??
        message.body ??
        null,
        '—'
    );
}

function formatDate(dateValue) {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('fr-FR');
}

function isPendingMessage(message) {
    const direction = String(message.direction ?? '').toLowerCase();
    const sendMode = String(message.send_mode ?? '').toLowerCase();
    return direction === 'received' || sendMode === 'reponse';
}

function getSearchableText(message) {
    return [
        getClientName(message),
        message.type,
        getMessageText(message),
        message.status,
        message.file?.path,
        message.file?.mime_type
    ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();
}

function renderPendingMessages(messages) {
    if (!pendingMessagesBody) return;

    pendingMessagesBody.innerHTML = '';

    if (!messages.length) {
        pendingMessagesBody.innerHTML = '<tr><td colspan="5">Aucun message à répondre pour le moment.</td></tr>';
        return;
    }

    messages.forEach((message) => {
        const row = document.createElement('tr');
        row.classList.add('pending-row');

        const clientName = getClientName(message);
        const messageText = getMessageText(message);
        const type = getDisplayValue(message.type, '—');

        row.innerHTML = `
            <td>${formatDate(message.date_envoie)}</td>
            <td><strong>${clientName}</strong></td>
            <td>${type}</td>
            <td class="message-content">${messageText}</td>
            <td><span class="pending-status">À répondre</span></td>
        `;

        pendingMessagesBody.appendChild(row);
    });
}

function applyPendingSearch() {
    const term = (pendingSearchInput?.value ?? '').trim().toLowerCase();

    if (!term) {
        renderPendingMessages(allPendingMessages);
        return;
    }

    const filtered = allPendingMessages.filter((message) =>
        getSearchableText(message).includes(term)
    );

    renderPendingMessages(filtered);
}

async function loadPendingMessages() {
    try {
        const response = await fetch('/api/messages');

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const messages = await response.json();
        allPendingMessages = Array.isArray(messages)
            ? messages.filter(isPendingMessage)
            : [];

        applyPendingSearch();
    } catch (error) {
        console.error('Erreur lors du chargement des messages non répondus:', error);
        if (pendingMessagesBody) {
            pendingMessagesBody.innerHTML = '<tr><td colspan="5">Erreur lors du chargement des messages.</td></tr>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (pendingSearchInput) {
        pendingSearchInput.addEventListener('input', applyPendingSearch);
    }

    loadPendingMessages();
});
