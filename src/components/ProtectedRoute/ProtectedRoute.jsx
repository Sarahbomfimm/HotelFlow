import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppLoadingScreen from '../Loading/AppLoadingScreen';

let initialLoadingCompleted = false;

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, authReady } = useAuth();
    const [loadingGraceDone, setLoadingGraceDone] = useState(initialLoadingCompleted);

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

    if (!authReady || !loadingGraceDone) {
        return <AppLoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}
