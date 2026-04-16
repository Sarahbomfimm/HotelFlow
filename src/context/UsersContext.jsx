import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { USERS } from '../data/mockData';
import { db, isFirebaseConfigured } from '../services/firebase';
import { UserRole } from '../models/User';
import { useAuth } from './AuthContext';

const UsersContext = createContext(null);

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
        merged.set(emailKey, {
            ...fallbackUser,
            ...user,
            id: user.id,
            firebaseUid: user.firebaseUid || user.id,
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

    const lideres = useMemo(
        () => users.filter((user) => user.role === UserRole.LIDER),
        [users],
    );

    const deptLeaderMap = useMemo(() => {
        const mapping = {};

        lideres.forEach((lider) => {
            lider.departamentos.forEach((departamento) => {
                mapping[departamento] = {
                    id: lider.id,
                    nome: lider.nome,
                    email: lider.email,
                };
            });
        });

        return mapping;
    }, [lideres]);

    const getLeaderByDepartment = useCallback(
        (departamento) => deptLeaderMap[departamento] || null,
        [deptLeaderMap],
    );

    return (
        <UsersContext.Provider value={{ users, lideres, deptLeaderMap, getLeaderByDepartment, loading }}>
            {children}
        </UsersContext.Provider>
    );
}

export function useUsers() {
    const ctx = useContext(UsersContext);
    if (!ctx) throw new Error('useUsers deve ser usado dentro de UsersProvider');
    return ctx;
}