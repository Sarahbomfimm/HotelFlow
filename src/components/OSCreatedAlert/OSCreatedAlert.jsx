import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';
import Logo from '../Logo/Logo';

/**
 * Alerta fullscreen exibido após a criação de uma OS.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object} props.os - dados da OS criada
 * @param {function} props.onClose
 * @param {function} props.onVerOS - navegar para /ordens
 */
export default function OSCreatedAlert({ isOpen, os, onClose, onVerOS }) {
    useEffect(() => {
        if (isOpen) {
            const handler = (e) => { if (e.key === 'Escape') onClose(); };
            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        }
    }, [isOpen, onClose]);

    if (!isOpen || !os) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-hotel-blue/95 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Ondas decorativas */}
            <svg className="absolute bottom-0 left-0 w-full opacity-10 pointer-events-none" viewBox="0 0 1440 120" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 60 Q180 10 360 60 Q540 110 720 60 Q900 10 1080 60 Q1260 110 1440 60 L1440 120 L0 120 Z" fill="#C49A6C" />
            </svg>
            <svg className="absolute top-0 left-0 w-full opacity-10 pointer-events-none" viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 40 Q180 0 360 40 Q540 80 720 40 Q900 0 1080 40 Q1260 80 1440 40 L1440 0 L0 0 Z" fill="white" />
            </svg>

            <div className="relative w-full max-w-lg mx-4 text-center animate-fadeIn">
                {/* Fechar */}
                <button
                    onClick={onClose}
                    className="absolute -top-2 right-0 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Fechar"
                >
                    <X size={22} />
                </button>

                {/* Ícone de sucesso */}
                <div className="flex justify-center mb-6">
                    <div className="w-24 h-24 rounded-full bg-hotel-gold/20 border-4 border-hotel-gold flex items-center justify-center">
                        <CheckCircle2 size={48} className="text-hotel-gold" />
                    </div>
                </div>

                {/* Logo */}
                <div className="flex justify-center mb-4">
                    <Logo size={28} light />
                </div>

                {/* Título */}
                <h1 className="font-heading font-bold text-white text-3xl mb-2">
                    SI Criada com Sucesso!
                </h1>
                <p className="text-white/70 font-body text-sm mb-8">
                    A solicitação interna foi registrada e o responsável foi notificado.
                </p>

                {/* Card de resumo */}
                <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-left space-y-3 mb-8 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-hotel-gold mt-2 flex-shrink-0" />
                        <div>
                            <p className="text-white/60 text-xs font-body uppercase tracking-wide">Título</p>
                            <p className="text-white font-semibold font-body">{os.titulo}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-hotel-gold mt-2 flex-shrink-0" />
                            <div>
                                <p className="text-white/60 text-xs font-body uppercase tracking-wide">Departamento</p>
                                <p className="text-white font-semibold font-body text-sm">{os.departamento}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-hotel-gold mt-2 flex-shrink-0" />
                            <div>
                                <p className="text-white/60 text-xs font-body uppercase tracking-wide">Responsável</p>
                                <p className="text-white font-semibold font-body text-sm">{os.responsavel_nome}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-hotel-gold mt-2 flex-shrink-0" />
                        <div>
                            <p className="text-white/60 text-xs font-body uppercase tracking-wide">Status inicial</p>
                            <p className="text-emerald-400 font-semibold font-body text-sm">● Aberto</p>
                        </div>
                    </div>
                </div>

                {/* Ações */}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl border border-white/30 text-white/80 font-semibold font-body
                                   hover:bg-white/10 transition-colors text-sm"
                    >
                        Criar outra SI
                    </button>
                    <button
                        onClick={onVerOS}
                        className="px-6 py-3 rounded-xl bg-hotel-gold text-white font-semibold font-body
                                   hover:bg-hotel-gold-lt transition-colors text-sm flex items-center gap-2"
                    >
                        Ver SI <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
