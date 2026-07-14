import { Menu } from 'lucide-react';
import NotificationBell from '../NotificationBell/NotificationBell';

export default function Header({ pageTitle = '', onMenuClick }) {
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <h2 className="truncate font-heading">
                    {pageTitle.includes(' — ') ? (
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm sm:text-base">
                                {pageTitle.split(' — ')[0]}
                            </span>
                            <span className="text-white/30 font-light text-sm">/</span>
                            <span className="text-[11px] font-medium text-white/60 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 tracking-wide">
                                {pageTitle.split(' — ')[1]}
                            </span>
                        </div>
                    ) : (
                        <span className="font-semibold text-white text-sm sm:text-base">{pageTitle}</span>
                    )}
                </h2>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 sm:gap-3">
                <NotificationBell />
                <div className="hidden h-10 w-[84px] items-center justify-center rounded-xl bg-white px-1 py-1 shadow-sm sm:flex">
                    <img
                        src="/pajucara hotel flow logo pequena 2.png"
                        alt="Pajucara Hotel"
                        className="h-full w-full scale-110 rounded-lg object-contain"
                    />
                </div>
            </div>
        </header>
    );
}
