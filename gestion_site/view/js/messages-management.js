/* ============================================================
   Contrat API attendu (à adapter si vos endpoints diffèrent) :

   GET  /api/messages
     -> liste des messages, chaque message doit contenir en plus
        des champs déjà utilisés :
          - direction      : 'sent'  (envoyé par l'entreprise/admin)
                              | 'received' (envoyé par le client)
          - client_id      : identifiant du client concerné par ce
                              message (permet d'ouvrir SA conversation)
          - client_name    : nom du client (optionnel, sinon "—")
          - client_phone   : téléphone du client (optionnel)

   GET  /api/messages/:id/clients
     -> déjà existant : liste des destinataires + statut de lecture
        (utilisé uniquement pour "Voir les infos", donc uniquement
        pertinent pour les messages envoyés par l'entreprise)

   GET  /api/clients/:clientId/conversation
     -> { 
          client: { id, name, phone },
          window: { expires_at: ISOString|null }, // fin de la fenêtre
                                                    // gratuite de 24h
          messages: [
            {
              id, text, caption, type, date_envoie,
              direction: 'sent' | 'received',
              file: { path, size, mime_type } | null
            }, ...
          ]
        }
   ============================================================ */

   const templateMediaFile =
    document.getElementById("templateMediaFile");

const CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/* ------------------------------------------------------------------ */
/* Chargement du tableau des messages                                  */
/* ------------------------------------------------------------------ */

async function loadMessages() {
    const tbody = document.getElementById('messagesBody');

    const colorReponse = '#f29c9c';
    const colorTemplate = '#aef5b3';

    const getDisplayValue = (value, fallback = '—') => value ?? fallback;

    const getSenderLabel = (message) => {
        const senderName =
            message.sender_name ??
            message.senderName ??
            message.from_name ??
            message.fromName ??
            message.client_name ??
            message.clientName ??
            message.client_phone ??
            message.clientPhone ??
            message.phone ??
            null;

        if (message.direction === 'received' || message.send_mode === 'reponse') {
            return getDisplayValue(senderName, 'Client');
        }

        return 'Admin / Entreprise';
    };

    const getReceiverLabel = (message) => {
        const receiverName =
            message.receiver_name ??
            message.receiverName ??
            message.to_name ??
            message.toName ??
            message.client_name ??
            message.clientName ??
            message.client_phone ??
            message.clientPhone ??
            message.phone ??
            null;

        if (message.direction === 'sent' && message.send_mode !== 'reponse') {
            return getDisplayValue(receiverName, 'Client');
        }

        return 'Admin / Entreprise';
    };

    const getRowColor = (message) => {
        const mode = String(message.send_mode ?? '').toLowerCase();

        if (mode === 'template') {
            return colorTemplate;
        }

        if (mode === 'reponse' || message.direction === 'received') {
            return colorReponse;
        }

        return '';
    };

    try {
        const response = await fetch('/api/messages');

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const messages = await response.json();

        tbody.innerHTML = '';

        if (messages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12">Aucun message trouvé.</td></tr>';
            return;
        }

        messages.forEach((message) => {
            const row = document.createElement('tr');
            row.classList.add('message-row');
            row.dataset.id = message.id;

            const rowColor = getRowColor(message);
            if (rowColor) {
                row.style.backgroundColor = rowColor;
                row.style.color = '#111827';
            }

            row.innerHTML = `
                <td>${message.id}</td>
                <td>${message.type}</td>
                <td class="message-preview">${message.send_mode ?? '—'}</td>
                <td>${getSenderLabel(message)}</td>
                <td>${getReceiverLabel(message)}</td>
                <td class="message-preview">${message.text ?? '—'}</td>
                <td class="message-preview">${message.caption ?? '—'}</td>
                <td>${message.file ? message.file.path : '—'}</td>
                <td>${message.file ? formatBytes(message.file.size) : '—'}</td>
                <td>${message.file ? message.file.mime_type : '—'}</td>
                <td>${new Date(message.date_envoie).toLocaleString('fr-FR')}</td>
                <td><span class="status-badge status-active">${message.status ?? '—'}</span></td>
            `;

            // Stocker le message complet sur la ligne pour le menu contextuel
            row.__message = message;

            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                openRowContextMenu(e, message);
            });

            tbody.appendChild(row);
        });
    } catch (err) {
        console.error('Erreur lors du chargement des messages:', err);
        tbody.innerHTML = '<tr><td colspan="12">Erreur lors du chargement des messages.</td></tr>';
    }
}

