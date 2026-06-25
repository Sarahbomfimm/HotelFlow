import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ClipboardList, ChartNoAxesCombined, CalendarDays,
    LogOut, ChevronLeft, ChevronRight, X, Settings, ClipboardCheck, Eye, Plus, TrendingUp,
    User, GraduationCap, BookOpen, BarChart3, Folder, FileText
} from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import Logo from '../Logo/Logo';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { hasPermission, PERMISSIONS } from '../../services/permissions';

const liderLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ordens', label: 'Minhas SI', icon: ClipboardList },
    { to: '/ordens/abertas-por-mim', label: 'Abertas por mim', icon: User },
    { to: '/pdca-visual', label: 'PDCA Visual', icon: ChartNoAxesCombined },
    { to: '/indicadores', label: 'Indicadores', icon: BarChart3 },
    { to: '/aprovacoes', label: 'Aprovações', icon: Eye },
    { to: '/reunioes', label: 'Reuniões', icon: CalendarDays },
    { to: '/auditorias/visualizar', label: 'Auditorias', icon: ClipboardCheck },
    { to: '/treinamentos', label: 'Treinamentos', icon: GraduationCap },
    { to: '/pops', label: 'POPs', icon: BookOpen },
    { to: 'https://verdance-xi.vercel.app/auth', label: 'Investimentos', icon: TrendingUp, external: true },
    { to: '/admin', label: 'Gerenciamento', icon: Settings },
];
const diretoraLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ordens', label: 'Todas as SI', icon: ClipboardList },
    { to: '/ordens/abertas-por-mim', label: 'Abertas por mim', icon: User },
    { to: '/pdca-visual', label: 'PDCA Visual', icon: ChartNoAxesCombined },
    { to: '/indicadores', label: 'Indicadores', icon: BarChart3 },
    { to: '/aprovacoes', label: 'Aprovações', icon: Eye },
    { to: '/reunioes', label: 'Reuniões', icon: CalendarDays },
    { to: '/auditorias/visualizar', label: 'Auditorias', icon: ClipboardCheck },
    { to: '/treinamentos', label: 'Treinamentos', icon: GraduationCap },
    { to: '/pops', label: 'POPs', icon: BookOpen },
    { to: 'https://verdance-xi.vercel.app/auth', label: 'Investimentos', icon: TrendingUp, external: true },
    { to: '/admin', label: 'Gerenciamento', icon: Settings },
];
const adminLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ordens', label: 'Todas as SI', icon: ClipboardList },
    { to: '/ordens/abertas-por-mim', label: 'Abertas por mim', icon: User },
    { to: '/pdca-visual', label: 'PDCA Visual', icon: ChartNoAxesCombined },
    { to: '/indicadores', label: 'Indicadores', icon: BarChart3 },
    { to: '/aprovacoes', label: 'Aprovações', icon: Eye },
    { to: '/reunioes', label: 'Reuniões', icon: CalendarDays },
    { to: '/auditorias/visualizar', label: 'Auditorias', icon: ClipboardCheck },
    { to: '/treinamentos', label: 'Treinamentos', icon: GraduationCap },
    { to: '/pops', label: 'POPs', icon: BookOpen },
    { to: 'https://verdance-xi.vercel.app/auth', label: 'Investimentos', icon: TrendingUp, external: true },
    { to: '/admin', label: 'Gerenciamento', icon: Settings },
];
export default function Sidebar({ mobileMenuOpen = false, onCloseMobile }) {
    const { user, logout } = useAuth();
    const { notifications } = useNotification();
    const { currentUserProfile } = useUsers();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [auditoriasExpanded, setAuditoriasExpanded] = useState(location.pathname.startsWith('/auditorias'));
    const [popsExpanded, setPopsExpanded] = useState(location.pathname.startsWith('/pops') || location.pathname.startsWith('/documentacoes'));

    const navRef = useRef(null);

    const handleScroll = (e) => {
        sessionStorage.setItem('hotelflow:sidebar:scroll', e.target.scrollTop);
    };

    const displayUser = currentUserProfile || user;
    const canAccessAuditorias = hasPermission(displayUser, PERMISSIONS.AUDITORIAS_ACCESS);
    const canCreateAuditorias = hasPermission(displayUser, PERMISSIONS.AUDITORIAS_CREATE);
    const canAccessReunioes = hasPermission(displayUser, PERMISSIONS.REUNIOES_ACCESS);
    const canAccessAprovacoes = hasPermission(displayUser, PERMISSIONS.SI_APPROVALS_ACCESS);
    const canAccessTreinamentos = hasPermission(displayUser, PERMISSIONS.TREINAMENTOS_ACCESS);
    const canAccessAdminPanel = hasPermission(displayUser, PERMISSIONS.ADMIN_PANEL_ACCESS);
    const canAccessInvestimentos = hasPermission(displayUser, PERMISSIONS.INVESTIMENTOS_VIEW);

    const isManagementRole = displayUser?.role === UserRole.ADMIN || displayUser?.role === UserRole.DIRETORA;
    const links = displayUser?.role === UserRole.ADMIN
        ? adminLinks
        : isManagementRole
            ? diretoraLinks
            : liderLinks;
    const visibleLinks = links.filter((link) => {
        if (link.to === '/auditorias/visualizar') return canAccessAuditorias;
        if (link.to === '/treinamentos') return canAccessTreinamentos;
        if (link.to === '/reunioes') return canAccessReunioes;
        if (link.to === '/aprovacoes') return canAccessAprovacoes;
        if (link.to === '/admin') return canAccessAdminPanel;
        if (link.label === 'Investimentos') return canAccessInvestimentos;
        return true;
    });
    const showLabels = !collapsed || mobileMenuOpen;
    const showAuditoriasSubmenu = showLabels && auditoriasExpanded;
    const reunioesUnreadCount = useMemo(() => notifications.filter((item) => !item.lida && item.type === 'reuniao').length, [notifications]);
    const auditoriasUnreadCount = useMemo(() => notifications.filter((item) => !item.lida && item.type === 'auditoria').length, [notifications]);
    const profileSubtitle = displayUser?.role === UserRole.ADMIN
        ? 'Adm'
        : displayUser?.role === UserRole.DIRETORA
            ? 'Diretoria'
            : displayUser?.role;

    const handleBrandClick = () => {
        navigate('/dashboard');
        onCloseMobile?.();
        const mainContent = document.getElementById('app-main-content');

        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleLogout = () => {
        logout();
        onCloseMobile?.();
        navigate('/login');
    };

    useEffect(() => {
        if (location.pathname.startsWith('/auditorias')) {
            setAuditoriasExpanded(true);
        }
        if (location.pathname.startsWith('/pops') || location.pathname.startsWith('/documentacoes')) {
            setPopsExpanded(true);
        }
    }, [location.pathname]);

    useEffect(() => {
        const savedScroll = sessionStorage.getItem('hotelflow:sidebar:scroll');
        if (savedScroll && navRef.current) {
            navRef.current.scrollTop = parseInt(savedScroll, 10);
            const timer = setTimeout(() => {
                if (navRef.current) {
                    navRef.current.scrollTop = parseInt(savedScroll, 10);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 max-w-[85vw] flex-col bg-hotel-blue text-white shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none
                  ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-16' : 'lg:w-60'}`}
        >
            {/* Logo */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-5">
                {showLabels && (
                    <button onClick={handleBrandClick} className="focus:outline-none hover:opacity-80 transition-opacity">
                        <Logo size={32} showText light />
                    </button>
                )}
                {!showLabels && (
                    <button onClick={handleBrandClick} className="focus:outline-none hover:opacity-80 transition-opacity">
                        <Logo size={32} showText={false} light />
                    </button>
                )}
                <button
                    onClick={() => setCollapsed((v) => !v)}
                    className="ml-auto hidden rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex"
                    aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <button
                    type="button"
                    onClick={() => onCloseMobile?.()}
                    className="ml-auto inline-flex rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
                    aria-label="Fechar menu"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Perfil do usuário */}
            {showLabels && (
                <div className="border-b border-white/10 px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-hotel-gold flex items-center justify-center
                            font-heading font-bold text-white text-sm flex-shrink-0">
                            {displayUser?.nome?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold font-heading truncate">{displayUser?.nome}</p>
                            <p className="text-xs text-white/60 font-body capitalize">{profileSubtitle}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Navegação */}
            <nav
                ref={navRef}
                onScroll={handleScroll}
                className="flex-1 space-y-1 overflow-y-auto px-2 py-4"
            >
                {visibleLinks.map(({ to, label, icon: Icon, external }) => {
                    const isAuditoriasLink = to === '/auditorias/visualizar';
                    const isPopsLink = to === '/pops';
                    const isReunioesLink = to === '/reunioes';
                    const badgeCount = isReunioesLink ? reunioesUnreadCount : isAuditoriasLink ? auditoriasUnreadCount : 0;

                    if (external) {
                        return (
                            <a
                                key={to}
                                href={to}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => onCloseMobile?.()}
                                className={`sidebar-link ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
                                title={!showLabels ? label : undefined}
                            >
                                <span className="relative inline-flex flex-shrink-0">
                                    <Icon size={19} className="flex-shrink-0" />
                                </span>
                                {showLabels && <span className="truncate">{label}</span>}
                            </a>
                        );
                    }

                    if (!isAuditoriasLink && !isPopsLink) {
                        return (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/ordens'}
                                onClick={() => onCloseMobile?.()}
                                className={({ isActive }) =>
                                    `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`
                                }
                                title={!showLabels ? label : undefined}
                            >
                                <span className="relative inline-flex flex-shrink-0">
                                    <Icon size={19} className="flex-shrink-0" />
                                    {!showLabels && badgeCount > 0 && (
                                        <span className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hotel-gold px-1 text-[10px] font-bold leading-none text-white animate-pulse">
                                            {badgeCount > 9 ? '9+' : badgeCount}
                                        </span>
                                    )}
                                </span>
                                {showLabels && <span className="truncate">{label}</span>}
                                {showLabels && badgeCount > 0 && (
                                    <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hotel-gold px-1 text-[10px] font-bold leading-none text-white animate-pulse">
                                        {badgeCount > 9 ? '9+' : badgeCount}
                                    </span>
                                )}
                            </NavLink>
                        );
                    }

                    if (isPopsLink) {
                        const isPopsActive = location.pathname.startsWith('/pops') || location.pathname.startsWith('/documentacoes');
                        const showPopsSubmenu = showLabels && popsExpanded;

                        return (
                            <div key={to}>
                                <div
                                    onClick={() => setPopsExpanded((value) => !value)}
                                    className={`sidebar-link ${isPopsActive ? 'active' : ''} ${collapsed ? 'lg:justify-center lg:px-2' : ''} cursor-pointer select-none`}
                                    title={!showLabels ? label : undefined}
                                >
                                    <span className="relative inline-flex flex-shrink-0">
                                        <Icon size={19} className="flex-shrink-0" />
                                    </span>
                                    {showLabels && <span className="truncate">{label}</span>}
                                    {showLabels && (
                                        <div className="ml-auto inline-flex rounded-md p-0.5 text-white/70">
                                            <ChevronRight
                                                size={16}
                                                className={`transition-transform ${popsExpanded ? 'rotate-90 text-white' : 'text-white/70'}`}
                                            />
                                        </div>
                                    )}
                                </div>

                                {showPopsSubmenu && (
                                    <div className="ml-8 mt-1 space-y-1 border-l border-white/15 pl-3">
                                        <NavLink
                                            to="/pops"
                                            onClick={() => onCloseMobile?.()}
                                            className={({ isActive }) =>
                                                `inline-flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                                                    isActive && location.pathname === '/pops' ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                                                }`
                                            }
                                        >
                                            <FileText size={14} className="flex-shrink-0" />
                                            Procedimentos
                                        </NavLink>
                                        <NavLink
                                            to="/documentacoes"
                                            onClick={() => onCloseMobile?.()}
                                            className={({ isActive }) =>
                                                `inline-flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                                                    isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                                                }`
                                            }
                                        >
                                            <Folder size={14} className="flex-shrink-0" />
                                            Documentações
                                        </NavLink>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const isAuditoriasActive = location.pathname.startsWith('/auditorias');

                    return (
                        <div key={to}>
                            <div
                                onClick={() => setAuditoriasExpanded((value) => !value)}
                                className={`sidebar-link ${isAuditoriasActive ? 'active' : ''} ${collapsed ? 'lg:justify-center lg:px-2' : ''} cursor-pointer select-none`}
                                title={!showLabels ? label : undefined}
                            >
                                <span className="relative inline-flex flex-shrink-0">
                                    <Icon size={19} className="flex-shrink-0" />
                                    {!showLabels && badgeCount > 0 && (
                                        <span className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hotel-gold px-1 text-[10px] font-bold leading-none text-white animate-pulse">
                                            {badgeCount > 9 ? '9+' : badgeCount}
                                        </span>
                                    )}
                                </span>
                                {showLabels && <span className="truncate">{label}</span>}
                                {showLabels && badgeCount > 0 && (
                                    <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hotel-gold px-1 text-[10px] font-bold leading-none text-white animate-pulse mr-2">
                                        {badgeCount > 9 ? '9+' : badgeCount}
                                    </span>
                                )}
                                {showLabels && (
                                    <div className="ml-auto inline-flex rounded-md p-0.5 text-white/70">
                                        <ChevronRight
                                            size={16}
                                            className={`transition-transform ${auditoriasExpanded ? 'rotate-90 text-white' : 'text-white/70'}`}
                                        />
                                    </div>
                                )}
                            </div>

                            {showAuditoriasSubmenu && canAccessAuditorias && (
                                <div className="ml-8 mt-1 space-y-1 border-l border-white/15 pl-3">
                                    {canCreateAuditorias && (
                                        <NavLink
                                            to="/auditorias/nova"
                                            onClick={() => onCloseMobile?.()}
                                            className={({ isActive }) =>
                                                `inline-flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                                                    isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                                                }`
                                            }
                                        >
                                            <Plus size={14} className="flex-shrink-0" />
                                            Nova Auditoria
                                        </NavLink>
                                    )}
                                    <NavLink
                                        to="/auditorias/visualizar"
                                        onClick={() => onCloseMobile?.()}
                                        className={({ isActive }) =>
                                            `inline-flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                                                isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                                            }`
                                        }
                                    >
                                        <Eye size={14} className="flex-shrink-0" />
                                        Visualizar Auditorias
                                    </NavLink>
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="border-t border-white/10 px-2 pb-4 pt-3">
                <button
                    onClick={handleLogout}
                    className={`sidebar-link w-full ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
                    title={!showLabels ? 'Sair' : undefined}
                >
                    <LogOut size={19} className="flex-shrink-0 text-red-300" />
                    {showLabels && <span className="text-red-300">Sair</span>}
                </button>
            </div>
        </aside>
    );
}
