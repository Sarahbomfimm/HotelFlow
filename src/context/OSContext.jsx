﻿﻿﻿import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { INITIAL_OS } from '../data/mockData';
import { StatusOS, StatusLabel, PDCAStep, ApprovalStage } from '../models/OrdemDeServico';
import { UserRole } from '../models/User';
import { db, isFirebaseConfigured } from '../services/firebase';
import { hasPermission, PERMISSIONS } from '../services/permissions';
import { createUserNotification } from '../services/notifications';
import { enviarNotificacaoWhatsApp } from '../services/whatsappService';
import { enviarNotificacaoTelegram } from '../services/telegramService';
import { deleteFileByUrl, uploadProgressPdf, uploadServiceOrderImage } from '../services/storage';
import { useAuth } from './AuthContext';

const OSContext = createContext(null);

function toIsoDate(value) {
    if (!value) {
        return new Date().toISOString();
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString();
    }

    return new Date(value).toISOString();
}

function normalizeOrder(id, data) {
    return {
        id,
        titulo: data.titulo || '',
        descricao: data.descricao || '',
        departamento: data.departamento || '',
        responsavel_id: data.responsavel_id || '',
        responsavel_uid: data.responsavel_uid || '',
        responsavel_email: data.responsavel_email || '',
        responsavel_nome: data.responsavel_nome || '',
        co_responsaveis: Array.isArray(data.co_responsaveis) ? data.co_responsaveis : [],
        prazo: toIsoDate(data.prazo),
        status: data.status || StatusOS.ABERTO,
        etapa_pdca: data.etapa_pdca || PDCAStep.PLAN,
        historico: Array.isArray(data.historico)
            ? data.historico.map((entry) => ({ ...entry, data: toIsoDate(entry?.data) }))
            : [],
        concluido_em: data.concluido_em ? toIsoDate(data.concluido_em) : null,
        aprovacao_finalizacao_status: data.aprovacao_finalizacao_status || null,
        aprovacao_finalizacao_solicitada_em: data.aprovacao_finalizacao_solicitada_em
            ? toIsoDate(data.aprovacao_finalizacao_solicitada_em)
            : null,
        aprovacao_finalizacao_solicitada_por_id: data.aprovacao_finalizacao_solicitada_por_id || '',
        aprovacao_finalizacao_solicitada_por_uid: data.aprovacao_finalizacao_solicitada_por_uid || '',
        aprovacao_finalizacao_solicitada_por_email: data.aprovacao_finalizacao_solicitada_por_email || '',
        aprovacao_finalizacao_solicitada_por_nome: data.aprovacao_finalizacao_solicitada_por_nome || '',
        aprovacao_finalizacao_analisada_em: data.aprovacao_finalizacao_analisada_em
            ? toIsoDate(data.aprovacao_finalizacao_analisada_em)
            : null,
        aprovacao_finalizacao_analisada_por_id: data.aprovacao_finalizacao_analisada_por_id || '',
        aprovacao_finalizacao_analisada_por_uid: data.aprovacao_finalizacao_analisada_por_uid || '',
        aprovacao_finalizacao_analisada_por_email: data.aprovacao_finalizacao_analisada_por_email || '',
        aprovacao_finalizacao_analisada_por_nome: data.aprovacao_finalizacao_analisada_por_nome || '',
        criado_em: toIsoDate(data.criado_em),
        criado_por_id: data.criado_por_id || '',
        criado_por_uid: data.criado_por_uid || '',
        criado_por_email: data.criado_por_email || '',
        criado_por_nome: data.criado_por_nome || '',
        imagem: data.imagem || null,
    };
}

export function normalizeIdentityValue(value) {
    return String(value || '').trim().toLowerCase();
}

