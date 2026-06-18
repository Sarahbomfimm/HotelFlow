import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

const TREINAMENTOS_STORAGE_KEY = 'hotelflow:treinamentos:v1';
const TREINAMENTOS_COLLECTION = 'treinamentos';

function normalizeTreinamentoRecord(id, data) {
    return {
        id,
        tema: data?.tema || '',
        departamento: data?.departamento || '',
        data: data?.data || new Date().toISOString().slice(0, 10),
        duracao: data?.duracao || '',
        palestrante: data?.palestrante || '',
        descricao: data?.descricao || '',
        colaboradores: Array.isArray(data?.colaboradores) ? data.colaboradores : [],
        criadoPorId: data?.criadoPorId || null,
        criadoPorNome: data?.criadoPorNome || 'Usuário',
        createdAt: data?.createdAt || new Date().toISOString(),
        updatedAt: data?.updatedAt || null,
        pdf: data?.pdf || null,
        usersIds: Array.isArray(data?.usersIds) ? data.usersIds : [],
        customList: Array.isArray(data?.customList) ? data.customList : [],
    };
}

function serializeTreinamentoRecord(treinamento) {
    const normalized = normalizeTreinamentoRecord(treinamento?.id || `${Date.now()}`, treinamento);
    const { id, ...payload } = normalized;
    return payload;
}

function mergeTreinamentoInCache(treinamento) {
    const current = readStoredTreinamentos();
    const next = [treinamento, ...current.filter((item) => item.id !== treinamento.id)];
    writeStoredTreinamentos(next);
    return next;
}

function removeTreinamentoFromCache(treinamentoId) {
    const next = readStoredTreinamentos().filter((item) => item.id !== treinamentoId);
    writeStoredTreinamentos(next);
    return next;
}

async function migrateStoredTreinamentosToFirestore(treinamentos) {
    if (!isFirebaseConfigured || !db || !Array.isArray(treinamentos) || treinamentos.length === 0) {
        return;
    }

    await Promise.all(
        treinamentos.map((t) => {
            const tId = t?.id || doc(collection(db, TREINAMENTOS_COLLECTION)).id;
            return setDoc(doc(db, TREINAMENTOS_COLLECTION, tId), serializeTreinamentoRecord({ ...t, id: tId }), { merge: true });
        }),
    );
}

export function readStoredTreinamentos() {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(TREINAMENTOS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredTreinamentos(treinamentos) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TREINAMENTOS_STORAGE_KEY, JSON.stringify(treinamentos));
}

export function subscribeTreinamentos(onData, onError) {
    if (!isFirebaseConfigured || !db) {
        onData(readStoredTreinamentos());
        return () => {};
    }

    const tQuery = query(collection(db, TREINAMENTOS_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(tQuery, (snapshot) => {
        if (snapshot.empty) {
            const fallback = readStoredTreinamentos();
            onData(fallback);

            if (fallback.length > 0) {
                void migrateStoredTreinamentosToFirestore(fallback).catch(() => {});
            }
            return;
        }

        const firestoreTreinamentos = snapshot.docs.map((docSnap) => normalizeTreinamentoRecord(docSnap.id, docSnap.data()));
        writeStoredTreinamentos(firestoreTreinamentos);
        onData(firestoreTreinamentos);
    }, (error) => {
        const fallback = readStoredTreinamentos();
        onData(fallback);
        onError?.(error);
    });
}

export async function saveTreinamento(treinamento) {
    const tId = treinamento?.id || `${Date.now()}`;
    const normalized = normalizeTreinamentoRecord(tId, treinamento);
    mergeTreinamentoInCache(normalized);

    if (!isFirebaseConfigured || !db) {
        return normalized;
    }

    await setDoc(doc(db, TREINAMENTOS_COLLECTION, tId), serializeTreinamentoRecord(normalized), { merge: true });
    return normalized;
}

export async function deleteTreinamento(treinamentoId) {
    removeTreinamentoFromCache(treinamentoId);

    if (!isFirebaseConfigured || !db) {
        return;
    }

    await deleteDoc(doc(db, TREINAMENTOS_COLLECTION, treinamentoId));
}
