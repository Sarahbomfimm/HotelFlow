/**
 * Vercel Serverless Function — Envio WhatsApp via Twilio
 * As credenciais ficam seguras no servidor (env vars do Vercel, sem prefixo VITE_).
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.WHATSAPP_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        return res.status(500).json({ error: 'Credenciais Twilio não configuradas no servidor.' });
    }

    const { to, body } = req.body;

    if (!to || !body) {
        return res.status(400).json({ error: 'Parâmetros "to" e "body" são obrigatórios.' });
    }

    const params = new URLSearchParams({
        From: `whatsapp:${fromNumber}`,
        To: `whatsapp:${to}`,
        Body: body,
    });

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message, code: data.code });
        }

        return res.status(200).json({ success: true, sid: data.sid });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
