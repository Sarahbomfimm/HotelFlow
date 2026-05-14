import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { USERS } from '../data/mockData';
import { db, isFirebaseConfigured } from '../services/firebase';
import { UserRole } from '../models/User';
import { useAuth } from './AuthContext';

const UsersContext = createContext(null);

function getTelegramStorageKey(email) {
    if (!email) return null;
    return `hotelflow:telegram_chat_id:${email.toLowerCase()}`;
}

function readStoredTelegramChatId(email) {
    if (typeof window === 'undefined') return null;
    const key = getTelegramStorageKey(email);
    if (!key) return null;
    return window.localStorage.getItem(key);
}

function writeStoredTelegramChatId(email, chatId) {
    if (typeof window === 'undefined') return;
    const key = getTelegramStorageKey(email);
    if (!key) return;

    if (chatId) {
        window.localStorage.setItem(key, chatId);
        return;
    }

    window.localStorage.removeItem(key);
}

function sanitizeMockUsers() {
    return USERS.map(({ senha: _omit, ...safeUser }) => safeUser);
}

function mergeUsersWithFallback(firebaseUsers) {
    const merged = new Map(
        sanitizeMockUsers().map((user) => [user.email.toLowerCase(), user]),
    );

    firebaseUsers.forEach((user) => {
        const emailKey = user.email?.toLowerCase();
        if (!emailKey) {
            return;
        }

        const fallbackUser = merged.get(emailKey);
        const hasTelefone = Object.prototype.hasOwnProperty.call(user, 'telefone');
        const hasTelegramChatId = Object.prototype.hasOwnProperty.call(user, 'telegram_chat_id');

        merged.set(emailKey, {
            ...fallbackUser,
            ...user,
            id: user.id,
            firebaseUid: user.firebaseUid || user.id,
            telefone: hasTelefone ? user.telefone : fallbackUser?.telefone || null,
            telegram_chat_id: hasTelegramChatId ? user.telegram_chat_id : fallbackUser?.telegram_chat_id || null,
            departamentos: Array.isArray(user.departamentos)
                ? user.departamentos
                : fallbackUser?.departamentos || [],
        });
    });

    return Array.from(merged.values());
}

