import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout({ children, pageTitle }) {
    const location = useLocation();
    const { user } = useAuth();
    
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex min-h-screen bg-hotel-light">
            {mobileMenuOpen && (
                <button
                    type="button"
                    aria-label="Fechar menu"
                    className="fixed inset-0 z-30 bg-hotel-blue/45 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <Sidebar mobileMenuOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

            <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden lg:h-screen">
                <Header pageTitle={pageTitle} onMenuClick={() => setMobileMenuOpen(true)} />
                <main id="app-main-content" className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                    <div className="flex min-h-full flex-col">
                        <div className="flex-1">
                            {children}
                        </div>
                        <footer className="mt-8 border-t border-hotel-gray-md/20 pt-4 text-center text-xs font-body text-hotel-gray-md sm:text-sm">
                            &copy; {new Date().getFullYear()} Sarah Bomfim
                        </footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
