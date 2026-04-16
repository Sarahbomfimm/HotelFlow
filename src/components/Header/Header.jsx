import { Menu } from 'lucide-react';
import NotificationBell from '../NotificationBell/NotificationBell';
import { useAuth } from '../../context/AuthContext';

export default function Header({ pageTitle = '' }) {
    const { user } = useAuth();

    return (
        <header className="h-16 bg-hotel-blue border-b border-white/10 flex items-center px-6 gap-4 flex-shrink-0">
            {/* Título da página */}
            <div className="flex-1 min-w-0">
                <h2 className="font-heading font-semibold text-white text-base truncate">{pageTitle}</h2>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-3">
                <NotificationBell />

                {/* Avatar */}
                <div className="flex items-center gap-2 pl-3 border-l border-white/20">
                    <div className="w-8 h-8 rounded-full bg-hotel-gold flex items-center justify-center
                          font-heading font-bold text-white text-sm">
                        {user?.nome?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-white/80 font-body hidden sm:block">{user?.nome}</span>
                </div>
            </div>
        </header>
    );
}