/* ------------------------------------------------------------------ */
/* Menu contextuel (clic droit) sur une ligne de message                */
/* ------------------------------------------------------------------ */

let activeContextMenu = null;

function closeContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
        document.removeEventListener('click', closeContextMenu);
        document.removeEventListener('scroll', closeContextMenu, true);
        document.removeEventListener('keydown', onContextMenuKeydown);
    }
}

function onContextMenuKeydown(e) {
    if (e.key === 'Escape') closeContextMenu();
}

// Essaie plusieurs noms de champs possibles côté backend pour retrouver
// l'identifiant du client lié à ce message.
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

function getClientName(message) {
    return (
        message.client_name ??
        message.clientName ??
        message.user_name ??
        message.userName ??
        message.client?.name ??
        message.user?.name ??
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

// D'après les données réelles : send_mode === 'reponse' signifie que le
// message a été envoyé PAR le client (réponse), pas par l'entreprise.
function isFromClient(message) {
    return message.direction === 'received' || message.send_mode === 'reponse';
}

function openRowContextMenu(event, message) {
    closeContextMenu();

    const fromClient = isFromClient(message);
    const clientId = getClientId(message);
    const hasClient = Boolean(clientId);

    if (!hasClient) {
        console.warn(
            'Impossible de trouver un identifiant client sur ce message — "Voir la conversation" restera caché. Objet reçu :',
            message
        );
    }

    const menu = document.createElement('div');
    menu.className = 'message-context-menu';

    // "Voir les infos" : uniquement pertinent pour un message envoyé
    // PAR l'entreprise (statut de lecture par destinataire(s)).
    if (!fromClient) {
        const infoBtn = document.createElement('button');
        infoBtn.type = 'button';
        infoBtn.textContent = 'Voir les infos';
        infoBtn.addEventListener('click', () => {
            closeContextMenu();
            openStatusModal(message.id);
        });
        menu.appendChild(infoBtn);
    }

    // "Voir la conversation" : dispo dès qu'on peut identifier le client.
    if (hasClient) {
        const convoBtn = document.createElement('button');
        convoBtn.type = 'button';
        convoBtn.textContent = 'Voir la conversation';
        convoBtn.addEventListener('click', () => {
            closeContextMenu();
            openConversation(clientId, {
                name: getClientName(message),
                phone: getClientPhone(message)
            });
        });
        menu.appendChild(convoBtn);
    }

    if (!menu.children.length) return; // rien à afficher

    document.body.appendChild(menu);

    // Positionnement en respectant les bords de l'écran
    const { innerWidth, innerHeight } = window;
    const menuRect = menu.getBoundingClientRect();
    let left = event.clientX;
    let top = event.clientY;
    if (left + menuRect.width > innerWidth) left = innerWidth - menuRect.width - 8;
    if (top + menuRect.height > innerHeight) top = innerHeight - menuRect.height - 8;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    activeContextMenu = menu;

    // Fermer au clic ailleurs / scroll / Échap
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu);
        document.addEventListener('scroll', closeContextMenu, true);
        document.addEventListener('keydown', onContextMenuKeydown);
    }, 0);
}

/* ------------------------------------------------------------------ */
/* Modale "Voir les infos" (statut d'envoi par destinataire)           */
/* ------------------------------------------------------------------ */

function statusLabel(status) {
    const map = {
        sent: 'Envoyé',
        delivered: 'Livré',
        read: 'Lu',
        failed: 'Échoué'
    };
    return map[status] || status || '—';
}

function statusBadgeClass(status) {
    if (status === 'failed') return 'status-urgent';
    if (status === 'sent' || status === 'delivered' || status === 'read') return 'status-active';
    return 'status-pending';
}

// Calcule les compteurs (envoyés / livrés / lus / échoués) à partir de la
// liste des destinataires renvoyée par /api/messages/:id/clients.
// "Envoyés" compte tout destinataire dont le message est parti avec
// succès (sent, delivered ou read), pas uniquement le statut 'sent' brut,
// pour refléter le nombre total de messages effectivement expédiés.
function computeStatusCounts(recipients) {
    const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };

    recipients.forEach((r) => {
        const status = r.status;
        if (status === 'sent' || status === 'delivered' || status === 'read') {
            counts.sent += 1;
        }
        if (status === 'delivered' || status === 'read') {
            counts.delivered += 1;
        }
        if (status === 'read') {
            counts.read += 1;
        }
        if (status === 'failed') {
            counts.failed += 1;
        }
    });

    return counts;
}

