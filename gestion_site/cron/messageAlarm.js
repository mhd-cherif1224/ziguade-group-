const cron = require("node-cron");
const Mailjet = require("node-mailjet");

const db = require("../Controller/db");

const mailjet = Mailjet.apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_SECRET_KEY
);


// ============================================================
// DATABASE
// ============================================================

async function query(sql, params = []) {
    const [rows] = await db.query(sql, params);
    return rows;
}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// SEND EMAIL
// ============================================================

async function sendAlarmEmail(message) {

    const clientName =
        message.client_name ||
        message.client_phone ||
        "Client inconnu";

    const phone =
        message.client_phone ||
        "Numéro inconnu";

    const messageText =
        message.text ||
        message.caption ||
        `[${message.type}]`;

    const receivedAt =
        message.date_envoie
            ? new Date(message.date_envoie).toLocaleString("fr-FR")
            : "Date inconnue";


    const html = `
        <div style="font-family: Arial, sans-serif;">

            <h2>Nouvelle réponse WhatsApp</h2>

            <p>
                <strong>Client :</strong>
                ${escapeHtml(clientName)}
            </p>

            <p>
                <strong>Téléphone :</strong>
                ${escapeHtml(phone)}
            </p>

            <p>
                <strong>Message :</strong>
            </p>

            <div style="
                padding: 15px;
                background: #f3f3f3;
                border-radius: 8px;
                margin-bottom: 15px;
            ">
                ${escapeHtml(messageText)}
            </div>

            <p>
                <strong>Reçu le :</strong>
                ${escapeHtml(receivedAt)}
            </p>

            <hr>

            <p>
                Une nouvelle réponse client nécessite votre attention.
            </p>

        </div>
    `;


    await mailjet
        .post("send", { version: "v3.1" })
        .request({
            Messages: [
                {
                    From: {
                        Email: process.env.MAILJET_FROM_EMAIL,
                        Name:
                            process.env.MAILJET_FROM_NAME ||
                            "Ziguade"
                    },

                    To: [
                        {
                            Email:
                                process.env.MAILJET_ALERT_EMAIL
                        }
                    ],

                    Subject:
                        `Nouvelle réponse WhatsApp - ${clientName}`,

                    HTMLPart: html
                }
            ]
        });


    console.log(
        `EMAIL ALARM SENT - message #${message.id}`
    );
}


// ============================================================
// CHECK NEW MESSAGES
// ============================================================

async function checkNewMessages() {

    try {

        const messages = await query(`
            SELECT
                m.id,
                m.type,
                m.send_mode,
                m.template_name,
                m.text,
                m.caption,
                m.date_envoie,
                m.direction,
                m.id_client,

                c.name AS client_name,
                c.phone AS client_phone

            FROM message m

            LEFT JOIN clients c
                ON c.id = m.id_client

            WHERE m.direction = 'received'
              AND m.send_mode = 'reponse'
              AND m.email_alarm_sent = 0

            ORDER BY m.id ASC
        `);


        if (messages.length === 0) {
            return;
        }


        console.log(
            `Found ${messages.length} new WhatsApp response(s)`
        );


        for (const message of messages) {

            try {

                // --------------------------------------------
                // SEND EMAIL
                // --------------------------------------------

                await sendAlarmEmail(message);


                // --------------------------------------------
                // MARK AS PROCESSED
                // --------------------------------------------

                await query(`
                    UPDATE message
                    SET email_alarm_sent = 1
                    WHERE id = ?
                `, [
                    message.id
                ]);


            } catch (error) {

                console.error(
                    `EMAIL ALARM FAILED - message #${message.id}`
                );

                console.error(
                    JSON.stringify(
                        error.response?.data ||
                        error.message ||
                        error,
                        null,
                        2
                    )
                );

            }

        }

    } catch (error) {

        console.error(
            "MESSAGE ALARM DATABASE ERROR:"
        );

        console.error(
            JSON.stringify(
                error.response?.data ||
                error.message ||
                error,
                null,
                2
            )
        );

    }

}


// ============================================================
// CRON — EVERY MINUTE
// ============================================================

cron.schedule(
    "* * * * *",
    async () => {

        console.log(
            `[${new Date().toLocaleString("fr-FR")}] Checking messages...`
        );

        await checkNewMessages();

    }
);


console.log(
    "Message alarm cron started - checking every minute."
);


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    checkNewMessages,
    sendAlarmEmail
};