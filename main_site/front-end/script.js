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


// ============================================================
// TEMPLATES
// ============================================================

let loadedTemplates = [];


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

        console.log('Templates loaded:', templates);

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

        // Make absolutely sure the select is usable
        templateNameInput.disabled = false;
        templateNameInput.style.pointerEvents = 'auto';
        templateNameInput.style.cursor = 'pointer';

    } catch (err) {
        console.error('Error loading templates:', err);

        templateNameInput.innerHTML =
            '<option value="">Erreur de chargement</option>';

        templateNameInput.disabled = false;
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

    // Template has no media header
    if (!rules) {
        templateMediaField.style.display = 'none';

        templateMediaFileInput.required = false;
        templateMediaFileInput.value = '';

        return;
    }

    // Template requires media
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

    previewText.textContent =
        'Le contenu sera rempli à partir du template approuvé.';

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
    }, 2500);
}


// ============================================================
// VALIDATE TEMPLATE SUBMISSION
// ============================================================

function validateSubmission() {
    const templateName = templateNameInput.value.trim();

    if (!templateName) {
        return {
            ok: false,
            message: 'Le nom du template est obligatoire.'
        };
    }

    const template = getSelectedTemplate();

    const headerType = template?.headerType;

    // Template requires media
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
            return {
                ok: false,
                message: error
            };
        }
    }

    return {
        ok: true,
        message: 'Votre template est prêt à être envoyé.'
    };
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
}


// ============================================================
// EVENTS
// ============================================================

templateNameInput.addEventListener('change', () => {
    updateTemplateMediaField();
    updatePreview();
});

templateMediaFileInput.addEventListener(
    'change',
    updatePreview
);

startIdInput.addEventListener(
    'input',
    updateEndId
);

limitInput.addEventListener(
    'input',
    updateEndId
);


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

    try {
        const formData = new FormData();

        // Template information
        formData.append(
            'templateName',
            templateNameInput.value.trim()
        );

        // Recipient range
        formData.append(
            'startId',
            startIdInput.value
        );

        formData.append(
            'limit',
            limitInput.value
        );

        // Template header media
        const template = getSelectedTemplate();

        if (MEDIA_RULES[template?.headerType]) {
            formData.append(
                'file',
                templateMediaFileInput.files[0]
            );
        }

        // Send template broadcast
        const response = await fetch(
            '/api/broadcast',
            {
                method: 'POST',
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Erreur lors de l'envoi."
            );
        }

        showStatus(
            `${data.sent ?? data.total} message(s) envoyé(s) avec succès.`
        );

        // Reset form
        form.reset();

        updateTemplateMediaField();
        updatePreview();
        updateEndId();

    } catch (err) {
        console.error(err);

        showStatus(
            err.message,
            true
        );
    }
});


// ============================================================
// INITIALIZATION
// ============================================================

templateMediaFileInput.multiple = false;

updateEndId();
updateTemplateMediaField();
updatePreview();
loadTemplates();
