/**
 * Vercel Serverless Function — Envio de mensagens via Bot Telegram
 * Mantém o token do bot seguro no servidor (sem prefixo VITE_).
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

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;

    if (!token) {
        return res.status(500).json({ error: 'Token do Telegram não configurado no servidor.' });
    }

    const { chat_id, text } = req.body || {};

    if (!chat_id || !text) {
        return res.status(400).json({ error: 'Parâmetros "chat_id" e "text" são obrigatórios.' });
    }

    const chatIdString = String(chat_id).trim();
    if (!/^-?\d+$/.test(chatIdString)) {
        return res.status(400).json({ error: 'chat_id inválido.' });
    }

    const textString = String(text).trim();
    if (!textString || textString.length > 4096) {
        return res.status(400).json({ error: 'Texto inválido (1 a 4096 caracteres).' });
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatIdString,
                text: textString,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.description || 'Erro ao enviar mensagem.' });
        }

        return res.status(200).json({ success: true, message_id: data.result?.message_id });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
