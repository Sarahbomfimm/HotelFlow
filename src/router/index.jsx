import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import { UserRole } from '../models/User';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../services/permissions';

import Login from '../pages/Login/Login';
import DashboardDiretora from '../pages/DashboardDiretora/DashboardDiretora';
import DashboardLider from '../pages/DashboardLider/DashboardLider';
import AdminPanel from '../pages/AdminPanel/AdminPanel';
import FormOS from '../pages/FormOS/FormOS';
import ListaOS from '../pages/ListaOS/ListaOS';
import HistoricoOS from '../pages/HistoricoOS/HistoricoOS';
import PDCAVisualPage from '../pages/PDCAVisualPage/PDCAVisualPage';
import Reunioes from '../pages/Reunioes/Reunioes';
import Auditorias from '../pages/Auditorias/Auditorias';

function DashboardRouter() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return (user.role === UserRole.ADMIN || user.role === UserRole.DIRETORA)
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
            <Route
                path="/reunioes"
                element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.REUNIOES_ACCESS}>
                        <Reunioes />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditorias"
                element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.AUDITORIAS_ACCESS}>
                        <Navigate to="/auditorias/visualizar" replace />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditorias/nova"
                element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.AUDITORIAS_CREATE}>
                        <Auditorias mode="nova" />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditorias/visualizar"
                element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.AUDITORIAS_ACCESS}>
                        <Auditorias mode="visualizar" />
                    </ProtectedRoute>
                }
            />

            {/* Diretora e Líderes */}
            <Route
                path="/nova-os"
                element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DIRETORA, UserRole.LIDER]}>
                        <FormOS />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/historico"
                element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.HISTORICO_ACCESS}>
                        <HistoricoOS />
                    </ProtectedRoute>
                }
            />

            {/* Admin */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                        <AdminPanel />
                    </ProtectedRoute>
                }
            />

            {/* Redireciona raiz */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
