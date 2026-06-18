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

const POPS_STORAGE_KEY = 'hotelflow:pops:v1';
const POPS_COLLECTION = 'pops';

function normalizePopRecord(id, data) {
    return {
        id,
        titulo: data?.titulo || '',
        departamento: data?.departamento || '',
        descricao: data?.descricao || '',
        pdf: data?.pdf || null, // { name: string, data: base64 string }
        criadoPorId: data?.criadoPorId || null,
        criadoPorNome: data?.criadoPorNome || 'Usuário',
        createdAt: data?.createdAt || new Date().toISOString(),
        updatedAt: data?.updatedAt || null,
    };
}

function serializePopRecord(pop) {
    const normalized = normalizePopRecord(pop?.id || `${Date.now()}`, pop);
    const { id, ...payload } = normalized;
    return payload;
}

function mergePopInCache(pop) {
    const current = readStoredPops();
    const next = [pop, ...current.filter((item) => item.id !== pop.id)];
    writeStoredPops(next);
    return next;
}

function removePopFromCache(popId) {
    const next = readStoredPops().filter((item) => item.id !== popId);
    writeStoredPops(next);
    return next;
}

async function migrateStoredPopsToFirestore(pops) {
    if (!isFirebaseConfigured || !db || !Array.isArray(pops) || pops.length === 0) {
        return;
    }

    await Promise.all(
        pops.map((p) => {
            const pId = p?.id || doc(collection(db, POPS_COLLECTION)).id;
            return setDoc(doc(db, POPS_COLLECTION, pId), serializePopRecord({ ...p, id: pId }), { merge: true });
        }),
    );
}

export function readStoredPops() {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(POPS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredPops(pops) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(POPS_STORAGE_KEY, JSON.stringify(pops));
}

export function subscribePops(onData, onError) {
    if (!isFirebaseConfigured || !db) {
        onData(readStoredPops());
        return () => {};
    }

    const pQuery = query(collection(db, POPS_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(pQuery, (snapshot) => {
        if (snapshot.empty) {
            const fallback = readStoredPops();
            onData(fallback);

            if (fallback.length > 0) {
                void migrateStoredPopsToFirestore(fallback).catch(() => {});
            }
            return;
        }

        const firestorePops = snapshot.docs.map((docSnap) => normalizePopRecord(docSnap.id, docSnap.data()));
        writeStoredPops(firestorePops);
        onData(firestorePops);
    }, (error) => {
        const fallback = readStoredPops();
        onData(fallback);
        onError?.(error);
    });
}

export async function savePop(pop) {
    const pId = pop?.id || `${Date.now()}`;
    const normalized = normalizePopRecord(pId, pop);
    mergePopInCache(normalized);

    if (!isFirebaseConfigured || !db) {
        return normalized;
    }

    await setDoc(doc(db, POPS_COLLECTION, pId), serializePopRecord(normalized), { merge: true });
    return normalized;
}

export async function deletePop(popId) {
    removePopFromCache(popId);

    if (!isFirebaseConfigured || !db) {
        return;
    }

    await deleteDoc(doc(db, POPS_COLLECTION, popId));
}
