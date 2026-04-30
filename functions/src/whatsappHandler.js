const functions = require('firebase-functions');
const twilio = require('twilio');
const axios = require('axios');

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;

const twilioClient = twilioAccountSid && twilioAuthToken
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;

async function sendViaTwilio(telefone, mensagem) {
  if (!twilioClient) {
    throw new Error('Twilio não configurado. Configure TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN');
  }

  if (!whatsappPhoneNumber) {
    throw new Error('WHATSAPP_PHONE_NUMBER não configurado');
  }

  const message = await twilioClient.messages.create({
    from: `whatsapp:${whatsappPhoneNumber}`,
    to: `whatsapp:${telefone}`,
    body: mensagem,
  });

  return {
    messageId: message.sid,
    status: message.status,
    provider: 'twilio',
  };
}

const gupshupApiKey = process.env.GUPSHUP_API_KEY;
const gupshupAppId = process.env.GUPSHUP_APP_ID;

async function sendViaGupshup(telefone, mensagem) {
  if (!gupshupApiKey || !gupshupAppId) {
    throw new Error('Gupshup não configurado. Configure GUPSHUP_API_KEY e GUPSHUP_APP_ID');
  }

  const response = await axios.post(
    'https://api.gupshup.io/sm/api/v1/msg',
    {
      channel: 'whatsapp',
      source: gupshupAppId,
      destination: telefone,
      message: {
        type: 'text',
        text: mensagem,
      },
    },
    {
      headers: {
        Authorization: gupshupApiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.status !== 'submitted') {
    throw new Error(`Gupshup rejected: ${response.data.message || 'mensagem não submetida'}`);
  }

  return {
    messageId: response.data.messageId,
    status: response.data.status,
    provider: 'gupshup',
  };
}

exports.sendWhatsAppMessage = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado. Faça login para enviar mensagens.');
    }

    const { telefone, mensagem, provider = 'twilio' } = data || {};

    if (!telefone || typeof telefone !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Telefone inválido ou vazio');
    }

    if (!mensagem || typeof mensagem !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Mensagem vazia ou inválida');
    }

    const telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 15) {
      throw new functions.https.HttpsError('invalid-argument', 'Número de telefone deve ter entre 10 e 15 dígitos');
    }

    if (mensagem.length > 1600) {
      throw new functions.https.HttpsError('invalid-argument', 'Mensagem muito longa (máximo 1600 caracteres)');
    }

    try {
      functions.logger.log(`Enviando WhatsApp via ${provider} para ${telefone}`);

      let result;
      if (provider === 'twilio') {
        result = await sendViaTwilio(telefone, mensagem);
      } else if (provider === 'gupshup') {
        result = await sendViaGupshup(telefone, mensagem);
      } else {
        throw new Error(`Provedor desconhecido: ${provider}`);
      }

      return {
        success: true,
        messageId: result.messageId,
        status: result.status,
        provider: result.provider,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      functions.logger.error(`Erro ao enviar WhatsApp: ${error.message}`);
      throw new functions.https.HttpsError('internal', `Erro ao enviar mensagem: ${error.message}`);
    }
  });

exports.checkWhatsAppMessageStatus = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
    }

    const { messageId } = data || {};

    if (!messageId || !twilioClient) {
      throw new functions.https.HttpsError('invalid-argument', 'messageId inválido');
    }

    const message = await twilioClient.messages(messageId).fetch();
    return {
      messageId: message.sid,
      status: message.status,
      dateSent: message.dateSent ? message.dateSent.toISOString() : null,
      dateUpdated: message.dateUpdated ? message.dateUpdated.toISOString() : null,
    };
  });

exports.logWhatsAppAttempt = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
    }

    const { osId, responsavelId, sucesso, motivo } = data || {};

    functions.logger.log({
      timestamp: new Date().toISOString(),
      userId: context.auth.uid,
      osId,
      responsavelId,
      sucesso,
      motivo,
      type: 'whatsapp_attempt',
    });

    return { logged: true };
  });
