import { useState, useEffect } from 'react';
import { X, CheckCircle2, Info, AlertTriangle, Bell } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const DURATION = 6000; // ms — deve coincidir com o auto-dismiss do contexto

const typeConfig = {
    success: { icon: CheckCircle2, bg: 'bg-emerald-600', bar: 'bg-emerald-300' },
    info: { icon: Info, bg: 'bg-hotel-blue', bar: 'bg-blue-300' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-500', bar: 'bg-amber-200' },
    error: { icon: AlertTriangle, bg: 'bg-red-600', bar: 'bg-red-300' },
    new_os: { icon: Bell, bg: 'bg-hotel-blue', bar: 'bg-hotel-gold' },
};

export default function ToastNotifications() {
    const { notifications, remover } = useNotification();
    // Só exibe notificações que ainda não foram escondidas do toast
    const visible = notifications.filter((n) => !n.toastDismissed).slice(0, 5);

    return (
        <div
            aria-live="polite"
            aria-label="Notificações"
            className="fixed top-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none"
            style={{ maxWidth: 400, width: 'calc(100vw - 2rem)' }}
        >
            {visible.map((n) => (
                <ToastItem key={n.id} n={n} onRemove={remover} />
            ))}
        </div>
    );
}

function ToastItem({ n, onRemove }) {
    const [mounted, setMounted] = useState(false);
    const cfg = typeConfig[n.type] || typeConfig.info;
    const Icon = cfg.icon;
    const isNewOs = n.type === 'new_os';

    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <div
            role="alert"
            className={`pointer-events-auto rounded-xl shadow-2xl overflow-hidden
                        transition-all duration-300 ease-out
                        ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'}
                        ${isNewOs ? 'ring-2 ring-hotel-gold ring-offset-2' : ''}`}
        >
            {/* Corpo */}
            <div className={`${cfg.bg} px-4 py-3 flex items-start gap-3`}>
                <Icon size={20} className="text-white flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    {isNewOs && (
                        <p className="text-hotel-gold font-heading font-bold text-xs uppercase tracking-wider mb-0.5">
                            🔔 Nova Solicitação
                        </p>
                    )}
                    <p className="text-white text-sm font-body leading-snug">{n.message}</p>
                </div>
                <button
                    onClick={() => onRemove(n.id)}
                    className="text-white/60 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                    aria-label="Dispensar notificação"
                >
                    <X size={15} />
                </button>
            </div>

            {/* Barra de progresso que some em DURATION ms */}
            <div className="h-[3px] bg-black/20">
                <div
                    className={`h-full ${cfg.bar} toast-progress`}
                    style={{ animationDuration: `${DURATION}ms` }}
                />
            </div>
        </div>
    );
}
