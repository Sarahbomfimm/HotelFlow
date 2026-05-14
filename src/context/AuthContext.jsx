import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { USERS } from '../data/mockData';
import { auth, db, isFirebaseConfigured } from '../services/firebase';
import { UserRole } from '../models/User';

const AuthContext = createContext(null);

function resolveRole(role, email) {
    const normalizedEmail = (email || '').toLowerCase();
    if (normalizedEmail === 'sarah@hotelflow.com') {
        return UserRole.ADMIN;
    }

    const normalizedRole = String(role || '').toLowerCase();
    if (normalizedRole === UserRole.ADMIN) return UserRole.ADMIN;
    if (normalizedRole === UserRole.DIRETORA) return UserRole.DIRETORA;
    if (normalizedRole === UserRole.LIDER) return UserRole.LIDER;
    return UserRole.LIDER;
}

function buildFallbackUserProfile(firebaseUser) {
    const normalizedEmail = firebaseUser.email?.toLowerCase() || '';
    const matchedUser = USERS.find(
        (item) => item.firebaseUid === firebaseUser.uid
            || item.email.toLowerCase() === normalizedEmail,
    );

    if (matchedUser) {
        const { senha: _omit, ...safeUser } = matchedUser;
        return {
            ...safeUser,
            firebaseUid: firebaseUser.uid,
        };
    }

    return {
        id: firebaseUser.uid,
        firebaseUid: firebaseUser.uid,
        nome: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
        email: firebaseUser.email || '',
        role: resolveRole('', firebaseUser.email || ''),
        departamentos: [],
    };
}

async function getFirestoreUserProfile(firebaseUser) {
    if (!db) {
        return null;
    }

    try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnapshot = await getDoc(userRef);

        if (!userSnapshot.exists()) {
            return null;
        }

        const userData = userSnapshot.data();

        return {
            id: userSnapshot.id,
            firebaseUid: firebaseUser.uid,
            nome: userData.nome || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
            email: userData.email || firebaseUser.email || '',
            role: resolveRole(userData.role, userData.email || firebaseUser.email || ''),
            departamentos: Array.isArray(userData.departamentos) ? userData.departamentos : [],
        };
    } catch {
        return null;
    }
}

async function resolveUserProfile(firebaseUser) {
    const firestoreProfile = await getFirestoreUserProfile(firebaseUser);

    if (firestoreProfile) {
        return firestoreProfile;
    }

    return buildFallbackUserProfile(firebaseUser);
}

function persistUser(user) {
    return user;
}

function clearPersistedUser() {
    return null;
}

function getFirebaseErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
            return 'E-mail ou senha inválidos.';
        case 'auth/too-many-requests':
            return 'Muitas tentativas de login. Tente novamente em instantes.';
        default:
            return 'Nao foi possivel entrar agora. Tente novamente.';
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');
    const [authReady, setAuthReady] = useState(!isFirebaseConfigured || !auth);

    useEffect(() => {
        if (!isFirebaseConfigured || !auth) {
            setAuthReady(true);
            return undefined;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                clearPersistedUser();
                setAuthReady(true);
                return;
            }

            const profile = await resolveUserProfile(firebaseUser);
            setUser(profile);
            persistUser(profile);
            setAuthReady(true);
        });

        return unsubscribe;
    }, []);

    const login = useCallback(async (email, senha) => {
        if (isFirebaseConfigured && auth) {
            try {
                const credential = await signInWithEmailAndPassword(auth, email, senha);
                const profile = await resolveUserProfile(credential.user);
                setUser(profile);
                persistUser(profile);
                setError('');
                setAuthReady(true);
                return true;
            } catch (firebaseError) {
                setError(getFirebaseErrorMessage(firebaseError.code));
                return false;
            }
        }

        const found = USERS.find(
            (u) => u.email.toLowerCase() === email.toLowerCase() && u.senha === senha,
        );
        if (!found) {
            setError('E-mail ou senha inválidos.');
            return false;
        }

        const { senha: _omit, ...safeUser } = found;
        setUser(safeUser);
        persistUser(safeUser);
        setError('');
        setAuthReady(true);
        return true;
    }, []);

    const logout = useCallback(async () => {
        if (isFirebaseConfigured && auth?.currentUser) {
            try {
                await signOut(auth);
            } catch {
                // Mantem limpeza local mesmo se o signOut remoto falhar.
            }
        }

        setUser(null);
        clearPersistedUser();
        setAuthReady(true);
    }, []);

    const clearError = useCallback(() => setError(''), []);

    return (
        <AuthContext.Provider value={{ user, login, logout, error, clearError, authReady }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
    return ctx;
}
