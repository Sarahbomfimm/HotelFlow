import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const { notifications, dismissToast } = useNotification();
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
                <ToastItem key={n.id} n={n} onDismiss={dismissToast} />
            ))}
        </div>
    );
}

function ToastItem({ n, onDismiss }) {
    const { marcarLida } = useNotification();
    const navigate = useNavigate();

    const [mounted, setMounted] = useState(false);
    const [dragStartX, setDragStartX] = useState(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);
    const [hasMoved, setHasMoved] = useState(false);

    const cfg = typeConfig[n.type] || typeConfig.info;
    const Icon = cfg.icon;
    const isNewOs = n.type === 'new_os';

    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    // Redireciona e fecha
    const handleNavigate = () => {
        // Marca como lida localmente ou no Firestore
        marcarLida(n.id);

        setIsDismissing(true);
        setSwipeOffset(500); // Anima saída pela direita
        setTimeout(() => {
            onDismiss(n.id);
        }, 250);

        if (n.relatedOrderId) {
            if (n.type === 'reuniao') {
                navigate('/reunioes');
            } else if (n.type === 'auditoria') {
                navigate('/auditorias');
            } else {
                // Solicitação Interna (OS)
                navigate('/ordens', { state: { expandOsId: n.relatedOrderId } });
            }
        }
    };

    // Iniciar arrasto / toque
    const handleDragStart = (clientX) => {
        if (isDismissing) return;
        setDragStartX(clientX);
        setIsDragging(true);
        setHasMoved(false);
    };

    // Arrastando / movendo
    const handleDragMove = (clientX) => {
        if (!isDragging || dragStartX === null || isDismissing) return;
        const offset = clientX - dragStartX;
        setSwipeOffset(offset);
        if (Math.abs(offset) > 5) {
            setHasMoved(true);
        }
    };

    // Finalizar arrasto / toque
    const handleDragEnd = () => {
        if (!isDragging || isDismissing) return;
        setIsDragging(false);
        setDragStartX(null);

        const threshold = 100; // px
        if (Math.abs(swipeOffset) > threshold) {
            setIsDismissing(true);
            const exitOffset = swipeOffset > 0 ? 500 : -500;
            setSwipeOffset(exitOffset);
            setTimeout(() => {
                onDismiss(n.id);
            }, 250);
        } else if (!hasMoved) {
            // Foi apenas um clique/toque (sem arrastar)
            handleNavigate();
        } else {
            // Volta para a posição original
            setSwipeOffset(0);
        }
    };

    const handleMouseDown = (e) => {
        if (e.target.closest('button') || e.button !== 0) return; // Apenas clique esquerdo e fora do botão de fechar
        handleDragStart(e.clientX);
    };

    const handleMouseMove = (e) => {
        handleDragMove(e.clientX);
    };

    const handleMouseUp = () => {
        handleDragEnd();
    };

    const handleTouchStart = (e) => {
        if (e.target.closest('button')) return;
        handleDragStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
        handleDragMove(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        handleDragEnd();
    };

    // Cálculo dinâmico de opacidade durante o arraste
    const opacity = isDismissing
        ? 0
        : isDragging
            ? Math.max(0.1, 1 - Math.abs(swipeOffset) / 320)
            : 1;

    return (
        <div
            role="alert"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                transform: `translateX(${swipeOffset}px)`,
                opacity: mounted ? opacity : 0,
                transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out',
                cursor: isDragging ? 'grabbing' : 'pointer',
                userSelect: 'none',
                touchAction: 'none', // Impede rolagem vertical da página durante o arraste lateral
            }}
            className={`pointer-events-auto rounded-xl shadow-2xl overflow-hidden select-none
                        ${mounted && !isDismissing ? 'scale-100 animate-fadeIn' : 'scale-95'}
                        ${isNewOs ? 'ring-2 ring-hotel-gold ring-offset-2' : ''}`}
        >
            {/* Corpo */}
            <div className={`${cfg.bg} px-4 py-3 flex items-start gap-3`}>
                <Icon size={20} className="text-white flex-shrink-0 mt-0.5 pointer-events-none" />
                <div className="flex-1 min-w-0 pointer-events-none">
                    {isNewOs && (
                        <p className="text-hotel-gold font-heading font-bold text-xs uppercase tracking-wider mb-0.5">
                            🔔 Nova Solicitação
                        </p>
                    )}
                    <p className="text-white text-sm font-body leading-snug">{n.message}</p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsDismissing(true);
                        setSwipeOffset(500); // Saída pela direita
                        setTimeout(() => {
                            onDismiss(n.id);
                        }, 250);
                    }}
                    className="text-white/60 hover:text-white transition-colors flex-shrink-0 mt-0.5 cursor-pointer"
                    aria-label="Dispensar notificação"
                >
                    <X size={15} />
                </button>
            </div>

            {/* Barra de progresso que some em DURATION ms */}
            <div className="h-[3px] bg-black/20 pointer-events-none">
                <div
                    className={`h-full ${cfg.bar} toast-progress`}
                    style={{ animationDuration: `${DURATION}ms` }}
                />
            </div>
        </div>
    );
}
