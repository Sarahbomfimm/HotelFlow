import { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
import { StatusOS, StatusLabel, PDCAStep } from '../models/OrdemDeServico';
import { UserRole } from '../models/User';
import { db, isFirebaseConfigured } from '../services/firebase';
import { createUserNotification } from '../services/notifications';
import { enviarNotificacaoWhatsApp } from '../services/whatsappService';
import { enviarNotificacaoTelegram } from '../services/telegramService';
import { deleteFileByUrl, uploadServiceOrderImage } from '../services/storage';
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
        criado_em: toIsoDate(data.criado_em),
        criado_por_id: data.criado_por_id || '',
        criado_por_uid: data.criado_por_uid || '',
        criado_por_email: data.criado_por_email || '',
        criado_por_nome: data.criado_por_nome || '',
        imagem: data.imagem || null,
    };
}

function normalizeIdentityValue(value) {
    return String(value || '').trim().toLowerCase();
}

function matchesCoResponsavel(order, actor) {
    if (!order || !actor || !Array.isArray(order.co_responsaveis)) {
        return false;
    }

    const actorIds = [actor.id, actor.firebaseUid]
        .map(normalizeIdentityValue)
        .filter(Boolean);
    const actorEmail = normalizeIdentityValue(actor.email);
    const actorName = normalizeIdentityValue(actor.nome);

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

        const responsavelNome = normalizeIdentityValue(responsavel.nome);
        return actorName && responsavelNome && actorName === responsavelNome;
    });
}

function matchesOrderActor(order, actor, prefix) {
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

    const actorName = normalizeIdentityValue(actor.nome);
    const orderName = normalizeIdentityValue(order[`${prefix}_nome`]);
    if (actorName && orderName && actorName === orderName) {
        return true;
    }

    return false;
}

function capitalizeFirstLetter(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
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

        // O responsável pode alterar o fluxo normal; diretoria/admin podem concluir qualquer SI.
        const isResponsavel = matchesOrderActor(os, usuario, 'responsavel');
        const isManagement = isManagementRole(usuario?.role);
        const canManagementFinalize = isManagement && novoStatus === StatusOS.CONCLUIDO;

        if (!isResponsavel && !canManagementFinalize) {
            throw new Error('Apenas o responsável designado pode alterar o status desta SI. Diretoria/Admin podem apenas finalizá-la.');
        }

        const base = `Status alterado de ${StatusLabel[os.status]} para ${StatusLabel[novoStatus]}.`;
        const etapaPdca = novoStatus === StatusOS.CONCLUIDO ? PDCAStep.ACT : os.etapa_pdca;
        const entrada = {
            data: new Date().toISOString(),
            usuario_nome: usuario.nome,
            descricao: observacao ? `${base} Observação: ${observacao}` : base,
        };

        const historico = [...os.historico, entrada];

        if (!isFirebaseConfigured || !db) {
            setOrdens((prev) => prev.map((item) =>
                item.id !== osId
                    ? item
                    : { ...item, status: novoStatus, etapa_pdca: etapaPdca, historico },
            ));
            setError('');
            return;
        }

        await updateDoc(doc(db, 'serviceOrders', osId), {
            status: novoStatus,
            etapa_pdca: etapaPdca,
            historico,
        });
        setOrdens((prev) => prev.map((item) =>
            item.id !== osId
                ? item
                : { ...item, status: novoStatus, etapa_pdca: etapaPdca, historico },
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

        const campos = Object.keys(atualizacoes)
            .filter((campo) => !['imagem', 'responsavel_id', 'responsavel_uid', 'responsavel_email'].includes(campo))
            .map((campo) => {
                const labels = { titulo: 'Título', descricao: 'Descrição', departamento: 'Departamento', prazo: 'Prazo', responsavel_nome: 'Responsável', etapa_pdca: 'Etapa PDCA' };
                return labels[campo] || campo;
            }).join(', ');

        const entrada = {
            data: new Date().toISOString(),
            usuario_nome: usuario.nome,
            descricao: `SI editada. Campo(s) alterado(s): ${campos || 'dados'}.`,
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
    const adicionarObservacao = useCallback(async (osId, texto, usuario, etapaPdca) => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        const entrada = {
            data: new Date().toISOString(),
            usuario_nome: usuario.nome,
            descricao: `Progresso${etapaPdca ? ` [${etapaPdca}]` : ''}: ${texto}`,
        };

        const historico = [...os.historico, entrada];
        const payload = {
            historico,
            etapa_pdca: etapaPdca || os.etapa_pdca,
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

    /** Filtra OS pelo departamento do líder */
    const getOSPorLider = useCallback(
        (departamentos, usuario) =>
            ordens.filter((os) => {
                if (departamentos.includes(os.departamento)) return true;
                if (!usuario) return false;
                return matchesOrderActor(os, usuario, 'criado_por') || matchesOrderActor(os, usuario, 'responsavel');
            }),
        [ordens],
    );

    return (
        <OSContext.Provider
            value={{ ordens, criarOS, atualizarStatus, adicionarObservacao, editarOS, excluirOS, getOSPorLider, loading, error }}
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
