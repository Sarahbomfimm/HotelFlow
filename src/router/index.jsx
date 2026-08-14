import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppLoadingScreen from '../components/Loading/AppLoadingScreen';
import { UserRole } from '../models/User';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../services/permissions';

const Login = lazy(() => import('../pages/Login/Login'));
const DashboardDiretora = lazy(() => import('../pages/DashboardDiretora/DashboardDiretora'));
const DashboardLider = lazy(() => import('../pages/DashboardLider/DashboardLider'));
const AdminPanel = lazy(() => import('../pages/AdminPanel/AdminPanel'));
const EditLeader = lazy(() => import('../pages/AdminPanel/EditLeader'));
const FormOS = lazy(() => import('../pages/FormOS/FormOS'));
const ListaOS = lazy(() => import('../pages/ListaOS/ListaOS'));
const PDCAVisualPage = lazy(() => import('../pages/PDCAVisualPage/PDCAVisualPage'));
const Aprovacoes = lazy(() => import('../pages/Aprovacoes/Aprovacoes'));
const Reunioes = lazy(() => import('../pages/Reunioes/Reunioes'));
const Auditorias = lazy(() => import('../pages/Auditorias/Auditorias'));
const Treinamentos = lazy(() => import('../pages/Treinamentos/Treinamentos'));
const Pops = lazy(() => import('../pages/Pops/Pops'));
const Documentacoes = lazy(() => import('../pages/Documentacoes/Documentacoes'));
const Indicadores = lazy(() => import('../pages/Indicadores/Indicadores'));

function DashboardRouter() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return (user.role === UserRole.ADMIN || user.role === UserRole.DIRETORA)
        ? <DashboardDiretora />
        : <DashboardLider />;
}

export default function AppRouter() {
    return (
        <Suspense fallback={<AppLoadingScreen />}>
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
                    path="/aprovacoes"
                    element={
                        <ProtectedRoute requiredPermission={PERMISSIONS.SI_APPROVALS_ACCESS}>
                            <Aprovacoes />
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
                <Route
                    path="/treinamentos"
                    element={
                        <ProtectedRoute requiredPermission={PERMISSIONS.TREINAMENTOS_ACCESS}>
                            <Treinamentos />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/pops"
                    element={
                        <ProtectedRoute>
                            <Pops />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/documentacoes"
                    element={
                        <ProtectedRoute>
                            <Documentacoes />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/indicadores"
                    element={
                        <ProtectedRoute>
                            <Indicadores />
                        </ProtectedRoute>
                    }
                />


                {/* Diretora e Líderes */}
                <Route
                    path="/nova-os"
                    element={
                        <ProtectedRoute requiredPermission={PERMISSIONS.SI_CREATE_ACCESS}>
                            <FormOS />
                        </ProtectedRoute>
                    }
                />


                {/* Admin */}
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute requiredPermission={PERMISSIONS.ADMIN_PANEL_ACCESS}>
                            <AdminPanel />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/lideres/:userId/editar"
                    element={
                        <ProtectedRoute requiredPermission={PERMISSIONS.ADMIN_PANEL_ACCESS}>
                            <EditLeader />
                        </ProtectedRoute>
                    }
                />

                {/* Redireciona raiz */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Suspense>
    );
}
