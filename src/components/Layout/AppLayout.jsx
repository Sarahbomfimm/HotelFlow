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
        <div className="relative flex min-h-screen overflow-hidden bg-hotel-light">
            {mobileMenuOpen && (
                <button
                    type="button"
                    aria-label="Fechar menu"
                    className="fixed inset-0 z-30 bg-hotel-blue/45 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <Sidebar mobileMenuOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

            <div className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden lg:h-screen bg-gradient-to-tr from-[#E6ECF3] via-[#F5F7FA] to-[#EBEFF5]">
                {/* Decorative blurred bg blobs for a modern mesh gradient effect in the content area */}
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-hotel-blue/10 blur-[120px] z-0" />
                <div className="pointer-events-none absolute -left-24 bottom-12 h-96 w-96 rounded-full bg-hotel-gold/8 blur-[120px] z-0" />
                <div className="pointer-events-none absolute left-1/3 top-1/4 h-[400px] w-[400px] rounded-full bg-hotel-blue/6 blur-[140px] z-0" />

                <Header pageTitle={pageTitle} onMenuClick={() => setMobileMenuOpen(true)} />
                <main key={location.pathname} id="app-main-content" className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 relative z-10">
                    <div className="flex min-h-full flex-col">
                        <div className="flex-1">
                            {children}
                        </div>
                        <footer className="mt-12 py-6 px-4 border-t border-slate-200/60 select-none z-10 relative text-center">
                            <div className="flex flex-col items-center justify-center gap-2.5 max-w-7xl mx-auto text-xs font-body text-hotel-gray-md">
                                <div className="text-xs text-slate-500 font-medium">
                                    &copy; {new Date().getFullYear()} HotelFlow. Todos os direitos reservados.
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <span className="text-slate-500 font-medium">Desenvolvido por</span>
                                    <a
                                        href="https://yourpage-tech.vercel.app/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#9333EA] text-white font-extrabold text-xs tracking-wide shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                                    >
                                        YourPage
                                    </a>
                                </div>
                            </div>
                        </footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
