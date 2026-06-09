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

    return null;
}
