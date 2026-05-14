/**
 * Vercel Serverless Function — Envio WhatsApp via Twilio
 * As credenciais ficam seguras no servidor (env vars do Vercel, sem prefixo VITE_).
 */

async function verifyFirebaseRequest(req) {
    const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!apiKey || !authHeader || !String(authHeader).startsWith('Bearer ')) {
        return false;
    }

    const idToken = String(authHeader).slice(7).trim();
    if (!idToken) {
        return false;
    }

    try {
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            },
        );

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return Array.isArray(data.users) && data.users.length > 0;
    } catch {
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const isAuthorized = await verifyFirebaseRequest(req);
    if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.VITE_WHATSAPP_API_TOKEN;
    const fromNumber = process.env.WHATSAPP_PHONE_NUMBER || process.env.VITE_WHATSAPP_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        return res.status(500).json({ error: 'Credenciais Twilio não configuradas no servidor.' });
    }

    const { to, body } = req.body || {};

    if (!to || !body) {
        return res.status(400).json({ error: 'Parâmetros "to" e "body" são obrigatórios.' });
    }

    const toString = String(to).trim();
    const bodyString = String(body).trim();
    if (!/^\+?\d{10,15}$/.test(toString.replace(/^\+/, ''))) {
        return res.status(400).json({ error: 'Telefone de destino inválido.' });
    }
    if (!bodyString || bodyString.length > 1600) {
        return res.status(400).json({ error: 'Mensagem inválida (1 a 1600 caracteres).' });
    }

    const params = new URLSearchParams({
        From: `whatsapp:${fromNumber}`,
        To: `whatsapp:${toString.startsWith('+') ? toString : `+${toString}`}`,
        Body: bodyString,
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
