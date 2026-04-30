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
import { deleteFileByUrl, uploadServiceOrderImage } from '../services/storage';
import { useAuth } from './AuthContext';

const OSContext = createContext(null);

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
        prazo: data.prazo || new Date().toISOString(),
        status: data.status || StatusOS.ABERTO,
        etapa_pdca: data.etapa_pdca || PDCAStep.PLAN,
        historico: Array.isArray(data.historico) ? data.historico : [],
        criado_em: data.criado_em || new Date().toISOString(),
        criado_por_id: data.criado_por_id || '',
        criado_por_uid: data.criado_por_uid || '',
        criado_por_email: data.criado_por_email || '',
        criado_por_nome: data.criado_por_nome || '',
        imagem: data.imagem || null,
    };
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
        console.log('[criarOS] chamado com dados:', dados);
        const novaOS = {
            ...dados,
            status: StatusOS.ABERTO,
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

        if (dados.responsavel_id || dados.responsavel_uid || dados.responsavel_email) {
            try {
                await createUserNotification({
                    recipientUid: dados.responsavel_uid || dados.responsavel_id,
                    recipientEmail: dados.responsavel_email,
                }, {
                    message: `Nova SI: "${dados.titulo}" atribuída a você (${dados.departamento}).`,
                    type: 'new_os',
                    relatedOrderId: orderRef.id,
                });
            } catch {
                // Nao impede a criacao da SI se a notificacao falhar.
            }

            // Envia notificação via WhatsApp (se configurado e se o telefone estiver disponível)
            try {
                if (dados.responsavel_telefone) {
                    await enviarNotificacaoWhatsApp(
                        {
                            nome: dados.responsavel_nome,
                            telefone: dados.responsavel_telefone,
                        },
                        {
                            titulo: dados.titulo,
                            descricao: dados.descricao,
                            departamento: dados.departamento,
                            prazo: dados.prazo,
                            criado_em: new Date().toISOString(),
                        }
                    );
                }
            } catch (error) {
                // Nao impede a criacao da SI se o WhatsApp falhar
                console.warn('Erro ao enviar notificação WhatsApp:', error.message);
            }
        }

        return { ...orderPayload, id: orderRef.id };
    }, []);

    /** Atualiza o status de uma OS */
    const atualizarStatus = useCallback(async (osId, novoStatus, usuario, observacao = '') => {
        const os = ordens.find((item) => item.id === osId);
        if (!os) return;

        // Apenas o responsável designado pode alterar o status da SI
        const isResponsavel = usuario.id === os.responsavel_id || usuario.firebaseUid === os.responsavel_uid;

        if (!isResponsavel) {
            throw new Error('Apenas o responsável designado pode alterar o status desta SI.');
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

        if (usuario.role !== UserRole.DIRETORA && (os.criado_por_uid || os.criado_por_id || os.criado_por_email)) {
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

        // Validação de segurança: apenas Diretora pode editar
        if (usuario.role !== UserRole.DIRETORA) {
            throw new Error('Apenas a Diretora pode editar uma solicitação interna.');
        }

        const campos = Object.keys(atualizacoes)
            .filter((campo) => !['imagem'].includes(campo))
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

        // Validação de segurança: apenas Diretora pode deletar
        if (usuario?.role !== UserRole.DIRETORA) {
            throw new Error('Apenas a Diretora pode deletar uma solicitação interna.');
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
            ordens.filter((os) =>
                departamentos.includes(os.departamento) ||
                (usuario && (os.criado_por_id === usuario.id || os.criado_por_id === usuario.firebaseUid))
            ),
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
