import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const bannerSrc = '/atualiza%C3%A7oes%20hotel%20flow.png';

export default function UpdatesPromoModal() {
    const { user, authReady } = useAuth();
    const location = useLocation();
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
            }, 900);

            return () => window.clearTimeout(timer);
        }
    }, [authReady, currentUserKey, location.pathname]);

    if (!isOpen || !user || location.pathname === '/login') {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_24px_70px_rgba(4,21,35,0.28)]">
                <div className="flex items-center justify-between border-b border-hotel-gray/20 px-4 py-3 sm:px-5">
                    <div>
                        <h2 className="font-heading text-lg font-bold text-hotel-blue">Novidades no HotelFlow</h2>
                        <p className="mt-0.5 text-xs text-hotel-gray-md">Confira as melhorias implementadas no sistema.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hotel-gray-md transition-colors hover:bg-hotel-light hover:text-hotel-blue"
                        aria-label="Fechar anúncio"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-3 sm:p-4">
                    <div className="mx-auto block w-full max-w-sm overflow-hidden rounded-2xl border border-hotel-gray/40 bg-hotel-light/40 shadow-sm">
                        <img
                            src={bannerSrc}
                            alt="Anúncio com atualizações recentes do HotelFlow"
                            className="block h-auto w-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
