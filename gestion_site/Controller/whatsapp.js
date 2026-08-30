const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const axios = require('axios');

const WHATSAPP_URL = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`;



async function sendTextMessage(to, body) {
  const res = await axios.post(
    WHATSAPP_URL,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return res.data;
}

async function sendMediaMessage(to, type, link, caption = '') {
  // type: 'image' | 'video' | 'document' | 'audio'
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type,
    [type]: { link, caption: caption || undefined }
  };

  const res = await axios.post(WHATSAPP_URL, payload, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  return res.data;
}

async function sendTemplateMessage(
  to,
  templateName,
  languageCode,
  components = []
) {
  if (!languageCode) {
    throw new Error(
      `Language code is required for template "${templateName}".`
    );
  }

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components
    }
  };

  console.log(JSON.stringify(payload, null, 2));

  const res = await axios.post(WHATSAPP_URL, payload, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
  console.log(JSON.stringify(payload, null, 2));

  return res.data;
}

// This block appears to be a duplicate and should be removed.

async function getMessageTemplates() {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    },
    params: {
      // Only pull fields we actually need
      fields: 'name,status,category,language,components',
      limit: 100
    }
  });

  return res.data.data; // array of template objects
}


module.exports = { sendTextMessage, sendMediaMessage, sendTemplateMessage, getMessageTemplates };