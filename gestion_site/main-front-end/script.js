const form = document.getElementById('contentForm');

const templateNameInput = document.getElementById('templateName');
const templateMediaField = document.getElementById('templateMediaField');
const templateMediaLabel = document.getElementById('templateMediaLabel');
const templateMediaFileInput = document.getElementById('templateMediaFile');
const templateMediaHint = document.getElementById('templateMediaHint');

const previewTemplateName = document.getElementById('previewTemplateName');
const previewText = document.getElementById('previewText');
const previewMedia = document.getElementById('previewMedia');

const startIdInput = document.getElementById('startId');
const limitInput = document.getElementById('limit');
const endIdInput = document.getElementById('endId');

const modeSearchBtn = document.getElementById('modeSearchBtn');
const modeRangeBtn = document.getElementById('modeRangeBtn');
const searchModePanel = document.getElementById('searchMode');
const rangeModePanel = document.getElementById('rangeMode');

const clientSearchInput = document.getElementById('clientSearch');
const searchResultsEl = document.getElementById('searchResults');
const optInOnlyInput = document.getElementById('optInOnly');
const selectedClientsEl = document.getElementById('selectedClients');
const audienceCountEl = document.getElementById('audienceCount');

const submitBtn = document.getElementById('submitBtn');
const submitLabel = submitBtn.querySelector('.btn-label');
const submitSpinner = submitBtn.querySelector('.btn-spinner');

const sendProgress = document.getElementById('sendProgress');
const sendProgressFill = document.getElementById('sendProgressFill');
const sendProgressText = document.getElementById('sendProgressText');

const resultBox = document.getElementById('resultBox');
const resultStats = document.getElementById('resultStats');
const retryFailedBtn = document.getElementById('retryFailedBtn');


// ============================================================
// STATE
// ============================================================

let loadedTemplates = [];
let audienceMode = 'search'; // 'search' | 'range'
let selectedClients = new Map(); // id -> { id, name, phone }
let lastFailedClientIds = [];
let searchDebounceTimer = null;


// ============================================================
// MEDIA RULES
// ============================================================

const MEDIA_RULES = {
    IMAGE: {
        accept: 'image/png,image/jpeg,image/jpg',
        allowedTypes: ['image/png', 'image/jpeg', 'image/jpg'],
        maxSize: 5 * 1024 * 1024,
        label: 'Joindre une image',
        hint: 'PNG, JPG, JPEG • maximum 5 Mo',
        sizeError: 'L’image doit faire moins de 5 Mo.',
        typeError: 'L’image doit être au format PNG, JPG ou JPEG.'
    },

    VIDEO: {
        accept: 'video/mp4,video/3gpp',
        allowedTypes: ['video/mp4', 'video/3gpp'],
        maxSize: 16 * 1024 * 1024,
        label: 'Joindre une vidéo',
        hint: 'MP4 ou 3GP • maximum 16 Mo',
        sizeError: 'La vidéo doit faire moins de 16 Mo.',
        typeError: 'La vidéo doit être au format MP4 ou 3GP.'
    },

    DOCUMENT: {
        accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
        allowedTypes: null,
        maxSize: 100 * 1024 * 1024,
        label: 'Joindre un document',
        hint: 'Document • maximum 100 Mo',
        sizeError: 'Le document doit faire moins de 100 Mo.',
        typeError: null
    }
};


// ============================================================
// VALIDATE MEDIA
// ============================================================

function validateMediaFile(headerType, file) {
    const rules = MEDIA_RULES[headerType];

    if (!rules) {
        return null;
    }

    if (rules.allowedTypes && !rules.allowedTypes.includes(file.type)) {
        return rules.typeError;
    }

    if (file.size > rules.maxSize) {
        return rules.sizeError;
    }

    return null;
}


// ============================================================
// LOAD APPROVED TEMPLATES
// ============================================================

async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');

        const templates = await response.json();

        if (!response.ok) {
            throw new Error(
                templates.error || 'Erreur lors du chargement des templates.'
            );
        }

        loadedTemplates = templates;

        if (!templates.length) {
            templateNameInput.innerHTML =
                '<option value="">Aucun template approuvé</option>';
            return;
        }

        templateNameInput.innerHTML =
            '<option value="">Sélectionnez un template</option>' +
            templates.map(template => `
                <option value="${template.name}">
                    ${template.name} (${template.language})
                </option>
            `).join('');

        templateNameInput.disabled = false;

    } catch (err) {
        console.error('Error loading templates:', err);

        templateNameInput.innerHTML =
            '<option value="">Erreur de chargement</option>';

        templateNameInput.disabled = false;
    } finally {
        updateSubmitState();
    }
}


