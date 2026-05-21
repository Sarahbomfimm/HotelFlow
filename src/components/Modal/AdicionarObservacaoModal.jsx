import { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Paperclip } from 'lucide-react';
import PDCABadge from '../Badge/PDCABadge';
import { PDCALabel, PDCAStep } from '../../models/OrdemDeServico';
import { progressPdfUploadsEnabled } from '../../services/storage';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Modal para registrar progresso sem alterar o status da OS.
 */
export default function AdicionarObservacaoModal({ isOpen, os, onConfirm, onCancel }) {
    const [obs, setObs] = useState('');
    const [etapaPdca, setEtapaPdca] = useState(PDCAStep.PLAN);
    const [prazoEstimado, setPrazoEstimado] = useState('');
    const [anexoPdf, setAnexoPdf] = useState(null);
    const [anexoErro, setAnexoErro] = useState('');
    const textRef = useRef(null);
    const prazoInputRef = useRef(null);

    const abrirSeletorPrazo = () => {
        const input = prazoInputRef.current;
        if (!input) return;

        input.focus();
        if (typeof input.showPicker === 'function') {
            input.showPicker();
            return;
        }

        input.click();
    };

    useEffect(() => {
        if (isOpen) {
            setObs('');
            setEtapaPdca(os?.etapa_pdca || PDCAStep.PLAN);
            setPrazoEstimado('');
            setAnexoPdf(null);
            setAnexoErro('');
            setTimeout(() => textRef.current?.focus(), 80);
            const handler = (e) => { if (e.key === 'Escape') onCancel(); };
            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        }
    }, [isOpen, onCancel, os]);

    if (!isOpen || !os) return null;

    const handleConfirm = () => {
        if (!obs.trim()) return;
        onConfirm(obs.trim(), etapaPdca, prazoEstimado, anexoPdf);
        setObs('');
        setPrazoEstimado('');
        setAnexoPdf(null);
        setAnexoErro('');
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        if (!file) {
            setAnexoPdf(null);
            setAnexoErro('');
            return;
        }

        const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setAnexoPdf(null);
            setAnexoErro('Anexe somente arquivo PDF.');
            return;
        }

        if (file.size > MAX_PDF_SIZE_BYTES) {
            setAnexoPdf(null);
            setAnexoErro('O PDF deve ter no máximo 10MB.');
            return;
        }

        setAnexoPdf(file);
        setAnexoErro('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4 overflow-hidden animate-fadeIn">
                <div className="bg-hotel-blue px-6 py-4 flex items-center gap-3">
                    <PDCABadge etapa={etapaPdca} status={os?.status} />
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
                    <div onClick={abrirSeletorPrazo} className="cursor-pointer">
                        <label className="label mt-3 cursor-pointer" htmlFor="prazo-estimado">
                            Prazo estimado de entrega <span className="text-hotel-gray-md font-normal">(opcional)</span>
                        </label>
                        <input
                            ref={prazoInputRef}
                            id="prazo-estimado"
                            type="date"
                            className="input cursor-pointer hover:border-hotel-blue/40 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            value={prazoEstimado}
                            onChange={e => setPrazoEstimado(e.target.value)}
                        />
                    </div>

                    <label className="label mt-3" htmlFor="progresso-etapa-pdca">
                        Etapa PDCA atual
                    </label>
                    <select
                        id="progresso-etapa-pdca"
                        className="input"
                        value={etapaPdca}
                        onChange={(e) => setEtapaPdca(e.target.value)}
                    >
                        {[PDCAStep.PLAN, PDCAStep.DO, PDCAStep.CHECK].map((etapa) => (
                            <option key={etapa} value={etapa}>{etapa} - {PDCALabel[etapa]}</option>
                        ))}
                    </select>

                    <label className="label mt-3" htmlFor="progresso-pdf">
                        Anexar PDF do progresso <span className="text-hotel-gray-md font-normal">(opcional)</span>
                    </label>
                    <label
                        htmlFor="progresso-pdf"
                        className={`mt-1 block rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
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
                                    {anexoPdf ? 'Arquivo pronto para envio' : 'Clique para anexar um PDF'}
                                </p>
                                <p className="mt-0.5 text-[11px] text-hotel-gray-md">
                                    {anexoPdf ? anexoPdf.name : 'Somente PDF, até 10MB'}
                                </p>
                            </div>
                        </div>
                    </label>
                    <input
                        id="progresso-pdf"
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        disabled={!progressPdfUploadsEnabled}
                        onChange={handleFileChange}
                    />
                    {!progressPdfUploadsEnabled && (
                        <p className="mt-1 text-[11px] text-amber-700 font-body">
                            Anexo em PDF indisponivel. Configure VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_RAW_UPLOAD_PRESET no .env.
                        </p>
                    )}
                    {anexoPdf && (
                        <p className="mt-1 text-[11px] text-hotel-blue font-body">
                            PDF selecionado: <span className="font-semibold">{anexoPdf.name}</span>
                        </p>
                    )}
                    {anexoErro && (
                        <p className="mt-1 text-[11px] text-red-500 font-body">{anexoErro}</p>
                    )}

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
                        disabled={!obs.trim() || Boolean(anexoErro)}
                        className="btn-primary text-sm flex items-center gap-2"
                    >
                        Registrar <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
