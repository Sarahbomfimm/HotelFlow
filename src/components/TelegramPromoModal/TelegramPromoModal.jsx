import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';

const bannerSrc = '/banner%20telegram%20hotelflow.png';
const TELEGRAM_PROMO_EVENT = 'hotelflow:open-telegram-banner';

export default function TelegramPromoModal() {
    const { user, authReady } = useAuth();
    const { currentUserProfile } = useUsers();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const seenUserRef = useRef(null);

    const currentUserKey = useMemo(
        () => user?.firebaseUid || user?.id || user?.email || null,
        [user],
    );

    useEffect(() => {
        if (!authReady) return;

        if (!currentUserKey) {
            seenUserRef.current = null;
            setIsOpen(false);
            return;
        }

        if (location.pathname === '/login') {
            return;
        }

        if (seenUserRef.current !== currentUserKey) {
            const timer = window.setTimeout(() => {
                seenUserRef.current = currentUserKey;
                setIsOpen(true);
            }, 1100);

            return () => window.clearTimeout(timer);
        }
    }, [authReady, currentUserKey, location.pathname]);

    if (!isOpen || !user || location.pathname === '/login') {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(4,21,35,0.32)]">
                <div className="flex items-center justify-between border-b border-hotel-gray/20 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="font-heading text-xl font-bold text-hotel-blue">Novidade no HotelFlow</h2>
                        <p className="mt-1 text-sm text-hotel-gray-md">Receba alertas do sistema direto no Telegram.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-hotel-gray-md transition-colors hover:bg-hotel-light hover:text-hotel-blue"
                        aria-label="Fechar anúncio"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 sm:p-6">
                    <button
                        type="button"
                        onClick={() => {
                            if (!currentUserProfile?.telegram_chat_id) {
                                sessionStorage.setItem(TELEGRAM_PROMO_EVENT, '1');
                                window.dispatchEvent(new Event(TELEGRAM_PROMO_EVENT));
                                setIsOpen(false);
                                navigate('/dashboard');
                            }
                        }}
                        className="mx-auto block w-full max-w-md overflow-hidden rounded-3xl border border-hotel-gray/40 bg-hotel-light/40 shadow-sm transition-transform hover:-translate-y-0.5"
                        aria-label="Abrir conexão com Telegram"
                    >
                        <img
                            src={bannerSrc}
                            alt="Banner para conectar Telegram agora"
                            className="block h-auto w-full"
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}
