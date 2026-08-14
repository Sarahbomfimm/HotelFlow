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

const CATEGORIES_STORAGE_KEY = 'hotelflow:document_categories:v1';
const DOCUMENTS_STORAGE_KEY = 'hotelflow:documentos:v1';

const CATEGORIES_COLLECTION = 'document_categories';
const DOCUMENTS_COLLECTION = 'documentos';

function normalizeCategoryRecord(id, data) {
    return {
        id,
        titulo: data?.titulo || '',
        descricao: data?.descricao || '',
        criadoPorId: data?.criadoPorId || null,
        criadoPorNome: data?.criadoPorNome || 'Usuário',
        createdAt: data?.createdAt || new Date().toISOString(),
    };
}

function serializeCategoryRecord(category) {
    const normalized = normalizeCategoryRecord(category?.id || `${Date.now()}`, category);
    delete normalized.id;
    return normalized;
}

function normalizeDocumentRecord(id, data) {
    return {
        id,
        categoryId: data?.categoryId || '',
        titulo: data?.titulo || '',
        descricao: data?.descricao || '',
        pdf: data?.pdf || null, // { name: string, data: url }
        criadoPorId: data?.criadoPorId || null,
        criadoPorNome: data?.criadoPorNome || 'Usuário',
        createdAt: data?.createdAt || new Date().toISOString(),
    };
}

function serializeDocumentRecord(docRec) {
    const normalized = normalizeDocumentRecord(docRec?.id || `${Date.now()}`, docRec);
    delete normalized.id;
    return normalized;
}

// CACHE FUNCTIONS FOR CATEGORIES
export function readStoredCategories() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredCategories(categories) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

function mergeCategoryInCache(category) {
    const current = readStoredCategories();
    const next = [category, ...current.filter((item) => item.id !== category.id)];
    writeStoredCategories(next);
    return next;
}

function removeCategoryFromCache(categoryId) {
    const next = readStoredCategories().filter((item) => item.id !== categoryId);
    writeStoredCategories(next);
    return next;
}

// CACHE FUNCTIONS FOR DOCUMENTS
export function readStoredDocuments() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(DOCUMENTS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredDocuments(docs) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(docs));
}

function mergeDocumentInCache(docRec) {
    const current = readStoredDocuments();
    const next = [docRec, ...current.filter((item) => item.id !== docRec.id)];
    writeStoredDocuments(next);
    return next;
}

function removeDocumentFromCache(docId) {
    const next = readStoredDocuments().filter((item) => item.id !== docId);
    writeStoredDocuments(next);
    return next;
}

// FIRESTORE SYNC
async function migrateCategoriesToFirestore(categories) {
    if (!isFirebaseConfigured || !db || !Array.isArray(categories) || categories.length === 0) return;
    await Promise.all(
        categories.map((c) => {
            const cId = c?.id || doc(collection(db, CATEGORIES_COLLECTION)).id;
            return setDoc(doc(db, CATEGORIES_COLLECTION, cId), serializeCategoryRecord({ ...c, id: cId }), { merge: true });
        }),
    );
}

async function migrateDocumentsToFirestore(docs) {
    if (!isFirebaseConfigured || !db || !Array.isArray(docs) || docs.length === 0) return;
    await Promise.all(
        docs.map((d) => {
            const dId = d?.id || doc(collection(db, DOCUMENTS_COLLECTION)).id;
            return setDoc(doc(db, DOCUMENTS_COLLECTION, dId), serializeDocumentRecord({ ...d, id: dId }), { merge: true });
        }),
    );
}

// SUBSCRIPTIONS
export function subscribeCategories(onData, onError) {
    if (!isFirebaseConfigured || !db) {
        onData(readStoredCategories());
        return () => {};
    }
    const cQuery = query(collection(db, CATEGORIES_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(cQuery, (snapshot) => {
        if (snapshot.empty) {
            const fallback = readStoredCategories();
            onData(fallback);
            if (fallback.length > 0) {
                void migrateCategoriesToFirestore(fallback).catch(() => {});
            }
            return;
        }
        const firestoreCats = snapshot.docs.map((docSnap) => normalizeCategoryRecord(docSnap.id, docSnap.data()));
        writeStoredCategories(firestoreCats);
        onData(firestoreCats);
    }, (error) => {
        const fallback = readStoredCategories();
        onData(fallback);
        onError?.(error);
    });
}

export function subscribeDocuments(onData, onError) {
    if (!isFirebaseConfigured || !db) {
        onData(readStoredDocuments());
        return () => {};
    }
    const dQuery = query(collection(db, DOCUMENTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(dQuery, (snapshot) => {
        if (snapshot.empty) {
            const fallback = readStoredDocuments();
            onData(fallback);
            if (fallback.length > 0) {
                void migrateDocumentsToFirestore(fallback).catch(() => {});
            }
            return;
        }
        const firestoreDocs = snapshot.docs.map((docSnap) => normalizeDocumentRecord(docSnap.id, docSnap.data()));
        writeStoredDocuments(firestoreDocs);
        onData(firestoreDocs);
    }, (error) => {
        const fallback = readStoredDocuments();
        onData(fallback);
        onError?.(error);
    });
}

// SAVE & DELETE
export async function saveCategory(category) {
    const cId = category?.id || `${Date.now()}`;
    const normalized = normalizeCategoryRecord(cId, category);
    mergeCategoryInCache(normalized);

    if (!isFirebaseConfigured || !db) {
        return normalized;
    }
    await setDoc(doc(db, CATEGORIES_COLLECTION, cId), serializeCategoryRecord(normalized), { merge: true });
    return normalized;
}

export async function deleteCategory(categoryId) {
    removeCategoryFromCache(categoryId);

    // Delete all documents in this category too from cache
    const currentDocs = readStoredDocuments();
    const nextDocs = currentDocs.filter(d => d.categoryId !== categoryId);
    writeStoredDocuments(nextDocs);

    if (!isFirebaseConfigured || !db) {
        return;
    }
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, categoryId));
}

export async function saveDocument(docRec) {
    const dId = docRec?.id || `${Date.now()}`;
    const normalized = normalizeDocumentRecord(dId, docRec);
    mergeDocumentInCache(normalized);

    if (!isFirebaseConfigured || !db) {
        return normalized;
    }
    await setDoc(doc(db, DOCUMENTS_COLLECTION, dId), serializeDocumentRecord(normalized), { merge: true });
    return normalized;
}

export async function deleteDocument(docId) {
    removeDocumentFromCache(docId);
    if (!isFirebaseConfigured || !db) {
        return;
    }
    await deleteDoc(doc(db, DOCUMENTS_COLLECTION, docId));
}
