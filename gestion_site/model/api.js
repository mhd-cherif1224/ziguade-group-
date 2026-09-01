const express = require("express");
const db = require("../Controller/db");
const multer = require("multer");
const path = require("path");

const {
    sendTextMessage,
    sendMediaMessage,
    sendTemplateMessage,
    getMessageTemplates
} = require("../Controller/whatsapp");

const { getClients } = require("./api-client");

const router = express.Router();
const fs = require("fs");
/* ============================================================
   CONFIGURATION
============================================================ */
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const WHATSAPP_VERIFY_TOKEN =
    process.env.WHATSAPP_VERIFY_TOKEN;

// CHANGE THIS TO YOUR PUBLIC DOMAIN
const BASE_MEDIA_URL = process.env.API_URL+"/uploads/";

/* ============================================================
   DATABASE
============================================================ */

async function query(sql, params = []) {
    const [rows] = await db.query(sql, params);
    return rows;
}

/* ============================================================
   MULTER
============================================================ */

const storage = multer.diskStorage({

    destination(req, file, cb) {
        cb(null, "uploads/");
    },

    filename(req, file, cb) {

        const filename =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, filename);

    }

});

const upload = multer({ storage });

/* ============================================================
   MESSAGE TABLE
============================================================ */

async function getMessages() {

    const rows = await query(

        `SELECT
            m.id,
            m.type,
            m.send_mode,
            m.template_name,
            m.text,
            m.caption,
            m.file_path,
            m.mime_type,
            m.file_size,
            m.date_envoie,
            m.id_client,
            m.direction,
            c.name  AS client_name,
            c.phone AS client_phone
        FROM message m
        LEFT JOIN clients c ON c.id = m.id_client
        ORDER BY m.id DESC`

    );

    return rows.map(row => ({

        id: row.id,
        type: row.type,
        send_mode: row.send_mode,
        template_name: row.template_name,
        text: row.text,
        caption: row.caption,

        file: row.file_path
            ? {
                path: row.file_path,
                mime_type: row.mime_type,
                size: row.file_size
            }
            : null,

        date_envoie: row.date_envoie,
        direction: row.direction,
        client_id: row.id_client,
        client_name: row.client_name,
        client_phone: row.client_phone

    }));

}

async function downloadWhatsAppMedia(mediaId, mimeType) {
    console.log("Downloading WhatsApp media:", mediaId);

    // 1. Get the temporary media URL from Meta
    const mediaResponse = await fetch(
        `https://graph.facebook.com/v23.0/${mediaId}`,
        {
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`
            }
        }
    );

    if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();

        throw new Error(
            `Failed to get media URL: ${mediaResponse.status} ${errorText}`
        );
    }

    const mediaInfo = await mediaResponse.json();

    console.log("Media URL received");

    // 2. Download the actual file
    const fileResponse = await fetch(mediaInfo.url, {
        headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`
        }
    });

    if (!fileResponse.ok) {
        const errorText = await fileResponse.text();

        throw new Error(
            `Failed to download media: ${fileResponse.status} ${errorText}`
        );
    }

    // 3. Convert response to Buffer
    const buffer = Buffer.from(
        await fileResponse.arrayBuffer()
    );

    // 4. Make sure incoming directory exists
    const incomingDir = path.join(
        __dirname,
        "../uploads/incoming"
    );

    await fs.promises.mkdir(
        incomingDir,
        { recursive: true }
    );

    // 5. Determine extension
    const extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "audio/ogg": ".ogg",
        "audio/mpeg": ".mp3",
        "application/pdf": ".pdf"
    };

    const extension =
        extensions[mimeType] || "";

    const filename =
        `${Date.now()}-${mediaId}${extension}`;

    const filePath =
        path.join(incomingDir, filename);

    // 6. Save file
    await fs.promises.writeFile(
        filePath,
        buffer
    );

    console.log(
        "Incoming media saved:",
        filePath
    );

    // 7. Return browser-accessible path
    return {
        path: `/uploads/incoming/${filename}`,
        mime_type: mimeType,
        size: buffer.length
    };
}