export function matchesCoResponsavel(order, actor) {
    if (!order || !actor || !Array.isArray(order.co_responsaveis)) {
        return false;
    }

    const actorIds = [actor.id, actor.firebaseUid]
        .map(normalizeIdentityValue)
        .filter(Boolean);
    const actorEmail = normalizeIdentityValue(actor.email);

    return order.co_responsaveis.some((responsavel) => {
        const responsavelIds = [responsavel.id, responsavel.uid]
            .map(normalizeIdentityValue)
            .filter(Boolean);

        if (actorIds.some((id) => responsavelIds.includes(id))) {
            return true;
        }

        const responsavelEmail = normalizeIdentityValue(responsavel.email);
        if (actorEmail && responsavelEmail && actorEmail === responsavelEmail) {
            return true;
        }

        return false;
    });
}

export function matchesOrderActor(order, actor, prefix) {
    if (!order || !actor) {
        return false;
    }

    if (prefix === 'responsavel' && matchesCoResponsavel(order, actor)) {
        return true;
    }

    const actorIds = [actor.id, actor.firebaseUid]
        .map(normalizeIdentityValue)
        .filter(Boolean);
    const orderIds = [order[`${prefix}_id`], order[`${prefix}_uid`]]
        .map(normalizeIdentityValue)
        .filter(Boolean);

    if (actorIds.some((id) => orderIds.includes(id))) {
        return true;
    }

    const actorEmail = normalizeIdentityValue(actor.email);
    const orderEmail = normalizeIdentityValue(order[`${prefix}_email`]);
    if (actorEmail && orderEmail && actorEmail === orderEmail) {
        return true;
    }

    const actorNome = normalizeIdentityValue(actor.nome);
    const orderNome = normalizeIdentityValue(order[`${prefix}_nome`]);
    if (actorNome && orderNome && actorNome === orderNome) {
        return true;
    }

    return false;
}

export function isPrimaryResponsible(order, actor) {
    if (!order || !actor) {
        return false;
    }

    const actorIds = [actor.id, actor.firebaseUid]
        .map(normalizeIdentityValue)
        .filter(Boolean);
    const orderIds = [order.responsavel_id, order.responsavel_uid]
        .map(normalizeIdentityValue)
        .filter(Boolean);

    if (actorIds.some((id) => orderIds.includes(id))) {
        return true;
    }

    const actorEmail = normalizeIdentityValue(actor.email);
    const orderEmail = normalizeIdentityValue(order.responsavel_email);
    return actorEmail && orderEmail && actorEmail === orderEmail;
}

