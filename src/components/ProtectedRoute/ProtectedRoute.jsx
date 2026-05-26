import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import AppLoadingScreen from '../Loading/AppLoadingScreen';
import AccessDenied from '../AccessDenied/AccessDenied';
import { getPermissionDeniedCopy, hasPermission } from '../../services/permissions';

let initialLoadingCompleted = false;

export default function ProtectedRoute({ children, allowedRoles, requiredPermission, deniedTitle, deniedMessage }) {
    const { user, authReady } = useAuth();
    const { currentUserProfile, loading: usersLoading } = useUsers();
    const [loadingGraceDone, setLoadingGraceDone] = useState(initialLoadingCompleted);
    const actor = currentUserProfile || user;

    useEffect(() => {
        if (initialLoadingCompleted) {
            setLoadingGraceDone(true);
            return;
        }

        if (!authReady) {
            setLoadingGraceDone(false);
            return;
        }

        const timer = setTimeout(() => {
            initialLoadingCompleted = true;
            setLoadingGraceDone(true);
        }, 750);

        return () => clearTimeout(timer);
    }, [authReady]);

    if (!authReady || !loadingGraceDone || usersLoading) {
        return <AppLoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(actor.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    if (requiredPermission && !hasPermission(actor, requiredPermission)) {
        const copy = getPermissionDeniedCopy(requiredPermission);
        return <AccessDenied title={deniedTitle || copy.title} message={deniedMessage || copy.message} />;
    }

    return children;
}