// ============================================================
// GET SELECTED TEMPLATE
// ============================================================

function getSelectedTemplate() {
    return (
        loadedTemplates.find(
            (template) => template.name === templateNameInput.value
        ) || null
    );
}


// ============================================================
// TEMPLATE MEDIA FIELD
// ============================================================

function updateTemplateMediaField() {
    const template = getSelectedTemplate();

    const headerType = template?.headerType;

    const rules = MEDIA_RULES[headerType];

    if (!rules) {
        templateMediaField.style.display = 'none';

        templateMediaFileInput.required = false;
        templateMediaFileInput.value = '';

        return;
    }

    templateMediaField.style.display = 'flex';

    templateMediaFileInput.required = true;
    templateMediaFileInput.accept = rules.accept;

    templateMediaLabel.textContent = rules.label;

    templateMediaHint.textContent =
        `Ce template nécessite un fichier en en-tête • ${rules.hint}`;
}


// ============================================================
// PREVIEW
// ============================================================

function updatePreview() {
    const name = templateNameInput.value;

    previewTemplateName.style.display = 'block';

    previewTemplateName.textContent = name
        ? `Template : ${name}`
        : 'Template : —';

    // Show a sample of the real audience when we have one, so the
    // preview reflects who is actually about to receive it.
    const sampleClient = selectedClients.values().next().value;

    if (name && audienceMode === 'search' && sampleClient) {
        previewText.textContent =
            `Exemple : ce template sera envoyé à ${sampleClient.name || 'ce client'}` +
            (sampleClient.phone ? ` (${sampleClient.phone})` : '') +
            `, et à chaque autre client sélectionné.`;
    } else {
        previewText.textContent =
            'Le contenu sera rempli à partir du template approuvé.';
    }

    previewMedia.innerHTML = '';

    const template = getSelectedTemplate();

    const headerType = template?.headerType;

    if (!MEDIA_RULES[headerType]) {
        return;
    }

    const file = templateMediaFileInput.files[0];

    if (!file) {
        previewMedia.innerHTML =
            '<div class="file-pill">Aucun fichier sélectionné</div>';

        return;
    }

    if (
        template.headerType === 'IMAGE' &&
        file.type.startsWith('image/')
    ) {
        const img = document.createElement('img');

        img.src = URL.createObjectURL(file);
        img.alt = file.name;

        previewMedia.appendChild(img);

        return;
    }

    previewMedia.innerHTML =
        `<div class="file-pill">${file.name}</div>`;
}


// ============================================================
// STATUS MESSAGE
// ============================================================

function showStatus(message, isError = false) {
    const status = document.createElement('div');

    status.className = 'status-msg';

    status.style.color = isError
        ? '#d85a30'
        : '#1D9E75';

    status.textContent = message;

    form.appendChild(status);

    setTimeout(() => {
        status.remove();
    }, 3000);
}


// ============================================================
// AUDIENCE MODE SWITCH
// ============================================================

function setAudienceMode(mode) {
    audienceMode = mode;

    const isSearch = mode === 'search';

    modeSearchBtn.classList.toggle('is-active', isSearch);
    modeRangeBtn.classList.toggle('is-active', !isSearch);

    searchModePanel.hidden = !isSearch;
    rangeModePanel.hidden = isSearch;

    updateAudienceCount();
    updateSubmitState();
}

modeSearchBtn.addEventListener('click', () => setAudienceMode('search'));
modeRangeBtn.addEventListener('click', () => setAudienceMode('range'));


// ============================================================
// CLIENT SEARCH
// ============================================================

