/**
 * Vercel Serverless Function — Envio de mensagens via Bot Telegram
 * Mantém o token do bot seguro no servidor (sem prefixo VITE_).
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;

    if (!token) {
        return res.status(500).json({ error: 'Token do Telegram não configurado no servidor.' });
    }

    const { chat_id, text } = req.body || {};

    if (!chat_id || !text) {
        return res.status(400).json({ error: 'Parâmetros "chat_id" e "text" são obrigatórios.' });
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id,
                text,
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
