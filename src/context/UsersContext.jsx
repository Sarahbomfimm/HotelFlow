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
                };
            });
        });

        return mapping;
    }, [normalizedUsers]);

    const getLeaderByDepartment = useCallback(
        (departamento) => deptLeaderMap[departamento] || null,
        [deptLeaderMap],
    );

    return (
        <UsersContext.Provider value={{ users: normalizedUsers, lideres, deptLeaderMap, getLeaderByDepartment, loading }}>
            {children}
        </UsersContext.Provider>
    );
}

export function useUsers() {
    const ctx = useContext(UsersContext);
    if (!ctx) throw new Error('useUsers deve ser usado dentro de UsersProvider');
    return ctx;
}