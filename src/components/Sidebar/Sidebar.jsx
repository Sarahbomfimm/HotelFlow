import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ClipboardList, PlusCircle, History, ChartNoAxesCombined,
    LogOut, ChevronLeft, ChevronRight, X, Settings,
} from 'lucide-react';
import { useState } from 'react';
import Logo from '../Logo/Logo';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';

const liderLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ordens', label: 'Minhas SI', icon: ClipboardList },
    { to: '/ordens/abertas-por-mim', label: 'Abertas por mim', icon: ClipboardList },
    { to: '/pdca-visual', label: 'PDCA Visual', icon: ChartNoAxesCombined },
    { to: '/nova-os', label: 'Nova SI', icon: PlusCircle },
];
const diretoraLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ordens', label: 'Todas as SI', icon: ClipboardList },
    { to: '/ordens/abertas-por-mim', label: 'Abertas por mim', icon: ClipboardList },
    { to: '/pdca-visual', label: 'PDCA Visual', icon: ChartNoAxesCombined },
    { to: '/nova-os', label: 'Nova SI', icon: PlusCircle },
    { to: '/historico', label: 'Histórico', icon: History },
];
const adminLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin', label: 'Gerenciamento', icon: Settings },
    { to: '/ordens', label: 'Todas as SI', icon: ClipboardList },
    { to: '/pdca-visual', label: 'PDCA Visual', icon: ChartNoAxesCombined },
    { to: '/nova-os', label: 'Nova SI', icon: PlusCircle },
];

export default function Sidebar({ mobileMenuOpen = false, onCloseMobile }) {
    const { user, logout } = useAuth();
    const { currentUserProfile } = useUsers();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const displayUser = currentUserProfile || user;

    const links = displayUser?.role === UserRole.ADMIN ? adminLinks : displayUser?.role === UserRole.DIRETORA ? diretoraLinks : liderLinks;
    const showLabels = !collapsed || mobileMenuOpen;
    const profileSubtitle = displayUser?.role === UserRole.ADMIN
        ? 'Admin'
        : displayUser?.role === UserRole.DIRETORA
            ? 'Diretora - Financeiro'
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
            <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
                {links.map(({ to, label, icon: Icon }) => (
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
                        <Icon size={19} className="flex-shrink-0" />
                        {showLabels && <span className="truncate">{label}</span>}
                    </NavLink>
                ))}
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