async function createMessage({

    type,
    text = null,
    caption = null,
    file = null,
    sendMode = "reponse",
    templateName = null,
    idClient = null,
    direction = "sent"

}) {

    const result = await query(

        `INSERT INTO message
        (
            type,
            send_mode,
            template_name,
            text,
            caption,
            file_path,
            mime_type,
            file_size,
            id_client,
            direction,
            date_envoie
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,

        [

            type,
            sendMode,
            templateName,
            text,
            caption,

            file?.path || null,
            file?.mime_type || null,
            file?.size || null,

            idClient,
            direction

        ]

    );

    return {

        id: result.insertId,

        type,
        send_mode: sendMode,
        template_name: templateName,

        text,
        caption,

        file,

        id_client: idClient,
        direction,

        date_envoie: new Date()

    };

}

/* ============================================================
   CLIENTS — find or create by phone
   Used by the webhook so an incoming message can be linked to
   the client who sent it (id_client on `message`).
============================================================ */

async function findOrCreateClientByPhone(phone, name = null) {

    const existing = await query(

        `SELECT id, name, phone FROM clients WHERE phone = ?`,

        [phone]

    );

    if (existing.length) return existing[0];

    const result = await query(

        `INSERT INTO clients (name, phone) VALUES (?, ?)`,

        [name || phone, phone]

    );

    return { id: result.insertId, name: name || phone, phone };

}

/* ============================================================
   CLIENTS_MESSAGE TABLE
============================================================ */

async function createClientMessage(

    idClient,
    idMessage,
    status = "pending",
    whatsappMessageId = null

) {

    await query(

        `INSERT INTO clients_message
        (
            id_client,
            id_message,
            status,
            whatsapp_message_id
        )
        VALUES (?, ?, ?, ?)`,

        [

            idClient,
            idMessage,
            status,
            whatsappMessageId

        ]

    );

}

async function updateClientMessageStatus(messageId, status) {
    const result = await query(
        `
        UPDATE clients_message
        SET status = ?
        WHERE whatsapp_message_id = ?
        `,
        [status, messageId]
    );

    console.log(
        `Status updated: ${messageId} -> ${status}`
    );

    return result;
}

/* ============================================================
   TEMPLATE HELPERS
============================================================ */

function getTemplateHeaderType(template) {

    const header =
        template.components?.find(c => c.type === "HEADER");

    if (!header) return null;

    if (header.format === "IMAGE")
        return "IMAGE";

    if (header.format === "VIDEO")
        return "VIDEO";

    if (header.format === "DOCUMENT")
        return "DOCUMENT";

    return "TEXT";

}

function extractTemplateContent(template) {

    const headerType =
        getTemplateHeaderType(template);

    const body =
        template.components?.find(c => c.type === "BODY");

    let type = "text";

    if (headerType === "IMAGE")
        type = "image";

    if (headerType === "VIDEO")
        type = "video";

    if (headerType === "DOCUMENT")
        type = "document";

    return {

        type,

        text:
            type === "text"
                ? body?.text || null
                : null,

        caption:
            type !== "text"
                ? body?.text || null
                : null

    };

}

async function resolveTemplateContent(name) {

    const templates =
        await getMessageTemplates();

    const template =
        templates.find(

            t =>
                t.name === name &&
                t.status === "APPROVED"

        );

    if (!template)
        throw new Error("Template introuvable.");

    return extractTemplateContent(template);

}

/* ============================================================
   FILE VALIDATION
============================================================ */

function validateHeaderFile(headerType, file) {

    if (!file) return null;

    switch (headerType) {

        case "IMAGE":

            if (
                ![
                    "image/png",
                    "image/jpeg",
                    "image/jpg"
                ].includes(file.mimetype)
            )
                return "Image invalide.";

            if (file.size > 5 * 1024 * 1024)
                return "Image trop grande.";

            break;

        case "VIDEO":

            if (
                ![
                    "video/mp4",
                    "video/3gpp"
                ].includes(file.mimetype)
            )
                return "Vidéo invalide.";

            if (file.size > 16 * 1024 * 1024)
                return "Vidéo trop grande.";

            break;

        case "DOCUMENT":

            if (file.size > 100 * 1024 * 1024)
                return "Document trop grand.";

            break;

    }

    return null;

}

/* ============================================================
   TEMPLATE COMPONENTS
============================================================ */

function buildHeaderComponents(

    headerType,
    file

) {

    if (
        !headerType ||
        headerType === "TEXT" ||
        !file
    )
        return [];

    const mediaKey =
        headerType.toLowerCase();

    const link =
        BASE_MEDIA_URL + file.filename;

    return [

        {

            type: "header",

            parameters: [

                {

                    type: mediaKey,

                    [mediaKey]: {

                        link

                    }

                }

            ]

        }

    ];

}

/* ============================================================
   GET /api/messages
============================================================ */

router.get("/messages", async (req, res) => {

    try {

        const messages = await getMessages();

        res.json(messages);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erreur lors de la récupération des messages."
        });

    }

});

/* ============================================================
   GET /api/messages/:id/clients
============================================================ */

router.get("/messages/:id/clients", async (req, res) => {

    try {

        const rows = await query(

            `SELECT

                c.id,
                c.name,
                c.phone,

                cm.status,
                cm.whatsapp_message_id

            FROM clients_message cm

            INNER JOIN clients c

                ON c.id = cm.id_client

            WHERE cm.id_message = ?

            ORDER BY c.name`,

            [

                req.params.id

            ]

        );

        res.json(rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            error:
                "Erreur lors de la récupération des destinataires."

        });

    }

});

/* ============================================================
   GET /api/clients/:id/conversation
   Fil de discussion WhatsApp complet avec un client donné,
   plus la fenêtre de 24h (gratuite / payante).
============================================================ */

router.get("/clients/:id/conversation", async (req, res) => {

    try {

        const clientId = req.params.id;

        const clientRows = await query(

            `SELECT id, name, phone FROM clients WHERE id = ?`,

            [clientId]

        );

        if (!clientRows.length) {

            return res.status(404).json({

                error: "Client introuvable."

            });

        }

        const rows = await query(

            `SELECT
                id, type, text, caption,
                file_path, mime_type, file_size,
                date_envoie, direction, status
            FROM (
                SELECT
                    m.id,
                    m.type,
                    m.text,
                    m.caption,
                    m.file_path,
                    m.mime_type,
                    m.file_size,
                    m.date_envoie,
                    m.direction,
                    NULL AS status
                FROM message m
                WHERE m.id_client = ?

                UNION ALL

                SELECT
                    m.id,
                    m.type,
                    m.text,
                    m.caption,
                    m.file_path,
                    m.mime_type,
                    m.file_size,
                    m.date_envoie,
                    'sent' AS direction,
                    cm.status AS status
                FROM clients_message cm
                INNER JOIN message m ON m.id = cm.id_message
                WHERE cm.id_client = ?
            ) AS thread
            ORDER BY date_envoie ASC, id ASC`,

            [clientId, clientId]

        );

        const messages = rows.map(row => ({

            id: row.id,
            type: row.type,
            text: row.text,
            caption: row.caption,

            file: row.file_path
                ? {
                    path: row.file_path,
                    mime_type: row.mime_type,
                    size: row.file_size
                }
                : null,

            date_envoie: row.date_envoie,
            direction: row.direction,
            status: row.status

        }));

        const lastReceived =
            [...messages].reverse().find(m => m.direction === "received");

        const windowExpiresAt = lastReceived
            ? new Date(
                new Date(lastReceived.date_envoie).getTime() + 24 * 60 * 60 * 1000
            ).toISOString()
            : null;

        res.json({

            client: clientRows[0],

            window: {
                expires_at: windowExpiresAt
            },

            messages

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            error:
                "Erreur lors de la récupération de la conversation."

        });

    }

});

/* ============================================================
   POST /api/clients/:id/reply
   Envoie un message individuel (texte ou média) au client donné
   via l'API WhatsApp, puis l'enregistre dans `message` avec
   id_client + direction = 'sent' pour qu'il apparaisse dans le
   fil de conversation.
============================================================ */

router.post(
    "/clients/:id/reply",
    upload.single("file"),
    async (req, res) => {

        try {

            const clientId = req.params.id;

            // ============================================================
            // GET CLIENT
            // ============================================================

            const clientRows = await query(
                `SELECT id, name, phone
                 FROM clients
                 WHERE id = ?`,
                [clientId]
            );

            if (!clientRows.length) {
                return res.status(404).json({
                    error: "Client introuvable."
                });
            }

            const client = clientRows[0];

            const {
                text = null,
                caption = null
            } = req.body;

            const hasFile = Boolean(req.file);

            if (!hasFile && !text?.trim()) {
                return res.status(400).json({
                    error: "Le message doit contenir du texte ou un fichier."
                });
            }

            // ============================================================
            // DETERMINE MESSAGE TYPE
            // ============================================================

            let type = "text";
            let file = null;

            if (hasFile) {

                const mime = req.file.mimetype;

                if (mime.startsWith("image/")) {
                    type = "image";
                }
                else if (mime.startsWith("video/")) {
                    type = "video";
                }
                else if (mime.startsWith("audio/")) {
                    type = "audio";
                }
                else {
                    type = "document";
                }

                file = {
                    path: "/uploads/" + req.file.filename,
                    mime_type: mime,
                    size: req.file.size
                };
            }

            // ============================================================
            // SEND TO WHATSAPP
            // ============================================================

            let whatsappResponse = null;

            try {

                if (type === "text") {

                    whatsappResponse = await sendTextMessage(
                        client.phone,
                        text.trim()
                    );

                }
                else {

                    const link =
                        BASE_MEDIA_URL +
                        encodeURIComponent(req.file.filename);

                    console.log(
                        "========== OUTGOING MEDIA =========="
                    );

                    console.log(
                        "Filename:",
                        req.file.filename
                    );

                    console.log(
                        "File exists:",
                        fs.existsSync(
                            path.join(
                                __dirname,
                                "../uploads",
                                req.file.filename
                            )
                        )
                    );

                    console.log(
                        "Media URL:",
                        link
                    );

                    console.log(
                        "===================================="
                    );

                    whatsappResponse = await sendMediaMessage(
                        client.phone,
                        type,
                        link,
                        caption || ""
                    );
                }

                // Debug WhatsApp response
                console.log(
                    "========== WHATSAPP RESPONSE =========="
                );

                console.log(
                    JSON.stringify(
                        whatsappResponse,
                        null,
                        2
                    )
                );

                console.log(
                    "========================================"
                );

            }
            catch (sendErr) {

                console.error(
                    "Erreur d'envoi WhatsApp:",
                    sendErr.response?.data ||
                    sendErr.message
                );

                return res.status(502).json({
                    error: "Échec de l'envoi WhatsApp.",
                    details:
                        sendErr.response?.data ||
                        sendErr.message
                });
            }

            // ============================================================
            // GET WHATSAPP MESSAGE ID
            // ============================================================

            const whatsappMessageId =
                whatsappResponse?.messages?.[0]?.id || null;

            console.log(
                "WhatsApp Message ID:",
                whatsappMessageId
            );

            // ============================================================
            // SAVE MESSAGE
            // ============================================================

            const message = await createMessage({
                type,

                text:
                    type === "text"
                        ? text.trim()
                        : null,

                caption:
                    type !== "text"
                        ? (caption || null)
                        : null,

                file,

                sendMode: "reponse",

                idClient: client.id,

                direction: "sent"
            });

            console.log(
                "Message saved with ID:",
                message.id
            );

            // ============================================================
            // LINK MESSAGE TO CLIENT + WHATSAPP STATUS
            // ============================================================

            await createClientMessage(
                client.id,
                message.id,
                "sent",
                whatsappMessageId
            );

            console.log(
                "clients_message created:",
                {
                    id_client: client.id,
                    id_message: message.id,
                    status: "sent",
                    whatsapp_message_id: whatsappMessageId
                }
            );

            // ============================================================
            // RESPONSE
            // ============================================================

            res.status(201).json({
                ...message,
                status: "sent",
                whatsapp_message_id: whatsappMessageId
            });

        }
        catch (err) {

            console.error(
                "Erreur générale /clients/:id/reply:",
                err
            );

            res.status(500).json({
                error:
                    "Erreur lors de l'envoi de la réponse."
            });
        }
    }
);

/* ============================================================
   POST /api/messages
============================================================ */

router.post(

    "/messages",

    upload.single("file"),

    async (req, res) => {

        try {

            const {

                sendMode = "reponse",

                templateName,

                type,

                text,

                caption,

                clientId

            } = req.body;

            if (sendMode === "template") {

                const resolved =
                    await resolveTemplateContent(templateName);

                const message =
                    await createMessage({

                        type: resolved.type,

                        text: resolved.text,

                        caption: resolved.caption,

                        file: null,

                        sendMode: "template",

                        templateName

                    });

                return res.status(201).json(message);

            }

            let file = null;

            if (req.file) {

                file = {

                    path:
                        "/uploads/" +
                        req.file.filename,

                    mime_type:
                        req.file.mimetype,

                    size:
                        req.file.size

                };

            }

            const message =
                await createMessage({

                    type,

                    text,

                    caption,

                    file,

                    sendMode: "reponse",

                    idClient: clientId || null,

                    direction: "sent"

                });

            res.status(201).json(message);

        } catch (err) {

            console.error(err);

            res.status(500).json({

                error:
                    "Erreur lors de la création du message."

            });

        }

    }

);

/* ============================================================
   POST /api/send
============================================================ */

router.post("/send", async (req, res) => {

    try {

        const {

            to,

            type = "text",

            text,

            mediaType,

            link,

            caption

        } = req.body;

        if (!to) {

            return res.status(400).json({

                error: "Numéro requis."

            });

        }

        let whatsappResponse;

        if (type === "text") {

            whatsappResponse =
                await sendTextMessage(

                    to,
                    text

                );

        }

        else {

            whatsappResponse =
                await sendMediaMessage(

                    to,

                    mediaType || type,

                    link,

                    caption

                );

        }

        res.status(200).json({

            whatsapp: whatsappResponse

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            error:
                "Erreur lors de l'envoi."

        });

    }

});

/* ============================================================
   GET /api/templates
============================================================ */

router.get("/templates", async (req, res) => {

    try {

        const templates =
            await getMessageTemplates();

        res.json(

            templates

                .filter(

                    t =>
                        t.status ===
                        "APPROVED"

                )

                .map(

                    t => ({

                        name:
                            t.name,

                        language:
                            t.language,

                        category:
                            t.category,

                        headerType:
                            getTemplateHeaderType(
                                t
                            )

                    })

                )

        );

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            error:
                "Erreur lors du chargement des templates."

        });

    }

});
/* ============================================================
   POST /api/broadcast
============================================================ */

router.post(

    "/broadcast",

    upload.single("file"),

    async (req, res) => {

        try {

            const {
                templateName,
                languageCode: requestedLanguageCode,
                startId,
                limit
            } = req.body;

            if (!templateName) {

                return res.status(400).json({

                    error:
                        "Template requis."

                });

            }

            /* ==========================
               TEMPLATE
            ========================== */

            const templates =
                await getMessageTemplates();

            const template =
                templates.find(

                    t =>

                        t.name === templateName &&

                        t.status === "APPROVED"

                );

            if (!template) {

                return res.status(400).json({

                    error:
                        "Template introuvable."

                });

            }

            const headerType =
                getTemplateHeaderType(template);

            // Determine language code to use for sending the template.
            // Priority: explicit request param > template.language > fallback 'fr'
            const languageCode =
                requestedLanguageCode || template.language || 'fr';

            const needsFile =
                [

                    "IMAGE",

                    "VIDEO",

                    "DOCUMENT"

                ].includes(headerType);

            if (

                needsFile &&

                !req.file

            ) {

                return res.status(400).json({

                    error:
                        "Ce template nécessite un fichier."

                });

            }

            if (needsFile) {

                const error =
                    validateHeaderFile(

                        headerType,

                        req.file

                    );

                if (error)

                    return res.status(400).json({

                        error

                    });

            }

            /* ==========================
               HEADER COMPONENT
            ========================== */

            const components =
                buildHeaderComponents(

                    headerType,

                    req.file

                );

            /* ==========================
               MESSAGE CONTENT
            ========================== */

            const resolved =
                extractTemplateContent(template);

            /* ==========================
               GET CLIENTS
               Supports two modes:
               - mode=search + clientIds: send only the listed client ids
               - default: load all clients and optionally filter by startId/limit
            ========================== */

            let clients = [];

            // If caller provided an explicit list of client IDs (search mode)
            if (req.body.mode === 'search' && req.body.clientIds) {
                let ids = [];
                try {
                    ids = JSON.parse(req.body.clientIds || '[]');
                } catch (e) {
                    ids = [];
                }

                if (!Array.isArray(ids) || ids.length === 0) {
                    return res.status(400).json({ error: 'Aucun client sélectionné.' });
                }

                // Query only the requested clients
                const placeholders = ids.map(() => '?').join(',');
                const rows = await query(
                    `SELECT id, name, phone FROM clients WHERE id IN (${placeholders})`,
                    ids
                );

                // Preserve the order requested by the clientIds array
                const rowsById = Object.fromEntries(rows.map(r => [String(r.id), r]));
                clients = ids.map(i => rowsById[String(i)]).filter(Boolean);

            } else {
                clients = await getClients();

                if (startId) {
                    clients = clients.filter(c => c.id >= Number(startId));
                }

                if (limit) {
                    clients = clients.slice(0, Number(limit));
                }
            }

            /* ==========================
               INSERT MESSAGE ONCE
            ========================== */

            const message =
                await createMessage({

                    type:
                        resolved.type,

                    text:
                        resolved.text,

                    caption:
                        resolved.caption,

                    file:

                        needsFile

                            ? {

                                  path:
                                      "/uploads/" +
                                      req.file.filename,

                                  mime_type:
                                      req.file.mimetype,

                                  size:
                                      req.file.size

                              }

                            : null,

                    sendMode:
                        "template",

                    templateName

                });

            /* ==========================
               SEND
            ========================== */

            const results = [];

            for (const client of clients) {

                try {

                    const whatsapp =
                        await sendTemplateMessage(

                            client.phone,

                            templateName,

                            languageCode,

                            components

                        );

                    const wamid =
                        whatsapp.messages?.[0]?.id || null;

                    await createClientMessage(

                        client.id,

                        message.id,

                        "pending",

                        wamid

                    );

                    results.push({

                        id_client:
                            client.id,

                        phone:
                            client.phone,

                        status:
                            "pending",

                        wamid

                    });

                }

                catch (err) {

                    console.error(

                        client.phone,

                        err.response?.data ||

                        err.message

                    );

                    await createClientMessage(

                        client.id,

                        message.id,

                        "failed",

                        null

                    );

                    results.push({

                        id_client:
                            client.id,

                        phone:
                            client.phone,

                        status:
                            "failed"

                    });

                }

                await new Promise(

                    resolve =>

                        setTimeout(

                            resolve,

                            300

                        )

                );

            }

            res.json({

                messageId:
                    message.id,

                total:
                    clients.length,

                results

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                error:
                    err.message

            });

        }

    }

);

/* ============================================================
   WEBHOOK
============================================================ */

// GET /api/webhook
router.get("/webhook", (req, res) => {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (

        mode === "subscribe" &&
        token === WHATSAPP_VERIFY_TOKEN

    ) {

        console.log("Webhook verified.");

        return res.status(200).send(challenge);

    }

    res.sendStatus(403);

});

/* ============================================================
   POST /api/webhook
============================================================ */

router.post("/webhook", async (req, res) => {

    res.sendStatus(200);

    try {

        const value =
            req.body.entry?.[0]
                ?.changes?.[0]
                ?.value;

        if (!value)
            return;

        /* ======================================
           CUSTOMER -> YOU
        ====================================== */

        const incoming =
            value.messages?.[0];

        if (incoming) {

            const fromPhone = incoming.from;

            const profileName =
                value.contacts?.[0]?.profile?.name || null;

            const client =
                await findOrCreateClientByPhone(fromPhone, profileName);

            console.log(

                "Incoming message:",

                fromPhone

            );

            if (incoming.type === "text") {

                await createMessage({

                    type: "text",

                    text:
                        incoming.text.body,

                    sendMode:
                        "reponse",

                    idClient:
                        client.id,

                    direction:
                        "received"

                });

            }

            else {

    const media =
        incoming[incoming.type];

    if (!media) {
        console.log(
            "No media data found for:",
            incoming.type
        );

        return;
    }

    let downloadedFile = null;

    try {

        downloadedFile =
            await downloadWhatsAppMedia(
                media.id,
                media.mime_type
            );

    } catch (mediaError) {

        console.error(
            "ERROR DOWNLOADING INCOMING MEDIA:",
            mediaError
        );

        return;
    }

    await createMessage({

        type:
            incoming.type,

        caption:
            media.caption || null,

        file:
            downloadedFile,

        sendMode:
            "reponse",

        idClient:
            client.id,

        direction:
            "received"
    });

}

        }

        /* ======================================
           STATUS UPDATE
        ====================================== */

        const statuses =
            value.statuses || [];

        for (const status of statuses) {

    console.log("========== STATUS ==========");
    console.log(JSON.stringify(status, null, 2));

    if (status.errors) {
        console.log("Errors:", JSON.stringify(status.errors, null, 2));
    }

    await updateClientMessageStatus(
        status.id,
        status.status
    );
}

    }

    catch (err) {

        console.error(

            "Webhook Error:",

            err

        );

    }

});

/* ============================================================
   EXPORT
============================================================ */

module.exports = router;