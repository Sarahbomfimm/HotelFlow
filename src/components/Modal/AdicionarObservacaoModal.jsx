import { useState, useEffect, useRef } from 'react';
import { PlusCircle, X, ArrowRight } from 'lucide-react';

/**
 * Modal para registrar progresso sem alterar o status da OS.
 */
export default function AdicionarObservacaoModal({ isOpen, os, onConfirm, onCancel }) {
    const [obs, setObs] = useState('');
    const textRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setObs('');
            setTimeout(() => textRef.current?.focus(), 80);
            const handler = (e) => { if (e.key === 'Escape') onCancel(); };
            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        }
    }, [isOpen, onCancel]);

    if (!isOpen || !os) return null;

    const handleConfirm = () => {
        if (!obs.trim()) return;
        onConfirm(obs.trim());
        setObs('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4 overflow-hidden animate-fadeIn">
                <div className="bg-hotel-blue px-6 py-4 flex items-center gap-3">
                    <PlusCircle size={20} className="text-hotel-gold" />
                    <div className="flex-1">
                        <h3 className="font-heading font-semibold text-white">Registrar Progresso</h3>
                        <p className="text-white/60 text-xs font-body">Adicione uma atualizacao sem alterar o status</p>
                    </div>
                    <button onClick={onCancel} className="text-white/50 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 pt-4 pb-2">
                    <p className="text-xs text-hotel-gray-md font-body">SI em andamento:</p>
                    <p className="text-sm font-semibold text-hotel-blue font-body truncate">{os.titulo}</p>
                </div>

                <div className="px-6 pb-5">
                    <label className="label mt-3">
                        O que foi feito / progresso atual
                    </label>
                    <textarea
                        ref={textRef}
                        rows={3}
                        className="input resize-none"
                        placeholder="Ex.: Trocando a lampada... / Material pendente de cotacao..."
                        value={obs}
                        onChange={(e) => setObs(e.target.value)}
                        maxLength={500}
                    />
                    <p className="text-[11px] text-hotel-gray-md font-body text-right mt-1">{obs.length}/500</p>
                </div>

                <div className="px-6 pb-5 flex justify-end gap-3">
                    <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
                    <button
                        onClick={handleConfirm}
                        disabled={!obs.trim()}
                        className="btn-primary text-sm flex items-center gap-2"
                    >
                        Registrar <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
