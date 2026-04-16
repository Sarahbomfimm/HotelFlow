import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { playChime } from '../utils/sounds';
import { useAuth } from './AuthContext';
import { db, isFirebaseConfigured } from '../services/firebase';

const NotificationContext = createContext(null);
const TOAST_DURATION = 6000;

let notifId = 1;

export function NotificationProvider({ children }) {
    const { user, authReady } = useAuth();
    const [localNotifications, setLocalNotifications] = useState([]);
    const [storedNotifications, setStoredNotifications] = useState([]);
    const [dismissedToastIds, setDismissedToastIds] = useState({});
    const [error, setError] = useState('');
    const timeoutsRef = useRef({});
    const playedChimesRef = useRef({});

    const currentUserId = user?.firebaseUid || user?.id || null;
    const currentUserEmail = user?.email?.toLowerCase() || null;

    const scheduleToastDismiss = useCallback((id, createdAt) => {
        if (timeoutsRef.current[id]) {
            return;
        }

        const age = Date.now() - new Date(createdAt).getTime();
        const delay = Math.max(0, TOAST_DURATION - age);

        timeoutsRef.current[id] = setTimeout(() => {
            setDismissedToastIds((prev) => ({ ...prev, [id]: true }));
            delete timeoutsRef.current[id];
        }, delay);
    }, []);

    useEffect(() => {
        if (!isFirebaseConfigured || !db) {
            setStoredNotifications([]);
            setError('');
            return undefined;
        }

        if (!authReady) {
            setError('');
            return undefined;
        }

        if (!currentUserId && !currentUserEmail) {
            setStoredNotifications([]);
            setError('');
            return undefined;
        }

        const unsubscribes = [];
        const snapshotsBySource = { uid: [], email: [] };

        const pushNotifications = () => {
            const merged = new Map();

            [...snapshotsBySource.uid, ...snapshotsBySource.email].forEach((notificationDoc) => {
                const data = notificationDoc.data();
                const createdAt = data.createdAt || new Date().toISOString();

                scheduleToastDismiss(notificationDoc.id, createdAt);

                if (!playedChimesRef.current[notificationDoc.id] && data.type === 'new_os') {
                    playChime();
                    playedChimesRef.current[notificationDoc.id] = true;
                }

                merged.set(notificationDoc.id, {
                    id: notificationDoc.id,
                    persisted: true,
                    message: data.message,
                    type: data.type || 'info',
                    lida: Boolean(data.lida),
                    toastDismissed: Boolean(dismissedToastIds[notificationDoc.id]),
                    criadoEm: createdAt,
                    relatedOrderId: data.relatedOrderId || null,
                });
            });

            const items = Array.from(merged.values())
                .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

            setStoredNotifications(items);
            setError('');
        };

        const handleError = () => {
            setStoredNotifications([]);
            setError('Nao foi possivel carregar as notificacoes do Firestore. Verifique as regras da colecao notifications.');
        };

        if (currentUserId) {
            const notificationsByUid = query(
                collection(db, 'notifications'),
                where('recipientUid', '==', currentUserId),
            );

            unsubscribes.push(onSnapshot(notificationsByUid, (snapshot) => {
                snapshotsBySource.uid = snapshot.docs;
                pushNotifications();
            }, handleError));
        }

        if (currentUserEmail) {
            const notificationsByEmail = query(
                collection(db, 'notifications'),
                where('recipientEmail', '==', currentUserEmail),
            );

            unsubscribes.push(onSnapshot(notificationsByEmail, (snapshot) => {
                snapshotsBySource.email = snapshot.docs;
                pushNotifications();
            }, handleError));
        }

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [authReady, currentUserEmail, currentUserId, dismissedToastIds, scheduleToastDismiss]);

    useEffect(() => {
        setLocalNotifications([]);
        setStoredNotifications([]);
        setDismissedToastIds({});
        timeoutsRef.current = {};
        playedChimesRef.current = {};
    }, [currentUserEmail, currentUserId]);

    const addNotification = useCallback((message, type = 'info') => {
        const id = `local-${notifId++}`;
        if (type === 'new_os') playChime();
        const createdAt = new Date().toISOString();
        setLocalNotifications((prev) => [{
            id,
            persisted: false,
            message,
            type,
            lida: false,
            toastDismissed: false,
            criadoEm: createdAt,
        }, ...prev]);
        scheduleToastDismiss(id, createdAt);
    }, [scheduleToastDismiss]);

    const notifications = useMemo(
        () => [...localNotifications, ...storedNotifications]
            .map((notification) => ({
                ...notification,
                toastDismissed: Boolean(dismissedToastIds[notification.id] || notification.toastDismissed),
            }))
            .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)),
        [dismissedToastIds, localNotifications, storedNotifications],
    );

    const marcarLida = useCallback(async (id) => {
        if (id.startsWith('local-')) {
            setLocalNotifications((prev) =>
                prev.map((notification) => (notification.id === id ? { ...notification, lida: true } : notification)),
            );
            return;
        }

        if (!db || !currentUserId) {
            return;
        }

        await updateDoc(doc(db, 'notifications', id), { lida: true });
    }, [currentUserId]);

    const marcarTodasLidas = useCallback(async () => {
        setLocalNotifications((prev) => prev.map((notification) => ({ ...notification, lida: true })));

        if (!db || !currentUserId) {
            return;
        }

        const unreadStored = storedNotifications.filter((notification) => !notification.lida);
        if (unreadStored.length === 0) {
            return;
        }

        const batch = writeBatch(db);
        unreadStored.forEach((notification) => {
            batch.update(doc(db, 'notifications', notification.id), { lida: true });
        });
        await batch.commit();
    }, [currentUserId, storedNotifications]);

    const remover = useCallback(async (id) => {
        clearTimeout(timeoutsRef.current[id]);
        delete timeoutsRef.current[id];
        setDismissedToastIds((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });

        if (id.startsWith('local-')) {
            setLocalNotifications((prev) => prev.filter((notification) => notification.id !== id));
            return;
        }

        if (!db || !currentUserId) {
            return;
        }

        await deleteDoc(doc(db, 'notifications', id));
    }, [currentUserId]);

    const naoLidas = notifications.filter((n) => !n.lida).length;

    return (
        <NotificationContext.Provider
            value={{ notifications, addNotification, marcarLida, marcarTodasLidas, remover, naoLidas, error }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotification deve ser usado dentro de NotificationProvider');
    return ctx;
}
