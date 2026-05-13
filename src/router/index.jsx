import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import { UserRole } from '../models/User';
import { useAuth } from '../context/AuthContext';

import Login from '../pages/Login/Login';
import DashboardDiretora from '../pages/DashboardDiretora/DashboardDiretora';
import DashboardLider from '../pages/DashboardLider/DashboardLider';
import FormOS from '../pages/FormOS/FormOS';
import ListaOS from '../pages/ListaOS/ListaOS';
import HistoricoOS from '../pages/HistoricoOS/HistoricoOS';
import PDCAVisualPage from '../pages/PDCAVisualPage/PDCAVisualPage';

function DashboardRouter() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return user.role === UserRole.DIRETORA
        ? <DashboardDiretora />
        : <DashboardLider />;
}

export default function AppRouter() {
    return (
        <Routes>
            {/* Pública */}
            <Route path="/login" element={<Login />} />

            {/* Protegidas — qualquer usuário autenticado */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <DashboardRouter />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/ordens"
                element={
                    <ProtectedRoute>
                        <ListaOS />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/ordens/abertas-por-mim"
                element={
                    <ProtectedRoute>
                        <ListaOS />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/pdca-visual"
                element={
                    <ProtectedRoute>
                        <PDCAVisualPage />
                    </ProtectedRoute>
                }
            />

            {/* Diretora e Líderes */}
            <Route
                path="/nova-os"
                element={
                    <ProtectedRoute allowedRoles={[UserRole.DIRETORA, UserRole.LIDER]}>
                        <FormOS />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/historico"
                element={
                    <ProtectedRoute allowedRoles={[UserRole.DIRETORA]}>
                        <HistoricoOS />
                    </ProtectedRoute>
                }
            />

            {/* Redireciona raiz */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
