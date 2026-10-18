const pendingMessagesBody = document.getElementById('pendingMessagesBody');
const pendingSearchInput = document.getElementById('pendingSearchInput');

let allPendingMessages = [];
let activePendingMenu = null;

function closePendingMenu() {
    if (activePendingMenu) {
        activePendingMenu.remove();
        activePendingMenu = null;
        document.removeEventListener('click', closePendingMenu);
        document.removeEventListener('scroll', closePendingMenu, true);
        document.removeEventListener('keydown', onPendingMenuKeydown);
    }
}

function onPendingMenuKeydown(e) {
    if (e.key === 'Escape') closePendingMenu();
}

function getClientId(message) {
    return (
        message.client_id ??
        message.clientId ??
        message.user_id ??
        message.userId ??
        message.sender_id ??
        message.senderId ??
        message.client?.id ??
        message.user?.id ??
        null
    );
}

function getClientPhone(message) {
    return (
        message.client_phone ??
        message.clientPhone ??
        message.phone ??
        message.client?.phone ??
        message.user?.phone ??
        null
    );
}

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
    const seenIds = new Set();

    messages.forEach((message) => {
        if (!message) return;

        const id = String(message.id ?? '');
        if (id && seenIds.has(id)) return;
        if (id) seenIds.add(id);

        const clientKey = getClientKey(message);
        if (!clientKey) return;

        if (!byClient.has(clientKey)) {
            byClient.set(clientKey, []);
        }

        byClient.get(clientKey).push(message);
    });

    const pending = [];

    byClient.forEach((thread) => {
        if (!thread.length) return;

        const sortedThread = [...thread].sort(
            (a, b) => new Date(a.date_envoie || 0) - new Date(b.date_envoie || 0)
        );

        const lastMessage = sortedThread[sortedThread.length - 1];
        if (!lastMessage || !isClientMessage(lastMessage)) return;

        const lastOutboundMessage = [...sortedThread]
            .reverse()
            .find((message) => !isClientMessage(message));

        if (
            !lastOutboundMessage ||
            new Date(lastOutboundMessage.date_envoie || 0) < new Date(lastMessage.date_envoie || 0)
        ) {
            pending.push(lastMessage);
        }
    });

    return pending.sort((a, b) => new Date(b.date_envoie || 0) - new Date(a.date_envoie || 0));
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

        row.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            closePendingMenu();

            const clientId = getClientId(message);
            if (!clientId) return;

            const menu = document.createElement('div');
            menu.className = 'message-context-menu';

            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Voir la conversation';
            button.addEventListener('click', () => {
                closePendingMenu();
                const payload = {
                    clientId,
                    name: getClientName(message),
                    phone: getClientPhone(message)
                };
                localStorage.setItem('pendingConversation', JSON.stringify(payload));
                window.location.href = 'messages-management.html';
            });

            menu.appendChild(button);
            document.body.appendChild(menu);

            const { innerWidth, innerHeight } = window;
            const menuRect = menu.getBoundingClientRect();
            let left = event.clientX;
            let top = event.clientY;
            if (left + menuRect.width > innerWidth) left = innerWidth - menuRect.width - 8;
            if (top + menuRect.height > innerHeight) top = innerHeight - menuRect.height - 8;

            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;

            activePendingMenu = menu;

            setTimeout(() => {
                document.addEventListener('click', closePendingMenu);
                document.addEventListener('scroll', closePendingMenu, true);
                document.addEventListener('keydown', onPendingMenuKeydown);
            }, 0);
        });

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
            ? buildPendingMessages(messages.filter((message) => message && (isClientMessage(message) || !isClientMessage(message))))
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
