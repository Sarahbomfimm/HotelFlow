import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import { useAuth } from '../../context/AuthContext';
import { subscribePendingInvitations, updateMundoInvitationStatus } from '../../services/mundoStorage';

export default function AppLayout({ children, pageTitle }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [declineReason, setDeclineReason] = useState('');

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Ouvinte global para convites pendentes no Mundo HotelFlow
    useEffect(() => {
        const userId = user?.firebaseUid || user?.id;
        if (!userId) return;

        const unsubscribe = subscribePendingInvitations(userId, (invites) => {
            setPendingInvites(invites);
        });

        return () => unsubscribe();
    }, [user]);

    const handleAccept = async (invite) => {
        await updateMundoInvitationStatus(invite.id, 'accepted');
        navigate(`/mundo?room=${encodeURIComponent(invite.room)}`);
        setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    };

    const handleDecline = async (invite) => {
        await updateMundoInvitationStatus(invite.id, 'rejected', declineReason.trim() || 'Sem observações.');
        setDeclineReason('');
        setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    };

    const activeInvite = pendingInvites[0] || null;

    return (
        <div className="flex min-h-screen bg-hotel-light">
            {activeInvite && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 backdrop-blur-md p-4 animate-fadeIn">
                    <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-scaleUp">
                        {/* Header */}
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="rounded-2xl bg-hotel-gold/15 p-2.5 text-hotel-gold animate-bounce">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <h3 className="font-heading text-base font-extrabold text-slate-800 leading-tight">
                                    Chamado no Mundo HotelFlow!
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Convite de Bate-Papo</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="text-sm text-slate-650 leading-relaxed font-body text-left">
                            <span className="font-bold text-slate-800">{activeInvite.senderNome}</span> está chamando você para conversar na sala <span className="font-extrabold text-hotel-blue">{activeInvite.room}</span>!
                        </div>

                        {/* Input Justificativa de Recusa */}
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="decline-reason">
                                Observação (enviada caso recuse)
                            </label>
                            <input
                                id="decline-reason"
                                type="text"
                                placeholder="Ex: Estou atendendo um hóspede no momento."
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                maxLength={80}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-hotel-gold focus:bg-white transition-all"
                            />
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => handleAccept(activeInvite)}
                                className="flex-1 rounded-xl bg-hotel-blue hover:bg-hotel-blue/90 py-3 text-xs font-bold text-white transition-all active:scale-95 shadow-md shadow-hotel-blue/15"
                            >
                                Aceitar Convite
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDecline(activeInvite)}
                                className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-650 transition-all active:scale-95"
                            >
                                Recusar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
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
