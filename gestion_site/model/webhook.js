
// ================================================================
// WhatsApp Webhook Handler
// Handles:
//   - incoming customer messages
//   - incoming images/videos/audio/documents
//   - status updates for messages you sent
// ================================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../Controller/db');

const router = express.Router();


// ================================================================
// CONFIG
// ================================================================

const WHATSAPP_VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || 'ziguade_secret_123';

const WHATSAPP_ACCESS_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN ||
  process.env.WHATSAPP_TOKEN;

const WHATSAPP_GRAPH_VERSION =
  process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';


// IMPORTANT:
// This should be the same uploads folder that your Express server
// exposes with:
//
// app.use('/uploads', express.static(...))
//
// You can override it with UPLOADS_DIR in .env.
const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  path.join(__dirname, '../uploads');

const INCOMING_MEDIA_DIR =
  path.join(UPLOADS_DIR, 'incoming');


// ================================================================
// DATABASE
// ================================================================

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}


// ================================================================
// CREATE MESSAGE
// ================================================================

async function createMessage({
  type,
  text = null,
  caption = null,
  file = null,
  sendMode = 'reponse',
  templateName = null
}) {
  const result = await query(
    `INSERT INTO message
    (
      \`type\`,
      \`send_mode\`,
      \`template_name\`,
      \`text\`,
      \`caption\`,
      \`file_path\`,
      \`mime_type\`,
      \`file_size\`,
      \`date_envoie\`
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      type,
      sendMode,
      templateName,
      text,
      caption,
      file?.path || null,
      file?.mime_type || null,
      file?.size || null
    ]
  );

  return {
    id: result.insertId,
    type,
    send_mode: sendMode,
    template_name: templateName,
    text,
    caption,
    file
  };
}


// ================================================================
// LINK OUTGOING MESSAGE
// ================================================================

async function linkOutgoingMessage(dbMessageId, waMessageId) {
  if (!dbMessageId || !waMessageId) return;

  await query(
    `UPDATE message
     SET wa_message_id = ?, status = ?
     WHERE id = ?`,
    [
      waMessageId,
      'sent',
      dbMessageId
    ]
  );
}


// ================================================================
// MEDIA HELPERS
// ================================================================

function getExtensionFromMimeType(mimeType) {
  if (!mimeType) {
    return '';
  }

  const mime = mimeType.toLowerCase();

  const extensions = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',

    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'video/mpeg': '.mpeg',

    'audio/aac': '.aac',
    'audio/mp4': '.m4a',
    'audio/mpeg': '.mp3',
    'audio/amr': '.amr',
    'audio/ogg': '.ogg',

    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt'
  };

  return extensions[mime] || '';
}


function sanitizeFileName(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}


// ================================================================
// DOWNLOAD WHATSAPP MEDIA
// ================================================================

async function downloadWhatsAppMedia(mediaId, mimeType) {
  if (!WHATSAPP_ACCESS_TOKEN) {
    throw Error(
      'WHATSAPP_ACCESS_TOKEN is missing from .env'
    );
  }

  if (!mediaId) {
    throw new Error(
      'WhatsApp media ID is missing.'
    );
  }

  // ------------------------------------------------------------
  // STEP 1
  // Ask Meta for the temporary media URL
  // ------------------------------------------------------------

  const mediaInfoResponse = await fetch(
    `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${mediaId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`
      }
    }
  );

  const mediaInfoText =
    await mediaInfoResponse.text();

  let mediaInfo;

  try {
    mediaInfo = JSON.parse(mediaInfoText);
  } catch {
    throw new Error(
      `Invalid response from WhatsApp media API: ${mediaInfoText}`
    );
  }

  if (!mediaInfoResponse.ok) {
    throw new Error(
      `WhatsApp media info error: ${JSON.stringify(mediaInfo)}`
    );
  }

  const mediaUrl = mediaInfo.url;

  if (!mediaUrl) {
    throw new Error(
      `WhatsApp did not return a media URL for ${mediaId}`
    );
  }

  const finalMimeType =
    mediaInfo.mime_type ||
    mimeType ||
    'application/octet-stream';

  // ------------------------------------------------------------
  // STEP 2
  // Download the actual file
  // ------------------------------------------------------------

  const fileResponse = await fetch(
    mediaUrl,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`
      }
    }
  );

  if (!fileResponse.ok) {
    const errorText =
      await fileResponse.text();

    throw new Error(
      `WhatsApp media download failed: HTTP ${fileResponse.status} ${errorText}`
    );
  }

  const arrayBuffer =
    await fileResponse.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  // ------------------------------------------------------------
  // STEP 3
  // Save locally
  // ------------------------------------------------------------

  await fs.promises.mkdir(
    INCOMING_MEDIA_DIR,
    {
      recursive: true
    }
  );

  const extension =
    getExtensionFromMimeType(finalMimeType);

  const fileName =
    `${Date.now()}-${crypto.randomUUID()}${extension}`;

  const fullPath =
    path.join(
      INCOMING_MEDIA_DIR,
      sanitizeFileName(fileName)
    );

  await fs.promises.writeFile(
    fullPath,
    buffer
  );

  // ------------------------------------------------------------
  // STEP 4
  // Return information that goes into MySQL
  // ------------------------------------------------------------

  const publicPath =
    `/uploads/incoming/${encodeURIComponent(fileName)}`;

  return {
    path: publicPath,
    diskPath: fullPath,
    mime_type: finalMimeType,
    size: buffer.length,
    media_id: mediaId
  };
}