function capitalizeFirstLetter(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeHistoryValue(field, value) {
    if (field === 'prazo') {
        return value ? toIsoDate(value).slice(0, 10) : '';
    }

    if (field === 'co_responsaveis') {
        return JSON.stringify(
            (Array.isArray(value) ? value : [])
                .map((item) => item?.nome || item?.id || '')
                .filter(Boolean)
                .sort(),
        );
    }

    return String(value ?? '').trim();
}

function formatHistoryValue(field, value) {
    if (!value) {
        return 'vazio';
    }

    if (field === 'prazo') {
        const normalized = toIsoDate(value);
        return normalized ? new Date(normalized).toLocaleDateString('pt-BR') : 'vazio';
    }

    if (field === 'co_responsaveis') {
        const nomes = (Array.isArray(value) ? value : [])
            .map((item) => item?.nome || item?.id || '')
            .filter(Boolean);
        return nomes.length > 0 ? nomes.join(', ') : 'vazio';
    }

    return String(value).trim() || 'vazio';
}

function buildOrderHistoryDescription(order, updates) {
    const labels = {
        titulo: 'Título',
        descricao: 'Descrição',
        departamento: 'Departamento',
        prazo: 'Prazo',
        responsavel_nome: 'Responsável',
        etapa_pdca: 'Etapa PDCA',
        co_responsaveis: 'Co-responsáveis',
    };

    const relevantFields = Object.keys(updates).filter((field) => labels[field]);
    const changes = relevantFields
        .filter((field) => normalizeHistoryValue(field, order?.[field]) !== normalizeHistoryValue(field, updates[field]))
        .map((field) => `${labels[field]}: ${formatHistoryValue(field, order?.[field])} -> ${formatHistoryValue(field, updates[field])}`);

    return changes.length > 0 ? `SI editada. ${changes.join(' | ')}` : 'SI editada.';
}

function isManagementRole(role) {
    return role === UserRole.DIRETORA || role === UserRole.ADMIN;
}

export function OSProvider({ children }) {
    const { user, authReady } = useAuth();
    const [ordens, setOrdens] = useState(() => (isFirebaseConfigured && db ? [] : INITIAL_OS));
    const [loading, setLoading] = useState(Boolean(isFirebaseConfigured && db));
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isFirebaseConfigured || !db) {
            setOrdens(INITIAL_OS);
            setLoading(false);
            setError('');
            return undefined;
        }

        if (!authReady) {
            setLoading(true);
            setError('');
            return undefined;
        }

        if (!user) {
            setOrdens([]);
            setLoading(false);
            setError('');
            return undefined;
        }

        const ordersQuery = query(collection(db, 'serviceOrders'), orderBy('criado_em', 'desc'));
        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            setOrdens(snapshot.docs.map((orderDoc) => normalizeOrder(orderDoc.id, orderDoc.data())));
            setLoading(false);
            setError('');
        }, () => {
            setOrdens([]);
            setLoading(false);
            setError('Nao foi possivel carregar as solicitacoes internas do Firestore. Verifique as regras de leitura do banco.');
        });

        return unsubscribe;
    }, [authReady, user]);

    /** Cria uma nova OS */
    const criarOS = useCallback(async (dados, autor) => {
        const titulo = capitalizeFirstLetter(dados.titulo);
        const novaOS = {
            ...dados,
            titulo,
            status: StatusOS.ABERTO,
            etapa_pdca: PDCAStep.PLAN,
            criado_em: new Date().toISOString(),
            criado_por_id: autor.id,
            criado_por_uid: autor.firebaseUid || autor.id,
            criado_por_email: autor.email?.toLowerCase() || '',
            criado_por_nome: autor.nome,
            historico: [
                {
                    data: new Date().toISOString(),
                    usuario_nome: autor.nome,
                    descricao: 'Solicitação interna criada.',
                },
            ],
        };

        if (!isFirebaseConfigured || !db) {
            const fallbackOrder = { ...novaOS, id: `os-${Date.now()}` };
            setOrdens((prev) => [fallbackOrder, ...prev]);
            setError('');
            return fallbackOrder;
        }

        let imagem = null;
        const orderRef = doc(collection(db, 'serviceOrders'));

        if (dados.imagem) {
            const isExternalUrl = typeof dados.imagem === 'string' && /^https?:\/\//i.test(dados.imagem);

            if (isExternalUrl) {
                // Quando a imagem ja foi enviada para um provedor externo (ex.: Cloudinary),
                // salvamos apenas a URL na OS e nao tentamos enviar ao Firebase Storage.
                imagem = dados.imagem;
            } else {
                try {
                    imagem = await uploadServiceOrderImage(dados.imagem, orderRef.id);
                } catch {
                    throw new Error('Nao foi possivel enviar a imagem da solicitacao. Verifique as regras do Storage.');
                }
            }
        }

        const orderPayload = { ...novaOS, imagem };
        try {
            await setDoc(orderRef, orderPayload);
            setOrdens((prev) => [normalizeOrder(orderRef.id, orderPayload), ...prev.filter((item) => item.id !== orderRef.id)]);
            setError('');
        } catch {
            throw new Error('Nao foi possivel salvar a solicitacao interna no Firestore. Verifique as regras do banco.');
        }

        const todoosResponsaveis = [
            (dados.responsavel_id || dados.responsavel_uid || dados.responsavel_email)
                ? { uid: dados.responsavel_uid || dados.responsavel_id, email: dados.responsavel_email, nome: dados.responsavel_nome, telefone: dados.responsavel_telefone, telegram_chat_id: dados.responsavel_telegram_chat_id }
                : null,
            ...(Array.isArray(dados.co_responsaveis) ? dados.co_responsaveis.map((c) => ({ uid: c.uid || c.id, email: c.email, nome: c.nome, telefone: c.telefone, telegram_chat_id: c.telegram_chat_id })) : []),
        ].filter(Boolean);

        for (const resp of todoosResponsaveis) {
            try {
                await createUserNotification({
                    recipientUid: resp.uid,
                    recipientEmail: resp.email,
                }, {
                    message: `Nova SI: "${titulo}" atribuída a você (${dados.departamento}).`,
                    type: 'new_os',
                    relatedOrderId: orderRef.id,
                });
            } catch {
                // Nao impede a criacao da SI se a notificacao falhar.
            }

            // Envia notificação via WhatsApp (se configurado e se o telefone estiver disponível)
            try {
                if (resp.telefone) {
                    await enviarNotificacaoWhatsApp(
                        { nome: resp.nome, telefone: resp.telefone },
                        { titulo, descricao: dados.descricao, departamento: dados.departamento, prazo: dados.prazo, criado_em: new Date().toISOString() }
                    );
                }
            } catch (error) {
                console.warn('Erro ao enviar notificação WhatsApp:', error.message);
            }

            // Envia notificação via Telegram (se o chat_id estiver configurado)
            try {
                if (resp.telegram_chat_id) {
                    await enviarNotificacaoTelegram(
                        resp.telegram_chat_id,
                        { titulo, descricao: dados.descricao, departamento: dados.departamento, prazo: dados.prazo, criado_em: new Date().toISOString() },
                        resp.nome,
                    );
                }
            } catch (error) {
                console.warn('Erro ao enviar notificação Telegram:', error.message);
            }
        }

        return { ...orderPayload, id: orderRef.id };
    }, []);

    /** Atualiza o status de uma OS */
    const atualizarStatus = useCallback(async (osId, novoStatus, usuario, observacao = '') => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        const isCriador = matchesOrderActor(os, usuario, 'criado_por');

        if (novoStatus === StatusOS.CONCLUIDO && !hasPermission(usuario, PERMISSIONS.SI_FINALIZE) && !isCriador) {
            throw new Error('Você não tem permissão para finalizar SI.');
        }

        // O responsável pode alterar o fluxo normal; diretoria/admin podem concluir qualquer SI.
        const isResponsavel = matchesOrderActor(os, usuario, 'responsavel');
        const isManagement = isManagementRole(usuario?.role);
        const canManagementFinalize = (isManagement || isCriador) && novoStatus === StatusOS.CONCLUIDO;
        const canReopen = (isManagement || isCriador) && os.status === StatusOS.CONCLUIDO && novoStatus === StatusOS.EM_ANDAMENTO;

        if (!isResponsavel && !canManagementFinalize && !canReopen) {
            throw new Error('Apenas o responsável designado pode alterar o status desta SI. Diretoria/Admin e o criador podem finalizá-la ou reabri-la.');
        }

        const base = `Status alterado de ${StatusLabel[os.status]} para ${StatusLabel[novoStatus]}.`;
        const etapaPdca = novoStatus === StatusOS.CONCLUIDO ? PDCAStep.ACT : os.etapa_pdca;
        const concluidoEm = novoStatus === StatusOS.CONCLUIDO ? new Date().toISOString() : null;

        let approvalPatch = {};
        if (novoStatus === StatusOS.CONCLUIDO) {
            approvalPatch = {
                aprovacao_finalizacao_status: ApprovalStage.FINALIZADA,
                aprovacao_finalizacao_analisada_em: concluidoEm,
                aprovacao_finalizacao_analisada_por_id: usuario.id || '',
                aprovacao_finalizacao_analisada_por_uid: usuario.firebaseUid || usuario.id || '',
                aprovacao_finalizacao_analisada_por_email: usuario.email?.toLowerCase() || '',
                aprovacao_finalizacao_analisada_por_nome: usuario.nome || '',
            };
        } else if (os.status === StatusOS.CONCLUIDO && novoStatus === StatusOS.EM_ANDAMENTO) {
            // Reabrindo a SI, limpa os campos de aprovação e finalização
            approvalPatch = {
                aprovacao_finalizacao_status: null,
                aprovacao_finalizacao_solicitada_em: null,
                aprovacao_finalizacao_solicitada_por_id: '',
                aprovacao_finalizacao_solicitada_por_uid: '',
                aprovacao_finalizacao_solicitada_por_email: '',
                aprovacao_finalizacao_solicitada_por_nome: '',
                aprovacao_finalizacao_analisada_em: null,
                aprovacao_finalizacao_analisada_por_id: '',
                aprovacao_finalizacao_analisada_por_uid: '',
                aprovacao_finalizacao_analisada_por_email: '',
                aprovacao_finalizacao_analisada_por_nome: '',
            };
        }

        const entrada = {
            data: concluidoEm || new Date().toISOString(),
            usuario_nome: usuario.nome,
            descricao: observacao ? `${base} Observação: ${observacao}` : base,
        };

        const historico = [...os.historico, entrada];

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.map((item) =>
                item.id !== osId
                    ? item
                    : {
                        ...item,
                        status: novoStatus,
                        etapa_pdca: etapaPdca,
                        historico,
                        concluido_em: concluidoEm,
                        ...approvalPatch,
                    },
            ));
            setError('');
            return;
        }

        await updateDoc(doc(db, 'serviceOrders', osId), {
            status: novoStatus,
            etapa_pdca: etapaPdca,
            historico,
            concluido_em: concluidoEm,
            ...approvalPatch,
        });
        setOrdens((prev) => prev.map((item) =>
            item.id !== osId
                ? item
                : {
                    ...item,
                    status: novoStatus,
                    etapa_pdca: etapaPdca,
                    historico,
                    concluido_em: concluidoEm,
                    ...approvalPatch,
                },
        ));
        setError('');

        const shouldNotifyCreator =
            (os.criado_por_uid || os.criado_por_id || os.criado_por_email)
            && !matchesOrderActor(os, usuario, 'criado_por');

        if (shouldNotifyCreator) {
            const message = novoStatus === StatusOS.CONCLUIDO
                ? `SI "${os.titulo}" concluída por ${usuario.nome} (${os.departamento}).`
                : `SI "${os.titulo}" iniciada por ${usuario.nome} (${os.departamento}).`;

            await createUserNotification({
                recipientUid: os.criado_por_uid || os.criado_por_id,
                recipientEmail: os.criado_por_email,
            }, {
                message,
                type: 'new_os',
                relatedOrderId: os.id,
            });
        }
    }, [ordens]);

    const solicitarFinalizacao = useCallback(async (osId, usuario) => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        if (os.status === StatusOS.CONCLUIDO) {
            throw new Error('Esta SI já está concluída.');
        }

        if (os.status !== StatusOS.EM_ANDAMENTO) {
            throw new Error('A solicitação de finalização só pode ser feita para SI em andamento.');
        }

        const isResponsavel = matchesOrderActor(os, usuario, 'responsavel');
        if (!isResponsavel) {
            throw new Error('Somente responsável ou co-responsável pode solicitar finalização.');
        }

        if ([ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE].includes(os.aprovacao_finalizacao_status)) {
            throw new Error('Esta SI já possui uma solicitação de finalização em aberto.');
        }

        const nowIso = new Date().toISOString();
        const payload = {
            aprovacao_finalizacao_status: ApprovalStage.SOLICITADA,
            aprovacao_finalizacao_solicitada_em: nowIso,
            aprovacao_finalizacao_solicitada_por_id: usuario.id || '',
            aprovacao_finalizacao_solicitada_por_uid: usuario.firebaseUid || usuario.id || '',
            aprovacao_finalizacao_solicitada_por_email: usuario.email?.toLowerCase() || '',
            aprovacao_finalizacao_solicitada_por_nome: usuario.nome || '',
            historico: [
                ...os.historico,
                {
                    data: nowIso,
                    usuario_nome: usuario.nome,
                    descricao: 'Solicitação de finalização enviada para aprovação.',
                },
            ],
        };

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.map((item) => (item.id === osId ? { ...item, ...payload } : item)));
            setError('');
            return;
        }

        await updateDoc(doc(db, 'serviceOrders', osId), payload);
        setOrdens((prev) => prev.map((item) => (item.id === osId ? { ...item, ...payload } : item)));
        setError('');
    }, [ordens]);

    const moverAprovacaoFinalizacao = useCallback(async (osId, destino, usuario) => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        if (!hasPermission(usuario, PERMISSIONS.SI_APPROVALS_MOVE)) {
            throw new Error('Você não tem permissão para mover cards no kanban de aprovações.');
        }

        if (![ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE, ApprovalStage.FINALIZADA].includes(destino)) {
            throw new Error('Coluna de destino inválida.');
        }

        if (os.aprovacao_finalizacao_status === destino) {
            return;
        }

        const nowIso = new Date().toISOString();
        const basePayload = {
            aprovacao_finalizacao_status: destino,
            aprovacao_finalizacao_analisada_em: nowIso,
            aprovacao_finalizacao_analisada_por_id: usuario.id || '',
            aprovacao_finalizacao_analisada_por_uid: usuario.firebaseUid || usuario.id || '',
            aprovacao_finalizacao_analisada_por_email: usuario.email?.toLowerCase() || '',
            aprovacao_finalizacao_analisada_por_nome: usuario.nome || '',
        };

        const stageLabel = {
            [ApprovalStage.SOLICITADA]: 'Solicitadas',
            [ApprovalStage.EM_ANALISE]: 'Em análise',
            [ApprovalStage.FINALIZADA]: 'Finalizadas',
        };

        const historyEntry = {
            data: nowIso,
            usuario_nome: usuario.nome,
            descricao: `Fluxo de aprovação movido para "${stageLabel[destino]}".`,
        };

        const payload = {
            ...basePayload,
            historico: [...os.historico, historyEntry],
        };

        if (destino === ApprovalStage.FINALIZADA) {
            payload.status = StatusOS.CONCLUIDO;
            payload.etapa_pdca = PDCAStep.ACT;
            payload.concluido_em = nowIso;
        }

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.map((item) => (item.id === osId ? { ...item, ...payload } : item)));
            setError('');
        } else {
            await updateDoc(doc(db, 'serviceOrders', osId), payload);
            setOrdens((prev) => prev.map((item) => (item.id === osId ? { ...item, ...payload } : item)));
            setError('');
        }

        const shouldNotifyCreator =
            destino === ApprovalStage.FINALIZADA
            && (os.criado_por_uid || os.criado_por_id || os.criado_por_email)
            && !matchesOrderActor(os, usuario, 'criado_por');

        if (shouldNotifyCreator) {
            await createUserNotification({
                recipientUid: os.criado_por_uid || os.criado_por_id,
                recipientEmail: os.criado_por_email,
            }, {
                message: `SI "${os.titulo}" concluída por ${usuario.nome} (${os.departamento}).`,
                type: 'new_os',
                relatedOrderId: os.id,
            });
        }
    }, [ordens]);

    const recusarFinalizacao = useCallback(async (osId, usuario) => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        if (!hasPermission(usuario, PERMISSIONS.SI_APPROVALS_MOVE)) {
            throw new Error('Você não tem permissão para recusar solicitações de finalização.');
        }

        if (![ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE].includes(os.aprovacao_finalizacao_status)) {
            throw new Error('Esta SI não possui uma solicitação de finalização em aberto para ser recusada.');
        }

        const nowIso = new Date().toISOString();
        const payload = {
            // Limpa todos os campos relacionados à aprovação de finalização
            aprovacao_finalizacao_status: null,
            aprovacao_finalizacao_solicitada_em: null,
            aprovacao_finalizacao_solicitada_por_id: '',
            aprovacao_finalizacao_solicitada_por_uid: '',
            aprovacao_finalizacao_solicitada_por_email: '',
            aprovacao_finalizacao_solicitada_por_nome: '',
            aprovacao_finalizacao_analisada_em: null,
            aprovacao_finalizacao_analisada_por_id: '',
            aprovacao_finalizacao_analisada_por_uid: '',
            aprovacao_finalizacao_analisada_por_email: '',
            aprovacao_finalizacao_analisada_por_nome: '',
            // Garante que o status volte para EM_ANDAMENTO se não estiver concluída
            status: os.status === StatusOS.CONCLUIDO ? StatusOS.CONCLUIDO : StatusOS.EM_ANDAMENTO,
            historico: [
                ...os.historico,
                {
                    data: nowIso,
                    usuario_nome: usuario.nome,
                    descricao: 'Solicitação de finalização recusada.',
                },
            ],
        };

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.map((item) => (item.id === osId ? { ...item, ...payload } : item)));
            setError('');
        } else {
            await updateDoc(doc(db, 'serviceOrders', osId), payload);
            setOrdens((prev) => prev.map((item) => (item.id === osId ? { ...item, ...payload } : item)));
            setError('');
        }

        // Notificar o criador da SI sobre a recusa
        const shouldNotifyCreator =
            (os.criado_por_uid || os.criado_por_id || os.criado_por_email)
            && !matchesOrderActor(os, usuario, 'criado_por');

        if (shouldNotifyCreator) {
            await createUserNotification({
                recipientUid: os.criado_por_uid || os.criado_por_id,
                recipientEmail: os.criado_por_email,
            }, {
                message: `A solicitação de finalização da SI "${os.titulo}" foi recusada por ${usuario.nome}.`,
                type: 'info', // Usar tipo 'info' ou 'warning' para recusa
                relatedOrderId: os.id,
            });
        }

        // Notificar o solicitante da finalização (se diferente do criador)
        // TODO: Implementar notificação para o solicitante da finalização
    }, [ordens]);

    /** Edita campos de uma OS (apenas pela diretora) */
    const editarOS = useCallback(async (osId, atualizacoes, usuario) => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        // Diretora pode editar qualquer SI; demais usuários apenas as criadas por si mesmos.
        const isDiretora = isManagementRole(usuario?.role);
        const isCriador = matchesOrderActor(os, usuario, 'criado_por');

        if (!isDiretora && !isCriador) {
            throw new Error('Apenas a Diretoria ou quem criou esta SI pode editá-la.');
        }

        const entrada = {
            data: new Date().toISOString(),
            usuario_nome: usuario.nome,
            descricao: buildOrderHistoryDescription(os, atualizacoes),
        };

        let imagem = os.imagem || null;
        if (atualizacoes.imagem?.startsWith?.('data:')) {
            if (os.imagem) {
                await deleteFileByUrl(os.imagem);
            }
            imagem = await uploadServiceOrderImage(atualizacoes.imagem, osId);
        } else if (atualizacoes.imagem === null && os.imagem) {
            await deleteFileByUrl(os.imagem);
            imagem = null;
        }

        const payload = {
            ...atualizacoes,
            imagem,
            historico: [...os.historico, entrada],
        };

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.map((item) => item.id === osId ? { ...item, ...payload } : item));
            setError('');
            return;
        }

        await updateDoc(doc(db, 'serviceOrders', osId), payload);
        setOrdens((prev) => prev.map((item) => item.id === osId ? { ...item, ...payload } : item));
        setError('');
    }, [ordens]);

    /** Adiciona observação de progresso sem alterar status */
    const adicionarObservacao = useCallback(async (osId, texto, usuario, etapaPdca, prazoEstimado, anexoPdfFile, coResponsaveis) => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        let anexoPdfUrl = null;
        let anexoPdfNome = null;
        let anexoErro = '';
        if (anexoPdfFile) {
            try {
                const uploadResult = await uploadProgressPdf(anexoPdfFile, osId);
                anexoPdfUrl = uploadResult?.url || null;
                anexoPdfNome = uploadResult?.fileName || anexoPdfFile.name || 'anexo.pdf';
            } catch (error) {
                anexoErro = error?.message || 'Nao foi possivel enviar o PDF do progresso.';
            }
        }

        const normalizedCurrentCoResponsaveis = Array.isArray(os.co_responsaveis) ? os.co_responsaveis : [];
        const normalizedNextCoResponsaveis = Array.isArray(coResponsaveis) ? coResponsaveis : normalizedCurrentCoResponsaveis;
        const currentNames = normalizedCurrentCoResponsaveis.map((item) => item.nome).filter(Boolean).join(', ');
        const nextNames = normalizedNextCoResponsaveis.map((item) => item.nome).filter(Boolean).join(', ');
        const coResponsaveisDescription = currentNames !== nextNames
            ? ` Co-responsáveis atualizados: ${nextNames || 'nenhum'}.`
            : '';

        const entrada = {
            data: new Date().toISOString(),
            usuario_nome: usuario.nome,
            descricao: `Progresso${etapaPdca ? ` [${etapaPdca}]` : ''}: ${texto}${coResponsaveisDescription}`,
            prazo_estimado: prazoEstimado || null,
            anexo_pdf_url: anexoPdfUrl,
            anexo_pdf_nome: anexoPdfNome,
            anexo_pdf_erro: anexoErro || null,
        };

        const historico = [...os.historico, entrada];
        const payload = {
            historico,
            etapa_pdca: etapaPdca || os.etapa_pdca,
            co_responsaveis: normalizedNextCoResponsaveis,
        };
        // Atualiza o campo prazo_estimado na OS se informado
        if (prazoEstimado) {
            payload.prazo_estimado = prazoEstimado;
        }

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.map((item) => item.id === osId ? { ...item, ...payload } : item));
            setError('');
            return {
                anexoSalvo: Boolean(anexoPdfUrl),
                anexoErro,
            };
        }

        await updateDoc(doc(db, 'serviceOrders', osId), payload);
        setOrdens((prev) => prev.map((item) => item.id === osId ? { ...item, ...payload } : item));
        setError('');
        return {
            anexoSalvo: Boolean(anexoPdfUrl),
            anexoErro,
        };
    }, [ordens]);

    /** Remove uma OS (apenas pela diretora) */
    const excluirOS = useCallback(async (osId, usuario) => {
        const os = ordens.find((item) => item.id === osId);

        if (!os) return;

        // Validação de segurança: apenas quem criou pode excluir
        const isCriador = matchesOrderActor(os, usuario, 'criado_por');

        if (!isCriador) {
            throw new Error('Apenas quem criou esta SI pode excluí-la.');
        }

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.filter((item) => item.id !== osId));
            setError('');
            return;
        }

        if (os?.imagem) {
            await deleteFileByUrl(os.imagem);
        }

        await deleteDoc(doc(db, 'serviceOrders', osId));
        setOrdens((prev) => prev.filter((item) => item.id !== osId));
        setError('');
    }, [ordens]);

    /** Filtra OS visíveis para líder */
    const getOSPorLider = useCallback(
        (departamentos, usuario) =>
            ordens.filter((os) => {
                if (!usuario) return false;

                const isCreator = matchesOrderActor(os, usuario, 'criado_por');
                if (isCreator) return true;

                const isAssigned = matchesOrderActor(os, usuario, 'responsavel');
                if (isAssigned) return true;

                if (departamentos && departamentos.length > 0 && departamentos.includes(os.departamento)) {
                    return true;
                }

                return false;
            }),
        [ordens],
    );

    return (
        <OSContext.Provider
            value={{
                ordens,
                criarOS,
                atualizarStatus,
                solicitarFinalizacao,
                moverAprovacaoFinalizacao,
                recusarFinalizacao,
                adicionarObservacao,
                editarOS,
                excluirOS,
                getOSPorLider,
                loading,
                error,
            }}
        >
            {children}
        </OSContext.Provider>
    );
}

export function useOS() {
    const ctx = useContext(OSContext);
    if (!ctx) throw new Error('useOS deve ser usado dentro de OSProvider');
    return ctx;
}
