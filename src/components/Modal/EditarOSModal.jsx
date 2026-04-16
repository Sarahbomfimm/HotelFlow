import { useState, useEffect } from 'react';
import { Save, X, CalendarDays, FileText, Building2 } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { DEPARTAMENTOS } from '../../models/OrdemDeServico';
import { format, parseISO } from 'date-fns';

export default function EditarOSModal({ os, onClose }) {
    const { editarOS } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { getLeaderByDepartment } = useUsers();

    const [form, setForm] = useState({
        titulo: '',
        descricao: '',
        departamento: '',
        prazo: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (os) {
            setForm({
                titulo: os.titulo,
                descricao: os.descricao,
                departamento: os.departamento,
                prazo: format(parseISO(os.prazo), 'yyyy-MM-dd'),
            });
            setErrors({});
        }
    }, [os]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!os) return null;

    const set = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.titulo.trim()) e.titulo = 'Título é obrigatório.';
        if (!form.descricao.trim()) e.descricao = 'Descrição é obrigatória.';
        if (!form.departamento) e.departamento = 'Selecione um departamento.';
        if (!form.prazo) e.prazo = 'Prazo é obrigatório.';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setLoading(true);
        await new Promise((r) => setTimeout(r, 400));

        const liderInfo = getLeaderByDepartment(form.departamento) || { id: os.responsavel_id, nome: os.responsavel_nome };

        await editarOS(
            os.id,
            {
                titulo: form.titulo.trim(),
                descricao: form.descricao.trim(),
                departamento: form.departamento,
                prazo: new Date(form.prazo).toISOString(),
                responsavel_id: liderInfo.id,
                responsavel_nome: liderInfo.nome,
            },
            user,
        );

        addNotification(`OS "${form.titulo.trim()}" foi editada com sucesso.`, 'success');
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
                    <h3 className="font-heading font-semibold text-white flex-1">Editar OS</h3>
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
                                {DEPARTAMENTOS.map((dep) => (
                                    <option key={dep} value={dep}>{dep}</option>
                                ))}
                            </select>
                            {errors.departamento && <p className="text-red-500 text-xs mt-1">{errors.departamento}</p>}
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
