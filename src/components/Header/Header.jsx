import { Menu } from 'lucide-react';
import NotificationBell from '../NotificationBell/NotificationBell';
import { useAuth } from '../../context/AuthContext';

export default function Header({ pageTitle = '', onMenuClick }) {
    const { user } = useAuth();

    return (
        <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/10 bg-hotel-blue px-4 sm:px-6">
            <button
                type="button"
                onClick={onMenuClick}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white transition-colors hover:bg-white/10 lg:hidden"
                aria-label="Abrir menu"
            >
                <Menu size={20} />
            </button>

            {/* Título da página */}
            <div className="flex-1 min-w-0">
                <h2 className="truncate font-heading text-sm font-semibold text-white sm:text-base">{pageTitle}</h2>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 sm:gap-3">
                <NotificationBell />

                {/* Avatar */}
                <div className="flex items-center gap-2 border-l border-white/20 pl-2 sm:pl-3">
                    <div className="w-8 h-8 rounded-full bg-hotel-gold flex items-center justify-center
                          font-heading font-bold text-white text-sm">
                        {user?.nome?.[0]?.toUpperCase()}
                    </div>
                    <span className="hidden max-w-32 truncate font-body text-sm text-white/80 sm:block">{user?.nome}</span>
                </div>
            </div>
        </header>
    );
}
