import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, danger = false }) {
    useEffect(() => {
        if (isOpen) {
            const handler = (e) => { if (e.key === 'Escape') onCancel(); };
            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        }
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4 overflow-hidden">
                <div className={`px-6 py-4 flex items-center gap-3 ${danger ? 'bg-red-50' : 'bg-hotel-light'}`}>
                    <AlertTriangle size={22} className={danger ? 'text-red-500' : 'text-hotel-gold'} />
                    <h3 className="font-heading font-semibold text-hotel-blue">{title}</h3>
                    <button onClick={onCancel} className="ml-auto text-hotel-gray-md hover:text-gray-700 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-6 py-5">
                    <p className="text-sm font-body text-gray-600">{message}</p>
                </div>
                <div className="px-6 pb-5 flex justify-end gap-3">
                    <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
                    <button
                        onClick={onConfirm}
                        className={`font-heading font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none
                        ${danger
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'btn-primary'
                            }`}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}
