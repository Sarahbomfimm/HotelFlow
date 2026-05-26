import { useState, useEffect, useMemo } from 'react';
import { Save, X, CalendarDays, FileText, Building2, User } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { PDCAStep, PDCALabel, StatusOS } from '../../models/OrdemDeServico';
import { UserRole } from '../../models/User';
import { format, parseISO } from 'date-fns';

export default function EditarOSModal({ os, onClose }) {
    const { editarOS } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { users, availableDepartments, currentUserProfile } = useUsers();
    const actor = currentUserProfile || user;

    const [form, setForm] = useState({
        titulo: '',
        descricao: '',
        departamento: '',
        etapa_pdca: PDCAStep.PLAN,
        prazo: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [responsaveisSelecionados, setResponsaveisSelecionados] = useState(new Set());

    const assignableUsers = useMemo(
        () => users
            .filter((u) => [UserRole.LIDER, UserRole.ADMIN, UserRole.DIRETORA].includes(u.role))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        [users],
    );

    useEffect(() => {
        if (os) {
            setForm({
                titulo: os.titulo,
                descricao: os.descricao,
                departamento: os.departamento,
                etapa_pdca: os.etapa_pdca || PDCAStep.PLAN,
                prazo: format(parseISO(os.prazo), 'yyyy-MM-dd'),
            });
            const selecionadosIniciais = [os.responsavel_id, ...(Array.isArray(os.co_responsaveis) ? os.co_responsaveis.map((item) => item.id) : [])]
                .filter(Boolean);
            setResponsaveisSelecionados(new Set(selecionadosIniciais));
            setErrors({});
        }
    }, [os]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!os) return null;

    const toLocalEndOfDayISO = (dateString) => {
        const date = new Date(`${dateString}T23:59:59`);
        return date.toISOString();
    };

    const set = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.titulo.trim()) e.titulo = 'Título é obrigatório.';
        if (!form.descricao.trim()) e.descricao = 'Descrição é obrigatória.';
        if (!form.departamento) e.departamento = 'Selecione um departamento.';
        if (!form.etapa_pdca) e.etapa_pdca = 'Selecione a etapa PDCA.';
        if (!form.prazo) e.prazo = 'Prazo é obrigatório.';
        if (responsaveisSelecionados.size === 0) e.responsaveis = 'Selecione pelo menos uma pessoa para atribuição.';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setLoading(true);
        await new Promise((r) => setTimeout(r, 400));

        const responsaveisEscolhidos = assignableUsers.filter((item) => responsaveisSelecionados.has(item.id));
        const responsavel = responsaveisEscolhidos[0] || null;
        const coResponsaveis = responsaveisEscolhidos.slice(1);

        if (!responsavel) {
            setErrors((prev) => ({ ...prev, responsaveis: 'Selecione pelo menos uma pessoa para atribuição.' }));
            setLoading(false);
            return;
        }

        await editarOS(
            os.id,
            {
                titulo: form.titulo.trim(),
                descricao: form.descricao.trim(),
                departamento: form.departamento,
                etapa_pdca: os.status === StatusOS.CONCLUIDO ? PDCAStep.ACT : form.etapa_pdca,
                prazo: toLocalEndOfDayISO(form.prazo),
                responsavel_id: responsavel.id,
                responsavel_uid: responsavel.firebaseUid || responsavel.id,
                responsavel_email: responsavel.email,
                responsavel_nome: responsavel.nome,
                responsavel_telefone: responsavel.telefone || null,
                responsavel_telegram_chat_id: responsavel.telegram_chat_id || null,
                co_responsaveis: coResponsaveis.map((l) => ({
                    id: l.id,
                    uid: l.firebaseUid || l.id,
                    email: l.email,
                    nome: l.nome,
                    telefone: l.telefone || null,
                    telegram_chat_id: l.telegram_chat_id || null,
                })),
            },
            actor,
        );

        addNotification(`SI "${form.titulo.trim()}" foi editada com sucesso.`, 'success');
        setLoading(false);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto animate-fadeIn">
                {/* Header */}
                <div className="sticky top-0 bg-hotel-blue px-6 py-4 flex items-center gap-3 z-10">
                    <h3 className="font-heading font-semibold text-white flex-1">Editar SI</h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
                    {/* Título */}
                    <div>
                        <label className="label" htmlFor="edit-titulo">
                            <FileText size={13} className="inline mr-1.5" />Título
                        </label>
                        <input
                            id="edit-titulo"
                            type="text"
                            className={`input ${errors.titulo ? 'border-red-400' : ''}`}
                            value={form.titulo}
                            onChange={set('titulo')}
                            maxLength={120}
                        />
                        {errors.titulo && <p className="text-red-500 text-xs mt-1">{errors.titulo}</p>}
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="label" htmlFor="edit-descricao">
                            <FileText size={13} className="inline mr-1.5" />Descrição
                        </label>
                        <textarea
                            id="edit-descricao"
                            rows={4}
                            className={`input resize-none ${errors.descricao ? 'border-red-400' : ''}`}
                            value={form.descricao}
                            onChange={set('descricao')}
                        />
                        {errors.descricao && <p className="text-red-500 text-xs mt-1">{errors.descricao}</p>}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                        {/* Departamento */}
                        <div>
                            <label className="label" htmlFor="edit-departamento">
                                <Building2 size={13} className="inline mr-1.5" />Departamento
                            </label>
                            <select
                                id="edit-departamento"
                                className={`input ${errors.departamento ? 'border-red-400' : ''}`}
                                value={form.departamento}
                                onChange={set('departamento')}
                            >
                                <option value="">Selecione...</option>
                                {availableDepartments.map((dep) => (
                                    <option key={dep} value={dep}>{dep}</option>
                                ))}
                            </select>
                            {errors.departamento && <p className="text-red-500 text-xs mt-1">{errors.departamento}</p>}
                        </div>

                        <div>
                            <label className="label" htmlFor="edit-etapa-pdca">
                                <Building2 size={13} className="inline mr-1.5" />Etapa PDCA
                            </label>
                            <select
                                id="edit-etapa-pdca"
                                className={`input ${errors.etapa_pdca ? 'border-red-400' : ''}`}
                                value={os.status === StatusOS.CONCLUIDO ? PDCAStep.ACT : form.etapa_pdca}
                                onChange={set('etapa_pdca')}
                                disabled={os.status === StatusOS.CONCLUIDO}
                            >
                                {[PDCAStep.PLAN, PDCAStep.DO, PDCAStep.CHECK, PDCAStep.ACT].map((etapa) => (
                                    <option key={etapa} value={etapa}>{etapa} - {PDCALabel[etapa]}</option>
                                ))}
                            </select>
                            {errors.etapa_pdca && <p className="text-red-500 text-xs mt-1">{errors.etapa_pdca}</p>}
                        </div>

                        {/* Prazo */}
                        <div>
                            <label className="label" htmlFor="edit-prazo">
                                <CalendarDays size={13} className="inline mr-1.5" />Prazo
                            </label>
                            <input
                                id="edit-prazo"
                                type="date"
                                className={`input ${errors.prazo ? 'border-red-400' : ''}`}
                                value={form.prazo}
                                onChange={set('prazo')}
                            />
                            {errors.prazo && <p className="text-red-500 text-xs mt-1">{errors.prazo}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="label">
                            <User size={13} className="inline mr-1.5" />Atribuir para
                            <span className="ml-1 text-hotel-gray-md font-normal">(selecione uma ou mais pessoas)</span>
                        </label>
                        <div className={`flex flex-wrap gap-2 rounded-lg border p-3 bg-hotel-light transition-colors ${responsaveisSelecionados.size === 0 && errors.responsaveis ? 'border-red-400 ring-1 ring-red-300' : 'border-hotel-gray'}`}>
                            {assignableUsers.map((pessoa) => {
                                const selecionado = responsaveisSelecionados.has(pessoa.id);
                                const isPrimario = selecionado && [...responsaveisSelecionados][0] === pessoa.id;
                                return (
                                    <button
                                        key={pessoa.id}
                                        type="button"
                                        onClick={() => {
                                            setResponsaveisSelecionados((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(pessoa.id)) next.delete(pessoa.id);
                                                else next.add(pessoa.id);
                                                return next;
                                            });
                                            if (errors.responsaveis) setErrors((prev) => ({ ...prev, responsaveis: '' }));
                                        }}
                                        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold font-body transition-all border ${
                                            selecionado
                                                ? 'bg-hotel-blue text-white border-hotel-blue shadow-sm'
                                                : 'bg-white text-hotel-blue border-hotel-gray hover:border-hotel-blue/50'
                                        }`}
                                    >
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selecionado ? 'bg-hotel-gold text-white' : 'bg-hotel-gray text-hotel-gray-md'}`}>
                                            {pessoa.nome[0].toUpperCase()}
                                        </span>
                                        {pessoa.nome}
                                        {isPrimario && <span className="ml-1 text-[10px] text-hotel-gold font-bold uppercase tracking-wide">principal</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-hotel-gray-md font-body">
                            O primeiro selecionado será o responsável principal; os demais serão co-responsáveis.
                        </p>
                        {errors.responsaveis && <p className="text-red-500 text-xs mt-1">{errors.responsaveis}</p>}
                    </div>

                    {/* Botões */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                            {loading
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={15} />
                            }
                            {loading ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
