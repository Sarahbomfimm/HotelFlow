import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    collection, query, addDoc, updateDoc, deleteDoc, doc, where, onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';
import { createUserNotification } from '../services/notifications';
import { enviarNotificacaoTelegramReuniao } from '../services/telegramService';
import { useAuth } from './AuthContext';
import { StatusReuniao } from '../models/Reuniao';

const ReuniaoContext = createContext(null);

function normalizeText(value) {
    return String(value || '').trim();
}

function sameParticipants(left = [], right = []) {
    const leftIds = left.map((item) => item.id).filter(Boolean).sort();
    const rightIds = right.map((item) => item.id).filter(Boolean).sort();
    return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

function buildHistoricoEntry(usuarioNome, descricao) {
    return {
        data: new Date().toISOString(),
        usuario_nome: usuarioNome || 'Sistema',
        descricao,
    };
}

function normalizeIdentityValue(value) {
    return String(value || '').trim().toLowerCase();
}

function buildVisibilityKeys(entity) {
    return Array.from(new Set([
        entity?.id,
        entity?.uid,
        entity?.firebaseUid,
        normalizeIdentityValue(entity?.email),
    ].map((value) => String(value || '').trim()).filter(Boolean)));
}

function describeMeetingChanges(anterior, proxima) {
    const changes = [];

    if (normalizeText(anterior.titulo) !== normalizeText(proxima.titulo)) changes.push('Título');
    if (normalizeText(anterior.data_inicio) !== normalizeText(proxima.data_inicio)) changes.push('Data e hora de início');
    if (normalizeText(anterior.data_fim) !== normalizeText(proxima.data_fim)) changes.push('Data e hora de término');
    if (normalizeText(anterior.hora_fim) !== normalizeText(proxima.hora_fim)) changes.push('Horário de término');
    if (normalizeText(anterior.sala) !== normalizeText(proxima.sala)) changes.push('Sala');
    if (normalizeText(anterior.recorrencia) !== normalizeText(proxima.recorrencia)) changes.push('Recorrência');
    if (normalizeText(anterior.descricao) !== normalizeText(proxima.descricao)) changes.push('Pauta');
    if (normalizeText(anterior.ata) !== normalizeText(proxima.ata)) changes.push('Ata');
    if (!sameParticipants(anterior.participantes, proxima.participantes)) changes.push('Participantes');

    return changes;
}

export function ReuniaoProvider({ children }) {
    const { user } = useAuth();
    const [reunioes, setReunioes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchReunioes = useCallback(async () => {
        const actorKeys = buildVisibilityKeys(user);

        if (!isFirebaseConfigured || !db || actorKeys.length === 0) {
            setReunioes([]);
            return;
        }

        setLoading(true);
        setError(null);
        const q = query(
            collection(db, 'reunioes'),
            where('visivel_para', 'array-contains-any', actorKeys.slice(0, 10)),
        );

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map((d) => ({
                    id: d.id,
                    ...d.data(),
                }))
                .sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

            setReunioes(data);
            setLoading(false);
            setError(null);
        }, (err) => {
            setError(err.message || 'Erro ao buscar reuniões');
            setReunioes([]);
            setLoading(false);
        });
    }, [user]);

    useEffect(() => {
        const unsubscribe = fetchReunioes();
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [fetchReunioes]);

    const criarReuniao = useCallback(async (reuniaoData) => {
        if (!isFirebaseConfigured || !db) {
            throw new Error('Firebase não configurado');
        }

        try {
            // visivel_para: criador + todos os participantes selecionados
            const visivelPara = Array.from(new Set([
                ...buildVisibilityKeys({
                    id: reuniaoData.criado_por_id,
                    firebaseUid: reuniaoData.criado_por_uid,
                    email: reuniaoData.criado_por_email,
                }),
                ...(reuniaoData.participantes || []).flatMap((p) => buildVisibilityKeys(p)),
            ]));

            const docRef = await addDoc(collection(db, 'reunioes'), {
                ...reuniaoData,
                visivel_para: visivelPara,
                status: StatusReuniao.AGENDADA,
                criado_em: new Date().toISOString(),
                historico: [buildHistoricoEntry(reuniaoData.criado_por_nome, 'Reunião criada.')],
            });

            const novaReuniao = {
                id: docRef.id,
                ...reuniaoData,
                visivel_para: visivelPara,
                status: StatusReuniao.AGENDADA,
                criado_em: new Date().toISOString(),
                historico: [buildHistoricoEntry(reuniaoData.criado_por_nome, 'Reunião criada.')],
            };

            const participantes = (reuniaoData.participantes || []).filter(
                (participante) => participante.id && participante.id !== reuniaoData.criado_por_id,
            );

            await Promise.allSettled(participantes.map(async (participante) => {
                await createUserNotification(
                    {
                        recipientUid: participante.id,
                        recipientEmail: participante.email,
                    },
                    {
                        message: `Você foi adicionado(a) à reunião "${reuniaoData.titulo}" em ${new Date(reuniaoData.data_inicio).toLocaleDateString('pt-BR')}.`,
                        type: 'info',
                    },
                );

                if (participante.telegram_chat_id) {
                    await enviarNotificacaoTelegramReuniao(participante.telegram_chat_id, novaReuniao, participante.nome);
                }
            }));

            setReunioes((prev) => [...prev, novaReuniao].sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio)));
            return novaReuniao;
        } catch (err) {
            throw new Error(`Erro ao criar reunião: ${err.message}`);
        }
    }, []);

    const atualizarReuniao = useCallback(async (id, dados) => {
        if (!isFirebaseConfigured || !db) {
            throw new Error('Firebase não configurado');
        }

        try {
            const reuniaoAtual = reunioes.find((item) => item.id === id);
            // Recalcula visivel_para ao atualizar
            const visivelPara = Array.from(new Set([
                ...buildVisibilityKeys({
                    id: dados.criado_por_id,
                    firebaseUid: dados.criado_por_uid,
                    email: dados.criado_por_email,
                }),
                ...(dados.participantes || []).flatMap((p) => buildVisibilityKeys(p)),
            ]));
            const camposAlterados = reuniaoAtual ? describeMeetingChanges(reuniaoAtual, dados) : [];
            const historico = [
                ...(Array.isArray(reuniaoAtual?.historico) ? reuniaoAtual.historico : []),
                buildHistoricoEntry(
                    user?.nome,
                    camposAlterados.length > 0
                        ? `Reunião atualizada. Campo(s): ${camposAlterados.join(', ')}.`
                        : 'Reunião atualizada.',
                ),
            ];
            const payload = { ...dados, visivel_para: visivelPara, atualizado_em: new Date().toISOString(), historico };

            await updateDoc(doc(db, 'reunioes', id), payload);

            const reuniaoAtualizada = { ...reuniaoAtual, ...payload, id };

            setReunioes((prev) =>
                prev
                    .map((r) => (r.id === id ? reuniaoAtualizada : r))
                    .sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio))
            );

            return reuniaoAtualizada;
        } catch (err) {
            throw new Error(`Erro ao atualizar reunião: ${err.message}`);
        }
    }, [reunioes, user?.nome]);

    const deletarReuniao = useCallback(async (id) => {
        if (!isFirebaseConfigured || !db) {
            throw new Error('Firebase não configurado');
        }

        try {
            await deleteDoc(doc(db, 'reunioes', id));
            setReunioes((prev) => prev.filter((r) => r.id !== id));
        } catch (err) {
            throw new Error(`Erro ao deletar reunião: ${err.message}`);
        }
    }, []);

    const reunioesPorData = useCallback((data) => {
        return reunioes.filter((r) => {
            const dataReuniao = new Date(r.data_inicio);
            return dataReuniao.toDateString() === data.toDateString();
        });
    }, [reunioes]);

    const reunioesPorMes = useCallback((ano, mes) => {
        return reunioes.filter((r) => {
            const dataReuniao = new Date(r.data_inicio);
            return dataReuniao.getFullYear() === ano && dataReuniao.getMonth() === mes;
        });
    }, [reunioes]);

    return (
        <ReuniaoContext.Provider
            value={{
                reunioes,
                loading,
                error,
                criarReuniao,
                atualizarReuniao,
                deletarReuniao,
                reunioesPorData,
                reunioesPorMes,
                fetchReunioes,
            }}
        >
            {children}
        </ReuniaoContext.Provider>
    );
}

export function useReuniao() {
    const context = useContext(ReuniaoContext);
    if (!context) {
        throw new Error('useReuniao must be used within ReuniaoProvider');
    }
    return context;
}
