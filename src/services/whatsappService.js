/**
 * Serviço de Integração WhatsApp via Twilio (chamada direta)
 * Usa a API REST do Twilio diretamente do frontend.
 */

const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = import.meta.env.VITE_WHATSAPP_API_TOKEN?.trim();
const WHATSAPP_FROM = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER?.trim();

/**
 * Envia uma mensagem via WhatsApp para o usuário quando uma nova SI é atribuída
 */
export async function enviarNotificacaoWhatsApp(responsavel, os) {
    if (!responsavel?.telefone) {
        console.warn('Telefone do responsável não configurado. WhatsApp não será enviado.');
        return { success: false, message: 'Telefone não configurado' };
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !WHATSAPP_FROM) {
        console.warn('Credenciais Twilio não configuradas no .env');
        return { success: false, message: 'Credenciais Twilio ausentes' };
    }

    try {
        const telefoneFormatado = formatarTelefone(responsavel.telefone);
        const mensagem = montarMensagem(responsavel.nome, os);

        const body = new URLSearchParams({
            From: `whatsapp:${WHATSAPP_FROM}`,
            To: `whatsapp:${telefoneFormatado}`,
            Body: mensagem,
        });

        const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

        const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
        const baseUrl = isElectron ? `https://api.twilio.com` : `/twilio-api`;
        const url = `${baseUrl}/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Erro Twilio: ${response.status}`);
        }

        return {
            success: true,
            message: 'Mensagem enviada com sucesso',
            messageId: data.sid,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Erro ao enviar WhatsApp:', error);
        return {
            success: false,
            message: error.message || 'Erro ao enviar WhatsApp',
        };
    }
}

/**
 * Monta a mensagem de notificação
 */
function montarMensagem(nomeResponsavel, os) {
    const dataAtribuicao = new Date(os.criado_em || new Date()).toLocaleDateString('pt-BR');
    const dataPrazo = new Date(os.prazo).toLocaleDateString('pt-BR');

    return `
🏨 *Nova Solicitação Interna* 

Olá *${nomeResponsavel}*! 👋

Uma nova solicitação interna foi atribuída a você:

📋 *${os.titulo}*
📝 ${os.descricao}
🏢 Departamento: ${os.departamento}
📅 Prazo: ${dataPrazo}
🗓️ Criada em: ${dataAtribuicao}

Por favor, acesse o sistema HotelFlow para mais detalhes.

🔗 Sistema: HotelFlow
    `.trim();
}

/**
 * Valida se o número de telefone está no formato correto
 * Formato esperado: +5585999999999 (país + DDD + número)
 */
export function validarTelefone(telefone) {
    if (!telefone) return false;
    const telefoneLimpo = telefone.replace(/\D/g, '');
    return telefoneLimpo.length >= 10 && telefoneLimpo.length <= 15;
}

/**
 * Formata o telefone para o formato padrão
 * @param {string} telefone - Telefone em qualquer formato
 * @returns {string} Telefone formatado +XXYXXXXXXXXX
 */
export function formatarTelefone(telefone) {
    if (!telefone) return '';
    const limpo = telefone.replace(/\D/g, '');
    
    // Se não começa com 55 (Brasil), adiciona
    if (!limpo.startsWith('55') && limpo.length <= 11) {
        return `+55${limpo}`;
    }
    
    // Se já tem 55 no início
    if (limpo.startsWith('55')) {
        return `+${limpo}`;
    }
    
    return `+${limpo}`;
}
