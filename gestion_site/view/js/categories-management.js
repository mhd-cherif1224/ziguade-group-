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

function getClientKey(message) {
    const clientId =
        message.client_id ??
        message.clientId ??
        message.user_id ??
        message.userId ??
        message.sender_id ??
        message.senderId ??
        message.client?.id ??
        message.user?.id ??
        null;

    if (clientId) return `client:${clientId}`;

    const fallback =
        message.client_phone ??
        message.clientPhone ??
        message.phone ??
        message.client?.phone ??
        message.user?.phone ??
        getClientName(message) ??
        '';

    const normalizedFallback = String(fallback).trim().toLowerCase();
    return normalizedFallback ? `fallback:${normalizedFallback}` : '';
}

function isClientMessage(message) {
    if (!message) return false;

    const direction = String(message.direction ?? '').toLowerCase();
    const sendMode = String(message.send_mode ?? '').toLowerCase();
    return direction === 'received' || sendMode === 'reponse';
}

function isPendingMessage(message) {
    if (!message) return false;
    return isClientMessage(message) && Boolean(getClientKey(message));
}

function buildPendingMessages(messages) {
    const byClient = new Map();

    messages.forEach((message) => {
        if (!message) return;

        const clientKey = getClientKey(message);
        if (!clientKey || clientKey === 'fallback:') return;

        if (!byClient.has(clientKey)) {
            byClient.set(clientKey, {
                clientName: getClientName(message),
                latestClientMessage: null,
                latestClientDate: null,
                latestOutboundDate: null
            });
        }

        const bucket = byClient.get(clientKey);
        const timestamp = new Date(message.date_envoie || 0).getTime();

        if (isClientMessage(message)) {
            if (!bucket.latestClientMessage || timestamp > new Date(bucket.latestClientMessage.date_envoie || 0).getTime()) {
                bucket.latestClientMessage = message;
                bucket.latestClientDate = timestamp;
            }
            return;
        }

        if (timestamp > (bucket.latestOutboundDate ?? -Infinity)) {
            bucket.latestOutboundDate = timestamp;
        }
    });

    const pending = [];

    byClient.forEach((bucket) => {
        if (!bucket.latestClientMessage) return;

        const latestClientDate = bucket.latestClientDate ?? 0;
        const latestOutboundDate = bucket.latestOutboundDate ?? null;

        if (!latestOutboundDate || latestOutboundDate < latestClientDate) {
            pending.push(bucket.latestClientMessage);
        }
    });

    return pending.sort((a, b) => new Date(b.date_envoie) - new Date(a.date_envoie));
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
            ? buildPendingMessages(messages.filter((message) => isPendingMessage(message) || !isClientMessage(message)))
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