export function UsersProvider({ children }) {
    const { user, authReady } = useAuth();
    const [users, setUsers] = useState(sanitizeMockUsers);
    const [loading, setLoading] = useState(Boolean(isFirebaseConfigured && db));

    useEffect(() => {
        if (!isFirebaseConfigured || !db) {
            setUsers(sanitizeMockUsers());
            setLoading(false);
            return undefined;
        }

        if (!authReady) {
            setLoading(true);
            return undefined;
        }

        if (!user) {
            setUsers(sanitizeMockUsers());
            setLoading(false);
            return undefined;
        }

        const usersQuery = query(collection(db, 'users'), orderBy('nome'));

        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            if (snapshot.empty) {
                setUsers(sanitizeMockUsers());
            } else {
                const firebaseUsers = snapshot.docs.map((userDoc) => ({
                    id: userDoc.id,
                    ...userDoc.data(),
                    departamentos: Array.isArray(userDoc.data().departamentos)
                        ? userDoc.data().departamentos
                        : [],
                }));

                setUsers(mergeUsersWithFallback(firebaseUsers));
            }
            setLoading(false);
        }, () => {
            setUsers(sanitizeMockUsers());
            setLoading(false);
        });

        return unsubscribe;
    }, [authReady, user]);

    const normalizedUsers = useMemo(() => {
        const diretora = users.find((item) => item.role === UserRole.DIRETORA);

        return users
            .map((item) => {
                if (item.role === UserRole.DIRETORA) {
                    const departamentos = Array.isArray(item.departamentos) ? item.departamentos : [];
                    return departamentos.includes('Financeiro')
                        ? item
                        : { ...item, departamentos: [...departamentos, 'Financeiro'] };
                }

                if (item.role === UserRole.LIDER) {
                    return {
                        ...item,
                        departamentos: (item.departamentos || []).filter((departamento) => departamento !== 'Financeiro'),
                    };
                }

                return item;
            })
            .filter((item) => {
                if (item.role !== UserRole.LIDER) {
                    return true;
                }

                return (item.departamentos || []).length > 0 || item.id !== diretora?.id;
            });
    }, [users]);

    const lideres = useMemo(
        () => normalizedUsers.filter((item) => item.role === UserRole.LIDER && (item.departamentos || []).length > 0),
        [normalizedUsers],
    );

    const deptLeaderMap = useMemo(() => {
        const mapping = {};

        normalizedUsers.forEach((responsavel) => {
            if (!Array.isArray(responsavel.departamentos) || responsavel.departamentos.length === 0) {
                return;
            }

            responsavel.departamentos.forEach((departamento) => {
                mapping[departamento] = {
                    id: responsavel.id,
                    firebaseUid: responsavel.firebaseUid || null,
                    nome: responsavel.nome,
                    email: responsavel.email,
                    telefone: responsavel.telefone || null,
                    telegram_chat_id: responsavel.telegram_chat_id || null,
                };
            });
        });

        return mapping;
    }, [normalizedUsers]);

    const getLeaderByDepartment = useCallback(
        (departamento) => deptLeaderMap[departamento] || null,
        [deptLeaderMap],
    );

    const currentUserProfile = useMemo(() => {
        if (!user) return null;

        const storedTelegramChatId = readStoredTelegramChatId(user.email);

        const byUid = normalizedUsers.find(
            (u) => u.firebaseUid === user.firebaseUid || u.id === user.firebaseUid || u.id === user.id,
        );
        if (byUid) {
            return {
                ...byUid,
                telegram_chat_id: byUid.telegram_chat_id || storedTelegramChatId || null,
            };
        }

        const byEmail = normalizedUsers.find((u) => u.email?.toLowerCase() === user.email?.toLowerCase()) || null;
        if (!byEmail) return null;

        return {
            ...byEmail,
            telegram_chat_id: byEmail.telegram_chat_id || storedTelegramChatId || null,
        };
    }, [normalizedUsers, user]);

    const updateTelegramChatId = useCallback(async (chatId) => {
        writeStoredTelegramChatId(currentUserProfile?.email || user?.email, chatId);

        // Atualiza estado local imediatamente
        setUsers((prev) =>
            prev.map((u) =>
                u.id === currentUserProfile?.id
                    || u.firebaseUid === user?.firebaseUid
                    || u.email?.toLowerCase() === user?.email?.toLowerCase()
                    ? { ...u, telegram_chat_id: chatId }
                    : u,
            ),
        );

        if (!isFirebaseConfigured || !db || !user) return;

        const docId = currentUserProfile?.id || user.firebaseUid || user.id;
        if (!docId) return;

        try {
            await updateDoc(doc(db, 'users', docId), {
                telegram_chat_id: chatId,
                email: currentUserProfile?.email || user.email || '',
                nome: currentUserProfile?.nome || user.nome || '',
                firebaseUid: user.firebaseUid || user.id || null,
            });
        } catch {
            // Se doc não existe, cria com merge
            await setDoc(
                doc(db, 'users', docId),
                {
                    telegram_chat_id: chatId,
                    email: currentUserProfile?.email || user.email || '',
                    nome: currentUserProfile?.nome || user.nome || '',
                    firebaseUid: user.firebaseUid || user.id || null,
                },
                { merge: true },
            );
        }
    }, [currentUserProfile, user]);

    return (
        <UsersContext.Provider value={{ users: normalizedUsers, lideres, deptLeaderMap, getLeaderByDepartment, currentUserProfile, updateTelegramChatId, loading }}>
            {children}
        </UsersContext.Provider>
    );
}

export function useUsers() {
    const ctx = useContext(UsersContext);
    if (!ctx) throw new Error('useUsers deve ser usado dentro de UsersProvider');
    return ctx;
}