/**
 * Vercel Serverless Function — Webhook do Bot Telegram
 * Recebe atualizações do Telegram (quando líderes enviam /start).
 * Responde com o chat_id do usuário para ele poder configurar no HotelFlow.
 */
export default async function handler(req, res) {
    // Telegram envia POST; sempre retorna 200 para evitar reenvios
    if (req.method !== 'POST') return res.status(200).end();

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
    if (!token) return res.status(200).end();

    const { message } = req.body || {};
    if (!message) return res.status(200).json({ ok: true });

    const chatId = message.chat?.id;
    const text = (message.text || '').trim();

    if (!chatId) return res.status(200).json({ ok: true });

    if (text.startsWith('/start')) {
        const replyText =
            `✅ *Bot do HotelFlow conectado!*\n\n` +
            `Seu ID do Telegram é:\n\`${chatId}\`\n\n` +
            `📋 *Como usar:*\n` +
            `1\\. Copie o número acima\n` +
            `2\\. Acesse seu *Dashboard* no HotelFlow\n` +
            `3\\. Cole no campo "Conectar Telegram"\n` +
            `4\\. Pronto\\! Você receberá notificações de novas SIs automaticamente 🎉`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: replyText,
                parse_mode: 'MarkdownV2',
            }),
        });
    }

    return res.status(200).json({ ok: true });
}