// ================================================================
// GET /webhook
// Meta verification
// ================================================================

router.get('/webhook', (req, res) => {
  const mode =
    req.query['hub.mode'];

  const token =
    req.query['hub.verify_token'];

  const challenge =
    req.query['hub.challenge'];

  if (
    mode === 'subscribe' &&
    token === WHATSAPP_VERIFY_TOKEN
  ) {
    console.log(
      'Webhook verified successfully.'
    );

    return res
      .status(200)
      .send(challenge);
  }

  console.warn(
    'Webhook verification failed.'
  );
console.log(`New WhatsApp message from ${from}`);
console.log(`Message type: ${message.type}`);
  return res.sendStatus(403);
});


// ================================================================
// POST /webhook
// ================================================================

router.post('/webhook', async (req, res) => {

  // Respond immediately to Meta.
  res.sendStatus(200);

  try {
    const entries =
      req.body.entry || [];

    for (const entry of entries) {

      for (const change of entry.changes || []) {

        const value =
          change.value || {};

        await Promise.all([
          handleIncomingMessages(
            value.messages
          ),

          handleStatusUpdates(
            value.statuses
          )
        ]);
      }
    }

  } catch (err) {
    console.error(
      'Error processing webhook event:',
      err
    );
  }
});


// ================================================================
// INCOMING CUSTOMER MESSAGES
// ================================================================

async function handleIncomingMessages(messages) {

  if (!Array.isArray(messages)) {
    return;
  }

  for (const message of messages) {

    const from =
      message.from;

    console.log(
      `New WhatsApp message from ${from}`
    );

    console.log(
      `Message type: ${message.type}`
    );

    try {

      // ==========================================================
      // TEXT
      // ==========================================================

      if (message.type === 'text') {

        const text =
          message.text?.body || '';

        console.log(
          `Incoming text: ${text}`
        );

        await createMessage({
          type: 'text',
          text,
          caption: null,
          file: null
        });

        continue;
      }


      // ==========================================================
      // IMAGE / VIDEO / AUDIO / DOCUMENT / STICKER
      // ==========================================================

      const media =
        message[message.type];

      if (!media) {

        console.warn(
          `No media data found for message type ${message.type}`
        );

        continue;
      }

      const mediaId =
        media.id;

      const mimeType =
        media.mime_type || null;

      const caption =
        media.caption || null;

      console.log(
        `Downloading WhatsApp media: ${mediaId}`
      );

      // Download the actual file from WhatsApp
      const downloadedFile =
        await downloadWhatsAppMedia(
          mediaId,
          mimeType
        );

      console.log(
        `Media saved: ${downloadedFile.path}`
      );

      // Save actual path instead of media ID
      await createMessage({
        type: message.type,
        text: null,
        caption,
        file: downloadedFile
      });

      console.log(
        `Incoming ${message.type} saved successfully.`
      );

    } catch (err) {

      console.error(
        `Error saving incoming ${message.type} message:`,
        err
      );
    }
  }
}


// ================================================================
// STATUS UPDATES
// ================================================================

async function handleStatusUpdates(statuses) {

  if (!Array.isArray(statuses)) {
    return;
  }

  for (const status of statuses) {

    const waId =
      status.id;

    const state =
      status.status;

    const error =
      status.errors?.[0] || null;

    try {

      await query(
        `UPDATE message
         SET
           status = ?,
           error_code = ?,
           error_message = ?
         WHERE wa_message_id = ?`,
        [
          state,
          error?.code || null,
          error
            ? `${error.title}: ${error.message}`
            : null,
          waId
        ]
      );

      if (state === 'failed') {

        console.error(
          `[FAILED] wamid=${waId} to=${status.recipient_id} | code=${error?.code} | ${error?.title}: ${error?.message}`
        );

      } else {

        console.log(
          `[${state.toUpperCase()}] wamid=${waId} -> ${status.recipient_id}`
        );
      }

    } catch (err) {

      console.error(
        'Error saving status update:',
        err
      );
    }
  }
}


// ================================================================
// EXPORT
// ================================================================

module.exports = router;

module.exports.linkOutgoingMessage =
  linkOutgoingMessage;

