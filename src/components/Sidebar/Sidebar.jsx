import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ClipboardList, PlusCircle, History,
    LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import Logo from '../Logo/Logo';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../models/User';

const liderLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ordens', label: 'Minhas SI', icon: ClipboardList },
];
const diretoraLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ordens', label: 'Todas as SI', icon: ClipboardList },
    { to: '/nova-os', label: 'Nova SI', icon: PlusCircle },
    { to: '/historico', label: 'Histórico', icon: History },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const links = user?.role === UserRole.DIRETORA ? diretoraLinks : liderLinks;

    const handleBrandClick = () => {
        navigate('/dashboard');
        const mainContent = document.getElementById('app-main-content');

        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className={`relative flex flex-col h-screen bg-hotel-blue text-white transition-all duration-300
                  ${collapsed ? 'w-16' : 'w-60'} flex-shrink-0`}
        >
            {/* Logo */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
                {!collapsed && (
                    <button onClick={handleBrandClick} className="focus:outline-none hover:opacity-80 transition-opacity">
                        <Logo size={32} showText light />
                    </button>
                )}
                {collapsed && (
                    <button onClick={handleBrandClick} className="focus:outline-none hover:opacity-80 transition-opacity">
                        <Logo size={32} showText={false} light />
                    </button>
                )}
                <button
                    onClick={() => setCollapsed((v) => !v)}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white ml-auto"
                    aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Perfil do usuário */}
            {!collapsed && (
                <div className="px-4 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-hotel-gold flex items-center justify-center
                            font-heading font-bold text-white text-sm flex-shrink-0">
                            {user?.nome?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold font-heading truncate">{user?.nome}</p>
                            <p className="text-xs text-white/60 font-body capitalize">{user?.role}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Navegação */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
                        }
                        title={collapsed ? label : undefined}
                    >
                        <Icon size={19} className="flex-shrink-0" />
                        {!collapsed && <span className="truncate">{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className="px-2 pb-4 border-t border-white/10 pt-3">
                <button
                    onClick={handleLogout}
                    className={`sidebar-link w-full ${collapsed ? 'justify-center px-2' : ''}`}
                    title={collapsed ? 'Sair' : undefined}
                >
                    <LogOut size={19} className="flex-shrink-0 text-red-300" />
                    {!collapsed && <span className="text-red-300">Sair</span>}
                </button>
            </div>
        </aside>
    );
}