async function runClientSearch(query) {
    if (!query.trim()) {
        searchResultsEl.hidden = true;
        searchResultsEl.innerHTML = '';
        return;
    }

    searchResultsEl.hidden = false;
    searchResultsEl.innerHTML = '<div class="search-loading">Recherche…</div>';

    try {
        const params = new URLSearchParams({
            q: query.trim(),
            optInOnly: optInOnlyInput.checked ? '1' : '0'
        });

        const response = await fetch(`/api/clients?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur de recherche.');
        }

        renderSearchResults(Array.isArray(data) ? data : (data.clients || []));

    } catch (err) {
        console.error('Client search error:', err);
        searchResultsEl.innerHTML =
            '<div class="search-empty">Recherche indisponible pour le moment.</div>';
    }
}

function renderSearchResults(clients) {
    if (!clients.length) {
        searchResultsEl.innerHTML =
            '<div class="search-empty">Aucun client trouvé.</div>';
        return;
    }

    searchResultsEl.innerHTML = '';

    clients.forEach((client) => {
        const isAdded = selectedClients.has(String(client.id));

        const row = document.createElement('div');
        row.className = 'search-result-row' + (isAdded ? ' is-added' : '');
        row.innerHTML = `
            <div>
                <div class="search-result-name">${escapeHtml(client.name || 'Client sans nom')}</div>
                <div class="search-result-meta">${escapeHtml(client.phone || '')}</div>
            </div>
            <span>${isAdded ? 'Ajouté' : '+ Ajouter'}</span>
        `;

        if (!isAdded) {
            row.addEventListener('click', () => addClient(client));
        }

        searchResultsEl.appendChild(row);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

clientSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        runClientSearch(clientSearchInput.value);
    }, 300);
});

optInOnlyInput.addEventListener('change', () => {
    if (clientSearchInput.value.trim()) {
        runClientSearch(clientSearchInput.value);
    }
});


// ============================================================
// SELECTED CLIENTS
// ============================================================

function addClient(client) {
    selectedClients.set(String(client.id), client);
    renderSelectedClients();
    updateAudienceCount();
    updateSubmitState();
    updatePreview();

    // Refresh the results list so the added client shows as "Ajouté".
    runClientSearch(clientSearchInput.value);
}

function removeClient(id) {
    selectedClients.delete(String(id));
    renderSelectedClients();
    updateAudienceCount();
    updateSubmitState();
    updatePreview();
}

function renderSelectedClients() {
    if (!selectedClients.size) {
        selectedClientsEl.innerHTML =
            '<p class="muted-empty">Aucun client sélectionné pour l\'instant.</p>';
        return;
    }

    selectedClientsEl.innerHTML = '';

    selectedClients.forEach((client) => {
        const chip = document.createElement('span');
        chip.className = 'client-chip';
        chip.innerHTML = `${escapeHtml(client.name || `Client #${client.id}`)}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '✕';
        removeBtn.setAttribute('aria-label', `Retirer ${client.name || client.id}`);
        removeBtn.addEventListener('click', () => removeClient(client.id));

        chip.appendChild(removeBtn);
        selectedClientsEl.appendChild(chip);
    });
}


// ============================================================
// AUDIENCE COUNT
// ============================================================

function updateAudienceCount() {
    let count = 0;

    if (audienceMode === 'search') {
        count = selectedClients.size;
    } else {
        const start = Number(startIdInput.value) || 0;
        const limit = Number(limitInput.value) || 0;
        count = limit > 0 && start > 0 ? limit : 0;
    }

    audienceCountEl.textContent =
        count === 0
            ? '0 client sélectionné'
            : `${count} client${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`;
}


// ============================================================
// UPDATE END ID
// ============================================================

function updateEndId() {
    const start = Number(startIdInput.value) || 0;
    const limit = Number(limitInput.value) || 0;

    endIdInput.value =
        limit > 0
            ? start + limit - 1
            : '';

    updateAudienceCount();
    updateSubmitState();
}


// ============================================================
// SUBMIT BUTTON STATE
// ============================================================

function updateSubmitState() {
    const hasTemplate = Boolean(templateNameInput.value);

    const hasAudience = audienceMode === 'search'
        ? selectedClients.size > 0
        : (Number(limitInput.value) > 0 && Number(startIdInput.value) > 0);

    submitBtn.disabled = !(hasTemplate && hasAudience);
}


// ============================================================
// VALIDATE TEMPLATE SUBMISSION
// ============================================================

function validateSubmission() {
    const templateName = templateNameInput.value.trim();

    if (!templateName) {
        return { ok: false, message: 'Le nom du template est obligatoire.' };
    }

    if (audienceMode === 'search' && selectedClients.size === 0) {
        return { ok: false, message: 'Sélectionnez au moins un client.' };
    }

    if (audienceMode === 'range' && !(Number(limitInput.value) > 0)) {
        return { ok: false, message: 'Indiquez un nombre de clients valide.' };
    }

    const template = getSelectedTemplate();

    const headerType = template?.headerType;

    if (MEDIA_RULES[headerType]) {
        const file = templateMediaFileInput.files[0];

        if (!file) {
            return {
                ok: false,
                message:
                    `Ce template nécessite un fichier (${MEDIA_RULES[headerType].label.toLowerCase()}).`
            };
        }

        const error = validateMediaFile(headerType, file);

        if (error) {
            return { ok: false, message: error };
        }
    }

    return { ok: true, message: 'Votre template est prêt à être envoyé.' };
}


