/**
 * Serviço de Integração Telegram via Bot API.
 * - Dev local / Electron: chama a API do Telegram diretamente usando VITE_TELEGRAM_BOT_TOKEN
 * - Vercel / produção: usa serverless function (/api/telegram-send) — token fica no servidor
 */

const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN?.trim();
import { auth } from './firebase';

const isDev = import.meta.env.DEV;
const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');

/**
 * Envia notificação de nova SI via Telegram
 * @param {string|number} telegramChatId - chat_id do destinatário
 * @param {object} os - dados da SI
 * @param {string} nomeResponsavel - nome do líder responsável
 */
export async function enviarNotificacaoTelegram(telegramChatId, os, nomeResponsavel) {
    if (!telegramChatId) {
        console.warn('Chat ID do Telegram não configurado. Notificação não será enviada.');
        return { success: false, message: 'Chat ID não configurado' };
    }

    try {
        const mensagem = montarMensagem(nomeResponsavel, os);

        if (isElectron || isDev) {
            return await enviarDireto(telegramChatId, mensagem);
        }

        return await enviarViaServerless(telegramChatId, mensagem);
    } catch (error) {
        console.error('Erro ao enviar Telegram:', error);
        return { success: false, message: error.message || 'Erro ao enviar Telegram' };
    }
}

async function enviarDireto(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.warn('VITE_TELEGRAM_BOT_TOKEN não configurado no .env');
        return { success: false, message: 'Token do bot não configurado' };
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.description || `Erro Telegram: ${response.status}`);
    return { success: true, messageId: data.result?.message_id };
}

async function enviarViaServerless(chatId, text) {
    let idToken = null;
    try {
        idToken = await auth?.currentUser?.getIdToken();
    } catch {
        idToken = null;
    }

    const response = await fetch('/api/telegram-send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ chat_id: chatId, text }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Erro serverless: ${response.status}`);
    return { success: true, messageId: data.message_id };
}

function montarMensagem(nomeResponsavel, os) {
    const dataPrazo = new Date(os.prazo).toLocaleDateString('pt-BR');
    const dataAtribuicao = new Date(os.criado_em || new Date()).toLocaleDateString('pt-BR');

    return (
        `🏨 Nova Solicitação Interna\n\n` +
        `Olá ${nomeResponsavel}! 👋\n\n` +
        `Uma nova SI foi atribuída a você:\n\n` +
        `📋 ${os.titulo}\n` +
        `📝 ${os.descricao}\n` +
        `🏢 Departamento: ${os.departamento}\n` +
        `📅 Prazo: ${dataPrazo}\n` +
        `🗓️ Criada em: ${dataAtribuicao}\n\n` +
        `Acesse o HotelFlow para mais detalhes.`
    );
}
