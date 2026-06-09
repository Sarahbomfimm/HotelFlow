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

    return null;
}