// ============================================================
// SEND STATE (button + progress bar)
// ============================================================

function setSending(isSending) {
    submitBtn.disabled = isSending || submitBtn.disabled;
    submitSpinner.hidden = !isSending;
    submitLabel.textContent = isSending ? 'Envoi…' : 'Publier';

    sendProgress.hidden = !isSending;

    if (isSending) {
        sendProgressFill.style.width = '10%';
        sendProgressText.textContent = 'Préparation de l\'envoi…';
    }
}

function animateProgress(percent, text) {
    sendProgressFill.style.width = `${percent}%`;
    if (text) sendProgressText.textContent = text;
}


// ============================================================
// RESULTS
// ============================================================

function renderResults(data, totalRequested) {
    resultBox.hidden = false;

    const sent = data.sent ?? data.total ?? 0;
    const failed = data.failed ?? Math.max(totalRequested - sent, 0);

    resultStats.innerHTML = `
        <div class="result-stat">
            <div class="result-stat-value is-success">${sent}</div>
            <div class="result-stat-label">Envoyés</div>
        </div>
        <div class="result-stat">
            <div class="result-stat-value ${failed > 0 ? 'is-error' : ''}">${failed}</div>
            <div class="result-stat-label">Échoués</div>
        </div>
    `;

    lastFailedClientIds = Array.isArray(data.failedIds) ? data.failedIds : [];
    retryFailedBtn.hidden = lastFailedClientIds.length === 0;
}

retryFailedBtn.addEventListener('click', () => {
    if (!lastFailedClientIds.length) return;

    selectedClients.clear();
    lastFailedClientIds.forEach((id) => selectedClients.set(String(id), { id, name: `Client #${id}` }));

    setAudienceMode('search');
    renderSelectedClients();
    updateAudienceCount();
    updateSubmitState();

    showStatus(`${lastFailedClientIds.length} client(s) en échec rechargé(s) dans la sélection.`);
});


// ============================================================
// EVENTS
// ============================================================

templateNameInput.addEventListener('change', () => {
    updateTemplateMediaField();
    updatePreview();
    updateSubmitState();
});

templateMediaFileInput.addEventListener('change', updatePreview);

startIdInput.addEventListener('input', updateEndId);
limitInput.addEventListener('input', updateEndId);


// ============================================================
// FORM SUBMISSION
// ============================================================

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
        return;
    }

    const validation = validateSubmission();

    if (!validation.ok) {
        showStatus(validation.message, true);
        return;
    }

    const totalRequested = audienceMode === 'search'
        ? selectedClients.size
        : Number(limitInput.value) || 0;

    setSending(true);

    try {
        const formData = new FormData();

        formData.append('templateName', templateNameInput.value.trim());
        formData.append('mode', audienceMode);

        if (audienceMode === 'search') {
            formData.append(
                'clientIds',
                JSON.stringify(Array.from(selectedClients.keys()))
            );
        } else {
            formData.append('startId', startIdInput.value);
            formData.append('limit', limitInput.value);
        }

        const template = getSelectedTemplate();

        if (MEDIA_RULES[template?.headerType]) {
            formData.append('file', templateMediaFileInput.files[0]);
        }

        animateProgress(35, `Envoi à ${totalRequested} client${totalRequested > 1 ? 's' : ''}…`);

        const response = await fetch('/api/broadcast', {
            method: 'POST',
            body: formData
        });

        animateProgress(85, 'Finalisation…');

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur lors de l'envoi.");
        }

        animateProgress(100, 'Terminé.');

        renderResults(data, totalRequested);

        showStatus(`${data.sent ?? data.total ?? totalRequested} message(s) envoyé(s) avec succès.`);

        // Reset audience + template, keep results visible.
        selectedClients.clear();
        renderSelectedClients();
        form.reset();

        updateTemplateMediaField();
        updatePreview();
        updateEndId();
        updateAudienceCount();
        updateSubmitState();

    } catch (err) {
        console.error(err);
        showStatus(err.message, true);
    } finally {
        setTimeout(() => setSending(false), 400);
    }
});


// ============================================================
// INITIALIZATION
// ============================================================

templateMediaFileInput.multiple = false;

setAudienceMode('search');
updateEndId();
updateTemplateMediaField();
updatePreview();
updateAudienceCount();
updateSubmitState();
loadTemplates();