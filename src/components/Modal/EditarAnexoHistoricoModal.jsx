import { useState, useEffect, useRef } from 'react';
import { X, Paperclip, AlertTriangle } from 'lucide-react';
import { progressPdfUploadsEnabled } from '../../services/storage';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export default function EditarAnexoHistoricoModal({ isOpen, os, historicoItem, onConfirm, onCancel }) {
    const [opcao, setOpcao] = useState('remover'); // 'remover' | 'substituir'
    const [novoAnexoPdf, setNovoAnexoPdf] = useState(null);
    const [anexoErro, setAnexoErro] = useState('');
    const [motivo, setMotivo] = useState('');
    const textRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        setOpcao('remover');
        setNovoAnexoPdf(null);
        setAnexoErro('');
        setMotivo('');
        setTimeout(() => textRef.current?.focus(), 80);

        const handler = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onCancel]);

    if (!isOpen || !os || !historicoItem) return null;

    const handleConfirm = () => {
        if (!motivo.trim()) return;
        if (opcao === 'substituir' && (!novoAnexoPdf || anexoErro)) return;

        onConfirm(
            os.id,
            historicoItem.data,
            opcao === 'substituir' ? novoAnexoPdf : null,
            opcao === 'remover',
            motivo.trim()
        );
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        if (!file) {
            setNovoAnexoPdf(null);
            setAnexoErro('');
            return;
        }

        const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setNovoAnexoPdf(null);
            setAnexoErro('Anexe somente arquivo PDF.');
            return;
        }

        if (file.size > MAX_PDF_SIZE_BYTES) {
            setNovoAnexoPdf(null);
            setAnexoErro('O PDF deve ter no máximo 10MB.');
            return;
        }

        setNovoAnexoPdf(file);
        setAnexoErro('');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-fadeIn">
                {/* Header */}
                <div className="bg-hotel-blue px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Paperclip size={18} />
                        <div>
                            <h3 className="font-heading font-semibold text-white">Ajustar Documento Anexado</h3>
                            <p className="text-white/60 text-xs font-body">Histórico de Alterações</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-white/50 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Alerta de confirmação */}
                    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs font-body text-amber-800">
                        <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                        <div>
                            <span className="font-bold block text-amber-900">Atenção</span>
                            O ajuste modificará o anexo deste registro de histórico e registrará uma observação explicativa na descrição dele.
                        </div>
                    </div>

                    {/* Exibe o anexo atual */}
                    <div className="rounded-xl border border-hotel-gray/50 bg-hotel-light/30 p-3 text-xs">
                        <p className="text-hotel-gray-md font-semibold font-body">Arquivo anexado atualmente:</p>
                        <p className="text-sm font-semibold text-hotel-blue font-body truncate mt-1">
                            {historicoItem.anexo_pdf_nome || 'anexo.pdf'}
                        </p>
                    </div>

                    {/* Opções de Ajuste */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-hotel-blue uppercase tracking-wide">O que deseja fazer?</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setOpcao('remover')}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                                    opcao === 'remover'
                                        ? 'border-hotel-blue bg-hotel-light/50 text-hotel-blue font-bold shadow-sm'
                                        : 'border-hotel-gray bg-white text-hotel-gray-md hover:border-hotel-blue/30'
                                }`}
                            >
                                <span className="text-sm">Remover anexo</span>
                                <span className="text-[10px] text-hotel-gray-md font-normal mt-0.5">Excluir PDF do registro</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setOpcao('substituir')}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                                    opcao === 'substituir'
                                        ? 'border-hotel-blue bg-hotel-light/50 text-hotel-blue font-bold shadow-sm'
                                        : 'border-hotel-gray bg-white text-hotel-gray-md hover:border-hotel-blue/30'
                                }`}
                            >
                                <span className="text-sm">Substituir anexo</span>
                                <span className="text-[10px] text-hotel-gray-md font-normal mt-0.5">Enviar novo arquivo PDF</span>
                            </button>
                        </div>
                    </div>

                    {/* Campo de Upload do Novo PDF */}
                    {opcao === 'substituir' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-hotel-blue uppercase tracking-wide">
                                Selecione o novo arquivo PDF
                            </label>
                            <label
                                htmlFor="novo-anexo-pdf-input"
                                className={`block rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
                                    progressPdfUploadsEnabled
                                        ? 'cursor-pointer border-hotel-blue/25 bg-hotel-light/30 hover:border-hotel-blue/45 hover:bg-hotel-light/60'
                                        : 'cursor-not-allowed border-amber-300 bg-amber-50/70'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="rounded-lg bg-hotel-blue/10 p-2 text-hotel-blue">
                                        <Paperclip size={14} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-hotel-blue">
                                            {novoAnexoPdf ? 'Arquivo pronto para substituição' : 'Clique para selecionar novo PDF'}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-hotel-gray-md">
                                            {novoAnexoPdf ? novoAnexoPdf.name : 'Somente PDF, até 10MB'}
                                        </p>
                                    </div>
                                </div>
                            </label>
                            <input
                                id="novo-anexo-pdf-input"
                                type="file"
                                accept="application/pdf,.pdf"
                                className="sr-only"
                                disabled={!progressPdfUploadsEnabled}
                                onChange={handleFileChange}
                            />
                            {anexoErro && (
                                <p className="mt-1 text-[11px] text-red-500 font-body">{anexoErro}</p>
                            )}
                        </div>
                    )}

                    {/* Motivo do Ajuste */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-hotel-blue uppercase tracking-wide block" htmlFor="motivo-ajuste">
                            Motivo/Observação do Ajuste <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="motivo-ajuste"
                            name="motivo-ajuste"
                            ref={textRef}
                            rows={3}
                            placeholder="Ex: Documento incorreto anexado por engano. / Substituído pelo PDF final assinado."
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="input resize-none w-full"
                            maxLength={300}
                        />
                        <div className="flex items-center justify-between text-[10px] text-hotel-gray-md font-body mt-1">
                            <span>* Campo obrigatório</span>
                            <span>{motivo.length}/300</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-hotel-gray/40 bg-white px-6 py-4">
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button onClick={onCancel} className="btn-secondary w-full text-sm sm:w-auto">Cancelar</button>
                        <button
                            onClick={handleConfirm}
                            disabled={!motivo.trim() || (opcao === 'substituir' && (!novoAnexoPdf || !!anexoErro))}
                            className="btn-primary flex w-full items-center justify-center gap-2 text-sm sm:w-auto"
                        >
                            Confirmar Ajuste
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
