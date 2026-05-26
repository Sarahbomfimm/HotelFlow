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

const AUDITORIAS_STORAGE_KEY = 'hotelflow:auditorias:5s:v1';
const AUDITORIA_LINKS_STORAGE_KEY = 'hotelflow:auditorias:links:v1';
const AUDITORIAS_COLLECTION = 'auditorias5s';
const AUDITORIA_LINKS_DOC_ID = 'auditorias';
const AUDITORIA_LINKS_COLLECTION = 'appSettings';

function normalizeAuditRecord(id, data) {
    return {
        id,
        setor: data?.setor || '',
        mes: data?.mes || '',
        observacoes: data?.observacoes || '',
        criadoPorId: data?.criadoPorId || null,
        criadoPorNome: data?.criadoPorNome || 'Usuario',
        createdAt: data?.createdAt || new Date().toISOString(),
        updatedAt: data?.updatedAt || null,
        maxScore: Number(data?.maxScore || 100),
        total: Number(data?.total || 0),
        senseTotals: data?.senseTotals && typeof data.senseTotals === 'object' ? data.senseTotals : {},
        scores: data?.scores && typeof data.scores === 'object' ? data.scores : {},
    };
}

function serializeAuditRecord(audit) {
    const normalized = normalizeAuditRecord(audit?.id || `${Date.now()}`, audit);
    const { id, ...payload } = normalized;
    return payload;
}

function mergeAuditInCache(audit) {
    const current = readStoredAudits();
    const next = [audit, ...current.filter((item) => item.id !== audit.id)];
    writeStoredAudits(next);
    return next;
}

function removeAuditFromCache(auditId) {
    const next = readStoredAudits().filter((item) => item.id !== auditId);
    writeStoredAudits(next);
    return next;
}

async function migrateStoredAuditsToFirestore(audits) {
    if (!isFirebaseConfigured || !db || !Array.isArray(audits) || audits.length === 0) {
        return;
    }

    await Promise.all(
        audits.map((audit) => {
            const auditId = audit?.id || doc(collection(db, AUDITORIAS_COLLECTION)).id;
            return setDoc(doc(db, AUDITORIAS_COLLECTION, auditId), serializeAuditRecord({ ...audit, id: auditId }), { merge: true });
        }),
    );
}

export function readStoredAudits() {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(AUDITORIAS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredAudits(audits) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDITORIAS_STORAGE_KEY, JSON.stringify(audits));
}

export function subscribeAudits(onData, onError) {
    if (!isFirebaseConfigured || !db) {
        onData(readStoredAudits());
        return () => {};
    }

    const auditsQuery = query(collection(db, AUDITORIAS_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(auditsQuery, (snapshot) => {
        if (snapshot.empty) {
            const fallbackAudits = readStoredAudits();
            onData(fallbackAudits);

            if (fallbackAudits.length > 0) {
                void migrateStoredAuditsToFirestore(fallbackAudits).catch(() => {});
            }
            return;
        }

        const firestoreAudits = snapshot.docs.map((snapshotDoc) => normalizeAuditRecord(snapshotDoc.id, snapshotDoc.data()));
        writeStoredAudits(firestoreAudits);
        onData(firestoreAudits);
    }, (error) => {
        const fallbackAudits = readStoredAudits();
        onData(fallbackAudits);
        onError?.(error);
    });
}

export async function saveAudit(audit) {
    const auditId = audit?.id || `${Date.now()}`;
    const normalized = normalizeAuditRecord(auditId, audit);
    mergeAuditInCache(normalized);

    if (!isFirebaseConfigured || !db) {
        return normalized;
    }

    await setDoc(doc(db, AUDITORIAS_COLLECTION, auditId), serializeAuditRecord(normalized), { merge: true });
    return normalized;
}

export async function deleteAudit(auditId) {
    removeAuditFromCache(auditId);

    if (!isFirebaseConfigured || !db) {
        return;
    }

    await deleteDoc(doc(db, AUDITORIAS_COLLECTION, auditId));
}

export function readStoredAuditLinks() {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(AUDITORIA_LINKS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function writeStoredAuditLinks(linksByDepartment) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDITORIA_LINKS_STORAGE_KEY, JSON.stringify(linksByDepartment || {}));
}

function sanitizeAuditLinksMap(linksByDepartment) {
    if (!linksByDepartment || typeof linksByDepartment !== 'object' || Array.isArray(linksByDepartment)) {
        return {};
    }

    return Object.entries(linksByDepartment).reduce((acc, [department, value]) => {
        const normalizedDepartment = String(department || '').trim();
        const normalizedLink = normalizeAuditLink(value);

        if (normalizedDepartment && normalizedLink) {
            acc[normalizedDepartment] = normalizedLink;
        }

        return acc;
    }, {});
}

export function subscribeAuditLinks(onData, onError) {
    if (!isFirebaseConfigured || !db) {
        onData(sanitizeAuditLinksMap(readStoredAuditLinks()));
        return () => {};
    }

    const settingsRef = doc(db, AUDITORIA_LINKS_COLLECTION, AUDITORIA_LINKS_DOC_ID);

    return onSnapshot(settingsRef, (snapshot) => {
        const firestoreLinks = sanitizeAuditLinksMap(snapshot.data()?.linksByDepartment);
        const fallbackLinks = sanitizeAuditLinksMap(readStoredAuditLinks());
        const nextLinks = Object.keys(firestoreLinks).length > 0 ? firestoreLinks : fallbackLinks;

        writeStoredAuditLinks(nextLinks);
        onData(nextLinks);
    }, (error) => {
        const fallbackLinks = sanitizeAuditLinksMap(readStoredAuditLinks());
        onData(fallbackLinks);
        onError?.(error);
    });
}

export async function saveAuditLinks(linksByDepartment) {
    const sanitized = sanitizeAuditLinksMap(linksByDepartment);
    writeStoredAuditLinks(sanitized);

    if (!isFirebaseConfigured || !db) {
        return sanitized;
    }

    const settingsRef = doc(db, AUDITORIA_LINKS_COLLECTION, AUDITORIA_LINKS_DOC_ID);
    await setDoc(settingsRef, {
        linksByDepartment: sanitized,
        updatedAt: new Date().toISOString(),
    }, { merge: true });

    return sanitized;
}

export function normalizeAuditLink(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

export function getAuditLinkByDepartment(linksByDepartment, department) {
    if (!department) return '';
    return String(linksByDepartment?.[department] || '').trim();
}