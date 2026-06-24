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

const INDICADORES_STORAGE_KEY = 'hotelflow:indicadores:v1';
const INDICADORES_COLLECTION = 'indicadores';

function normalizeIndicadorRecord(id, data) {
    return {
        id,
        departamento: data?.departamento || '',
        mes: data?.mes || '', // Formato YYYY-MM
        porcentagem: typeof data?.porcentagem === 'number' ? data.porcentagem : 0,
        linkPlanilha: data?.linkPlanilha || '',
        atualizadoPor: data?.atualizadoPor || 'Sistema',
        updatedAt: data?.updatedAt || new Date().toISOString(),
    };
}

function serializeIndicadorRecord(record) {
    const normalized = normalizeIndicadorRecord(record?.id || `${record.departamento}_${record.mes}`, record);
    const { id, ...payload } = normalized;
    return payload;
}

export function readStoredIndicadores() {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(INDICADORES_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredIndicadores(data) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(INDICADORES_STORAGE_KEY, JSON.stringify(data));
}

export function subscribeIndicadores(onData, onError) {
    if (!isFirebaseConfigured || !db) {
        onData(readStoredIndicadores());
        return () => {};
    }

    const q = query(collection(db, INDICADORES_COLLECTION), orderBy('updatedAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            const fallback = readStoredIndicadores();
            onData(fallback);
            return;
        }

        const list = snapshot.docs.map((docSnap) => normalizeIndicadorRecord(docSnap.id, docSnap.data()));
        writeStoredIndicadores(list);
        onData(list);
    }, (error) => {
        const fallback = readStoredIndicadores();
        onData(fallback);
        onError?.(error);
    });
}

export async function saveIndicador(record) {
    const id = record?.id || `${record.departamento}_${record.mes}`;
    const normalized = normalizeIndicadorRecord(id, record);
    
    // Atualiza cache local
    const current = readStoredIndicadores();
    const next = [normalized, ...current.filter((item) => item.id !== id)];
    writeStoredIndicadores(next);

    if (!isFirebaseConfigured || !db) {
        return normalized;
    }

    await setDoc(doc(db, INDICADORES_COLLECTION, id), serializeIndicadorRecord(normalized), { merge: true });
    return normalized;
}

export async function deleteIndicador(id) {
    const next = readStoredIndicadores().filter((item) => item.id !== id);
    writeStoredIndicadores(next);

    if (!isFirebaseConfigured || !db) {
        return;
    }

    await deleteDoc(doc(db, INDICADORES_COLLECTION, id));
}
