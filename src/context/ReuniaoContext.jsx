import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, orderBy,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';
import { useAuth } from './AuthContext';
import { StatusReuniao } from '../models/Reuniao';

const ReuniaoContext = createContext(null);

export function ReuniaoProvider({ children }) {
    const { user } = useAuth();
    const [reunioes, setReunioes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchReunioes = useCallback(async () => {
        if (!isFirebaseConfigured || !db || !user?.id) {
            setReunioes([]);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const q = query(
                collection(db, 'reunioes'),
                where('visivel_para', 'array-contains', user.id),
                orderBy('data_inicio', 'asc'),
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));
            setReunioes(data);
        } catch (err) {
            setError(err.message || 'Erro ao buscar reuniões');
            setReunioes([]);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchReunioes();
    }, [fetchReunioes]);

    const criarReuniao = useCallback(async (reuniaoData) => {
        if (!isFirebaseConfigured || !db) {
            throw new Error('Firebase não configurado');
        }

        try {
            // visivel_para: criador + todos os participantes selecionados
            const participanteIds = (reuniaoData.participantes || []).map((p) => p.id).filter(Boolean);
            const visivelPara = [...new Set([reuniaoData.criado_por_id, ...participanteIds].filter(Boolean))];

            const docRef = await addDoc(collection(db, 'reunioes'), {
                ...reuniaoData,
                visivel_para: visivelPara,
                status: StatusReuniao.AGENDADA,
                criado_em: new Date().toISOString(),
            });

            const novaReuniao = {
                id: docRef.id,
                ...reuniaoData,
                visivel_para: visivelPara,
                status: StatusReuniao.AGENDADA,
                criado_em: new Date().toISOString(),
            };

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
            // Recalcula visivel_para ao atualizar
            const participanteIds = (dados.participantes || []).map((p) => p.id).filter(Boolean);
            const visivelPara = [...new Set([dados.criado_por_id, ...participanteIds].filter(Boolean))];
            const payload = { ...dados, visivel_para: visivelPara, atualizado_em: new Date().toISOString() };

            await updateDoc(doc(db, 'reunioes', id), payload);

            setReunioes((prev) =>
                prev
                    .map((r) => (r.id === id ? { ...r, ...payload } : r))
                    .sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio))
            );
        } catch (err) {
            throw new Error(`Erro ao atualizar reunião: ${err.message}`);
        }
    }, []);

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