function renderStatusStats(counts) {
    document.getElementById('statSent').textContent = counts.sent;
    document.getElementById('statDelivered').textContent = counts.delivered;
    document.getElementById('statRead').textContent = counts.read;
    document.getElementById('statFailed').textContent = counts.failed;
}

function resetStatusStats() {
    renderStatusStats({ sent: 0, delivered: 0, read: 0, failed: 0 });
}

async function openStatusModal(messageId) {
    const modal = document.getElementById('statusModal');
    const title = document.getElementById('statusModalTitle');
    const body = document.getElementById('statusModalBody');

    title.textContent = `Statut d'envoi — Message #${messageId}`;
    body.innerHTML = '<tr><td colspan="3">Chargement...</td></tr>';
    resetStatusStats();
    modal.classList.add('show');

    try {
        const response = await fetch(`/api/messages/${messageId}/clients`);

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const recipients = await response.json();

        renderStatusStats(computeStatusCounts(recipients));

        if (recipients.length === 0) {
            body.innerHTML = '<tr><td colspan="3">Aucun destinataire trouvé pour ce message.</td></tr>';
            return;
        }

        body.innerHTML = '';
        recipients.forEach((r) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${r.name ?? '—'}</td>
                <td>${r.phone ?? '—'}</td>
                <td><span class="status-badge ${statusBadgeClass(r.status)}">${statusLabel(r.status)}</span></td>
            `;
            body.appendChild(row);
        });
    } catch (err) {
        console.error('Erreur lors du chargement du statut des destinataires:', err);
        body.innerHTML = '<tr><td colspan="3">Erreur lors du chargement des destinataires.</td></tr>';
    }
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.remove('show');
}

/* ------------------------------------------------------------------ */
/* Vue "conversation" façon WhatsApp                                   */
/* ------------------------------------------------------------------ */

let conversationTimerInterval = null;
let currentConversationClientId = null;
let conversationStatusPollInterval = null;

const CONVERSATION_POLL_MS = 4000; // fréquence de rafraîchissement des statuts / nouveaux messages
const TABLE_POLL_MS = 10000;       // fréquence de rafraîchissement du tableau des messages
let tablePollInterval = null;

function closeConversation() {
    const view = document.getElementById('conversationView');
    view.classList.remove('show');
    view.setAttribute('aria-hidden', 'true');

    currentConversationClientId = null;
    resetComposer();

    if (conversationTimerInterval) {
        clearInterval(conversationTimerInterval);
        conversationTimerInterval = null;
    }

    if (conversationStatusPollInterval) {
        clearInterval(conversationStatusPollInterval);
        conversationStatusPollInterval = null;
    }
}

function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function startConversationTimer(expiresAt) {
    const timerEl = document.getElementById('conversationTimer');
    const statusEl = document.getElementById('conversationWindowStatus');

    if (conversationTimerInterval) {
        clearInterval(conversationTimerInterval);
        conversationTimerInterval = null;
    }

    if (!expiresAt) {
        timerEl.textContent = '--:--:--';
        statusEl.textContent = 'Fenêtre inconnue';
        statusEl.className = 'conversation-window-status unknown';
        setComposerBlocked(false); // pas d'historique reçu : on autorise l'envoi par défaut
        return;
    }

    const expiryTime = new Date(expiresAt).getTime();

    const tick = () => {
        const remaining = expiryTime - Date.now();

        if (remaining <= 0) {
            timerEl.textContent = '00:00:00';
            statusEl.textContent = 'La fenêtre de 24h est terminée, les messages sont payants';
            statusEl.className = 'conversation-window-status expired';
            setComposerBlocked(true);
            clearInterval(conversationTimerInterval);
            conversationTimerInterval = null;
            return;
        }

        timerEl.textContent = formatCountdown(remaining);
        statusEl.textContent = 'Les messages sont gratuits';
        statusEl.className = 'conversation-window-status active';
        setComposerBlocked(false);
    };

    tick();
    conversationTimerInterval = setInterval(tick, 1000);
}

// Construit (ou met à jour) le petit indicateur de statut ✓ / ✓✓ / ✓✓ bleu
// pour un message envoyé. Réutilisé au premier rendu ET à chaque poll.
// Comme getClientId/getClientName/getClientPhone : le backend peut
// nommer ce champ différemment selon l'endpoint. On essaie les variantes
// les plus probables avant d'abandonner (auquel cas aucun tick ne
// s'affichera, ce qui trahit un souci de nommage côté API plutôt qu'un
// bug de rendu).
function getMessageStatus(msg) {
    return (
        msg.status ??
        msg.delivery_status ??
        msg.deliveryStatus ??
        msg.message_status ??
        msg.messageStatus ??
        msg.whatsapp_status ??
        msg.whatsappStatus ??
        msg.read_status ??
        msg.readStatus ??
        null
    );
}

// Icônes SVG façon WhatsApp (un seul chemin = envoyé, deux chemins
// superposés = livré/lu). currentColor permet de gérer la couleur
// (gris pour livré, bleu pour lu) uniquement via le CSS.
const TICK_SINGLE_SVG =
    '<svg viewBox="0 0 16 15" width="16" height="15"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z"/></svg>';

const TICK_DOUBLE_SVG =
    '<svg viewBox="0 0 16 15" width="16" height="15"><path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.34.146l-.371.406a.47.47 0 0 0 0 .656l3.15 3.05a.45.45 0 0 0 .336.146.457.457 0 0 0 .361-.19l6.762-8.47a.5.5 0 0 0-.06-.652l-.222-.386z" transform="translate(-1)"/><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z"/></svg>';

function buildStatusEl(msg) {
    const status = document.createElement('span');
    status.className = 'message-status';

    const msgStatus = getMessageStatus(msg);
    status.dataset.status = msgStatus || '';

    if (msgStatus === 'read') {
        status.innerHTML = TICK_DOUBLE_SVG;
        status.classList.add('read');
    } else if (msgStatus === 'delivered') {
        status.innerHTML = TICK_DOUBLE_SVG;
        status.classList.add('delivered');
    } else if (msgStatus === 'sent') {
        status.innerHTML = TICK_SINGLE_SVG;
        status.classList.add('sent-only');
    } else if (msgStatus === 'failed') {
        status.textContent = '⚠';
        status.classList.add('failed');
    } else {
        // Statut inconnu/absent : on n'invente pas un ✓ (ce serait trompeur),
        // mais on ne laisse pas non plus un vide silencieux. Un point neutre
        // + un warning en console pour repérer facilement le vrai nom du
        // champ côté backend (regardez l'objet loggé).
        status.textContent = '•';
        status.classList.add('unknown');
        if (!buildStatusEl._warned) {
            console.warn(
                'Aucun champ de statut reconnu sur ce message envoyé — ' +
                'vérifiez le nom exact du champ dans la réponse API. Objet reçu :',
                msg
            );
            buildStatusEl._warned = true;
        }
    }

    return status;
}

// Construit le noeud DOM complet d'un message de conversation.
// Extrait de renderConversationMessages() pour pouvoir être réutilisé
// par le polling temps réel (mergeConversationMessages).
function buildMessageElement(msg) {
    const wrapper = document.createElement('div');

    wrapper.dataset.msgId = msg.id;

    wrapper.className =
        `conversation-message ${
            msg.direction === 'received'
                ? 'received'
                : 'sent'
        }`;

        const bubble = document.createElement('div');
        bubble.className = 'conversation-bubble';

        // =====================================================
        // TEXT
        // =====================================================

        if (msg.text) {
            const text = document.createElement('div');

            text.className = 'conversation-text';
            text.textContent = msg.text;

            bubble.appendChild(text);
        }

        // =====================================================
        // MEDIA
        // =====================================================

        if (msg.file && msg.file.path) {

            const mediaUrl = msg.file.path;
            const mimeType = msg.file.mime_type || '';
            const messageType = msg.type || '';

            // -------------------------
            // IMAGE
            // -------------------------

            if (
                messageType === 'image' ||
                mimeType.startsWith('image/')
            ) {
                const image = document.createElement('img');

                image.className = 'conversation-image';
                image.src = mediaUrl;
                image.alt = 'Image';

                image.addEventListener('click', () => {
                    window.open(
                        mediaUrl,
                        '_blank',
                        'noopener,noreferrer'
                    );
                });

                bubble.appendChild(image);
            }

            // -------------------------
            // VIDEO
            // -------------------------

            else if (
                messageType === 'video' ||
                mimeType.startsWith('video/')
            ) {
                const video = document.createElement('video');

                video.className = 'conversation-video';
                video.src = mediaUrl;
                video.controls = true;
                video.preload = 'metadata';

                bubble.appendChild(video);
            }

            // -------------------------
            // AUDIO
            // -------------------------

            else if (
                messageType === 'audio' ||
                mimeType.startsWith('audio/')
            ) {
                const audio = document.createElement('audio');

                audio.className = 'conversation-audio';
                audio.src = mediaUrl;
                audio.controls = true;

                bubble.appendChild(audio);
            }

            // -------------------------
            // DOCUMENT
            // -------------------------

            else if (messageType === 'document') {
                const link = document.createElement('a');

                link.className =
                    'conversation-document';

                link.href = mediaUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';

                link.textContent =
                    '📄 Ouvrir le document';

                bubble.appendChild(link);
            }

            // -------------------------
            // OTHER FILE
            // -------------------------

            else {
                const link = document.createElement('a');

                link.className =
                    'conversation-document';

                link.href = mediaUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';

                link.textContent =
                    '📎 Ouvrir le fichier';

                bubble.appendChild(link);
            }

            // -------------------------
            // CAPTION
            // -------------------------

            if (msg.caption) {
                const caption =
                    document.createElement('div');

                caption.className =
                    'conversation-text conversation-caption';

                caption.textContent =
                    msg.caption;

                bubble.appendChild(caption);
            }
        }

        // =====================================================
        // TIME (+ statut, sur la même ligne, comme WhatsApp)
        // =====================================================

        const time =
            document.createElement('div');

        time.className =
            'conversation-time';

        const timeText = document.createElement('span');
        timeText.textContent = msg.date_envoie
            ? new Date(msg.date_envoie).toLocaleTimeString(
                'fr-FR',
                {
                    hour: '2-digit',
                    minute: '2-digit'
                }
            )
            : '';
        time.appendChild(timeText);

        if (msg.direction === 'sent') {
            time.appendChild(buildStatusEl(msg));
        }

        bubble.appendChild(time);

        wrapper.appendChild(bubble);

        return wrapper;
}

function renderConversationMessages(messages) {
    const container = document.getElementById('conversationMessages');

    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML =
            '<div class="conversation-empty">Aucun message dans cette conversation.</div>';
        return;
    }

    messages.forEach((msg) => {
        container.appendChild(buildMessageElement(msg));
    });

    container.scrollTop =
        container.scrollHeight;
}

// ------------------------------------------------------------------
// Mise à jour "live" (polling) : au lieu de tout reconstruire (ce qui
// ferait sauter le scroll pendant que l'admin lit), on :
//   - met à jour le tick ✓/✓✓/lu des messages déjà affichés dont le
//     statut a changé
//   - ajoute uniquement les messages qui n'existent pas encore dans le DOM
// ------------------------------------------------------------------
function mergeConversationMessages(messages) {
    const container = document.getElementById('conversationMessages');
    if (!messages || messages.length === 0) return;

    // Si on affichait "Aucun message...", on repart d'un rendu propre.
    if (container.querySelector('.conversation-empty')) {
        renderConversationMessages(messages);
        return;
    }

    const wasNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 80;

    let appendedAny = false;

    messages.forEach((msg) => {
        const existing = container.querySelector(`[data-msg-id="${msg.id}"]`);

        if (existing) {
            // Message déjà affiché : on ne touche qu'au statut (✓/✓✓/lu)
            // s'il a changé, sans re-render toute la bulle.
            if (msg.direction === 'sent') {
                const oldStatusEl = existing.querySelector('.message-status');
                const oldStatus = oldStatusEl?.dataset.status || '';
                const newStatus = getMessageStatus(msg) || '';
                if (oldStatus !== newStatus) {
                    const newStatusEl = buildStatusEl(msg);
                    if (oldStatusEl) {
                        oldStatusEl.replaceWith(newStatusEl);
                    } else {
                        existing.querySelector('.conversation-time')?.appendChild(newStatusEl);
                    }
                }
            }
        } else {
            // Nouveau message (ex: réponse reçue du client en direct)
            container.appendChild(buildMessageElement(msg));
            appendedAny = true;
        }
    });

    if (appendedAny && wasNearBottom) {
        container.scrollTop = container.scrollHeight;
    }
}
// Poll léger : on refetch la conversation régulièrement et on ne touche
// au DOM que pour ce qui a changé (voir mergeConversationMessages).
// C'est un simple "refresh basé sur polling" — si votre backend expose
// un WebSocket/SSE pour les accusés WhatsApp (sent/delivered/read), il
// vaut mieux brancher ça dessus (voir note en bas de fichier), mais le
// polling fonctionne avec l'API REST déjà en place sans rien changer
// côté serveur.
function startConversationStatusPolling(clientId) {
    if (conversationStatusPollInterval) {
        clearInterval(conversationStatusPollInterval);
        conversationStatusPollInterval = null;
    }

    conversationStatusPollInterval = setInterval(async () => {
        // Si l'utilisateur a fermé la conversation ou changé de client
        // entre-temps, on s'arrête.
        if (currentConversationClientId !== clientId) {
            clearInterval(conversationStatusPollInterval);
            conversationStatusPollInterval = null;
            return;
        }

        try {
            const response = await fetch(`/api/clients/${clientId}/conversation`);
            if (!response.ok) return; // on ignore silencieusement une erreur ponctuelle de poll

            const data = await response.json();
            mergeConversationMessages(data.messages);

            // La fenêtre de 24h peut aussi bouger si un nouveau message
            // client vient d'arriver : on la met à jour aussi.
            let expiresAt = data.window?.expires_at || null;
            if (!expiresAt && data.messages?.length) {
                const lastReceived = [...data.messages]
                    .reverse()
                    .find((m) => m.direction === 'received');
                if (lastReceived) {
                    expiresAt = new Date(
                        new Date(lastReceived.date_envoie).getTime() + CONVERSATION_WINDOW_MS
                    ).toISOString();
                }
            }
            startConversationTimer(expiresAt);
        } catch (err) {
            console.error('Erreur lors du polling de la conversation:', err);
        }
    }, CONVERSATION_POLL_MS);
}

async function openConversation(clientId, fallbackInfo = {}) {
    const view = document.getElementById('conversationView');
    const title = document.getElementById('conversationTitle');
    const phone = document.getElementById('conversationPhone');
    const messagesContainer = document.getElementById('conversationMessages');
    const timerEl = document.getElementById('conversationTimer');
    const statusEl = document.getElementById('conversationWindowStatus');

    currentConversationClientId = clientId;
    resetComposer();

    title.textContent = fallbackInfo.name || 'Conversation';
    phone.textContent = fallbackInfo.phone || '';
    timerEl.textContent = '--:--:--';
    statusEl.textContent = 'Chargement...';
    statusEl.className = 'conversation-window-status unknown';
    messagesContainer.innerHTML = '<div class="conversation-loading">Chargement de la conversation...</div>';

    view.classList.add('show');
    view.setAttribute('aria-hidden', 'false');

    try {
        const response = await fetch(`/api/clients/${clientId}/conversation`);

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();

        title.textContent = data.client?.name || fallbackInfo.name || 'Conversation';
        phone.textContent = data.client?.phone || fallbackInfo.phone || '';

        renderConversationMessages(data.messages);

        // Si le back n'envoie pas explicitement expires_at, on le déduit
        // du dernier message reçu du client + 24h.
        let expiresAt = data.window?.expires_at || null;
        if (!expiresAt && data.messages?.length) {
            const lastReceived = [...data.messages]
                .reverse()
                .find((m) => m.direction === 'received');
            if (lastReceived) {
                expiresAt = new Date(
                    new Date(lastReceived.date_envoie).getTime() + CONVERSATION_WINDOW_MS
                ).toISOString();
            }
        }

        startConversationTimer(expiresAt);
        startConversationStatusPolling(clientId);
    } catch (err) {
        console.error('Erreur lors du chargement de la conversation:', err);
        messagesContainer.innerHTML = '<div class="conversation-error">Erreur lors du chargement de la conversation.</div>';
        statusEl.textContent = 'Erreur';
        statusEl.className = 'conversation-window-status unknown';
    }
}

/* ------------------------------------------------------------------ */
/* Composer — répondre directement dans la conversation                */
/* ------------------------------------------------------------------ */

function resetComposer() {
    const textInput = document.getElementById('conversationTextInput');
    const fileInput = document.getElementById('conversationFileInput');
    const fileName = document.getElementById('conversationFileName');

    textInput.value = '';
    fileInput.value = '';
    fileName.style.display = 'none';
    setComposerBlocked(false);
}

function setComposerBlocked(blocked) {
    const composer = document.getElementById('conversationComposer');
    const blockedMsg = document.getElementById('conversationBlocked');

    composer.style.display = blocked ? 'none' : 'flex';
    blockedMsg.style.display = blocked ? 'block' : 'none';
}

function getMessageId(message) {
    return (
        message.id ??
        message.message_id ??
        message.messageId ??
        message._id ??
        null
    );
}

function appendSentMessage(message) {
    const container = document.getElementById('conversationMessages');

    const empty = container.querySelector('.conversation-empty');
    if (empty) empty.remove();

    // On force direction: 'sent' au cas où la réponse de /reply ne le
    // renvoie pas explicitement, et on garde un id stable (data-msg-id)
    // pour que le polling puisse reconnaître ce message plus tard au
    // lieu de le dupliquer.
    const id = getMessageId(message) ?? `local-${Date.now()}`;

    const wrapper = buildMessageElement({
        ...message,
        id,
        direction: 'sent'
    });

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

async function sendConversationReply(event) {
    event.preventDefault();

    if (!currentConversationClientId) return;

    const textInput = document.getElementById('conversationTextInput');
    const fileInput = document.getElementById('conversationFileInput');
    const sendBtn = document.getElementById('conversationSendBtn');

    const text = textInput.value.trim();
    const file = fileInput.files[0];

    if (!text && !file) return;

    const formData = new FormData();
    if (file) {
        formData.append('file', file);
        if (text) formData.append('caption', text);
    } else {
        formData.append('text', text);
    }

    sendBtn.disabled = true;

    try {
        const response = await fetch(`/api/clients/${currentConversationClientId}/reply`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur lors de l'envoi.");
        }

        // Filet de sécurité : si la réponse du serveur ne renvoie pas le
        // texte/fichier sous les noms de champs attendus (msg.text /
        // msg.file), on complète avec ce que l'admin vient de taper pour
        // que la bulle ne s'affiche jamais vide.
        const optimisticMessage = {
            date_envoie: new Date().toISOString(),
            ...data,
            text: data.text ?? data.body ?? data.message ?? (file ? undefined : text) ?? undefined,
            caption: data.caption ?? (file ? text : undefined) ?? undefined
        };

        appendSentMessage(optimisticMessage);
        resetComposer();

    } catch (err) {
        console.error('Erreur lors de l\'envoi de la réponse:', err);
        alert(err.message || "Erreur lors de l'envoi du message.");
    } finally {
        sendBtn.disabled = false;
    }
}

/* ------------------------------------------------------------------ */
/* Initialisation                                                      */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    loadMessages();

    // Rafraîchit le tableau (statuts sent/delivered/read) périodiquement.
    // On saute le refresh si un menu contextuel est ouvert pour ne pas
    // le faire disparaître sous le curseur de l'admin.
    tablePollInterval = setInterval(() => {
        if (activeContextMenu) return;
        loadMessages();
    }, TABLE_POLL_MS);

    const modal = document.getElementById('statusModal');
    document.getElementById('statusModalClose').addEventListener('click', closeStatusModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeStatusModal();
    });

    document.getElementById('conversationClose').addEventListener('click', closeConversation);

    const composer = document.getElementById('conversationComposer');
    const textInput = document.getElementById('conversationTextInput');
    const fileInput = document.getElementById('conversationFileInput');
    const fileNameEl = document.getElementById('conversationFileName');

    composer.addEventListener('submit', sendConversationReply);

    fileInput.addEventListener('change', function () {
    const file = this.files[0];

    if (!file) return;

    const MB = 1024 * 1024;

    let maxSize;
    let typeName;

    if (file.type.startsWith('image/')) {
        maxSize = 5 * MB;
        typeName = 'image';
    } else if (file.type.startsWith('video/')) {
        maxSize = 16 * MB;
        typeName = 'vidéo';
    } else if (file.type.startsWith('audio/')) {
        maxSize = 100 * MB;
        typeName = 'audio';
    } else {
        maxSize = 100 * MB;
        typeName = 'document';
    }

    if (file.size >= maxSize) {
        alert(
            `Fichier trop volumineux.\n\n` +
            `Type : ${typeName}\n` +
            `Maximum : ${maxSize / MB} MB\n` +
            `Votre fichier : ${(file.size / MB).toFixed(2)} MB`
        );

        this.value = '';
        return;
    }
}); 

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            composer.requestSubmit();
        }
    });
});