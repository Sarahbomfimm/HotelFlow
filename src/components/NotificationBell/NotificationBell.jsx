import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function NotificationBell() {
    const { notifications, naoLidas, marcarLida, marcarTodasLidas, remover } = useNotification();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Fecha ao clicar fora
    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNotificationClick = (n) => {
        marcarLida(n.id);
        setOpen(false);

        if (n.relatedOrderId) {
            if (n.type === 'reuniao') {
                navigate('/reunioes');
            } else if (n.type === 'auditoria') {
                navigate('/auditorias');
            } else {
                // É uma SI (Solicitação Interna)
                navigate('/ordens', { state: { expandOsId: n.relatedOrderId } });
            }
        }
    };

    const typeColors = {
        info: { border: 'border-l-hotel-blue', dot: 'bg-hotel-blue' },
        success: { border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
        warning: { border: 'border-l-amber-500', dot: 'bg-amber-500' },
        error: { border: 'border-l-red-500', dot: 'bg-red-500' },
        new_os: { border: 'border-l-hotel-gold', dot: 'bg-hotel-gold' },
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Notificações"
            >
                <Bell size={22} className={`${naoLidas > 0 ? 'text-hotel-gold' : 'text-white'} transition-colors`} />
                {naoLidas > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
                           rounded-full bg-hotel-gold text-white text-[10px] font-bold px-1 leading-none animate-pulse">
                        {naoLidas > 9 ? '9+' : naoLidas}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-card-hover border border-hotel-gray z-50 animate-fadeIn overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-hotel-blue text-white">
                        <span className="font-heading font-semibold text-sm">
                            Notificações {naoLidas > 0 && <span className="ml-1.5 bg-hotel-gold text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{naoLidas}</span>}
                        </span>
                        {naoLidas > 0 && (
                            <button
                                onClick={marcarTodasLidas}
                                className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
                            >
                                <CheckCheck size={14} /> Marcar todas como lidas
                            </button>
                        )}
                    </div>

                    {/* Lista */}
                    <div className="max-h-[28rem] overflow-y-auto divide-y divide-hotel-gray/30">
                        {notifications.length === 0 ? (
                            <p className="text-center text-hotel-gray-md text-sm py-8 font-body">
                                Nenhuma notificação
                            </p>
                        ) : (
                            notifications.map((n) => {
                                const cfg = typeColors[n.type] || typeColors.info;
                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer
                                          border-l-4 ${cfg.border} transition-colors
                                          ${n.lida
                                                ? 'bg-white hover:bg-hotel-gray/20 opacity-60'
                                                : 'bg-blue-50/60 hover:bg-blue-50'}`}
                                    >
                                        {/* Indicador não lida */}
                                        <div className="mt-1.5 flex-shrink-0">
                                            {n.lida
                                                ? <span className="w-2 h-2 rounded-full block" />
                                                : <span className={`w-2.5 h-2.5 rounded-full block ${cfg.dot} shadow-sm`} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-body leading-snug ${n.lida ? 'text-hotel-gray-md' : 'text-gray-900 font-semibold'}`}>
                                                {n.message}
                                            </p>
                                            {n.criadoEm && (
                                                <p className="text-[11px] text-hotel-gray-md font-body mt-0.5">
                                                    {format(parseISO(n.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); remover(n.id); }}
                                            className="text-hotel-gray-md hover:text-red-500 transition-colors mt-0.5 flex-shrink-0"
                                            aria-label="Remover notificação"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
