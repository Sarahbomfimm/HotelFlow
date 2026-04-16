import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, CalendarDays, User, Building2, FileText } from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import OSCreatedAlert from '../../components/OSCreatedAlert/OSCreatedAlert';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { DEPARTAMENTOS } from '../../models/OrdemDeServico';
import { format } from 'date-fns';

export default function FormOS() {
    const { criarOS } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { getLeaderByDepartment } = useUsers();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        titulo: '',
        descricao: '',
        departamento: '',
        prazo: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [osCriada, setOsCriada] = useState(null);
    const [showAlert, setShowAlert] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const liderInfo = form.departamento ? getLeaderByDepartment(form.departamento) : null;

    const set = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
        if (submitError) setSubmitError('');
    };

    const validate = () => {
        const e = {};
        if (!form.titulo.trim()) e.titulo = 'Título é obrigatório.';
        if (!form.descricao.trim()) e.descricao = 'Descrição é obrigatória.';
        if (!form.departamento) e.departamento = 'Selecione um departamento.';
        if (!form.prazo) e.prazo = 'Prazo é obrigatório.';
        else if (new Date(form.prazo) < new Date(new Date().toDateString())) {
            e.prazo = 'O prazo não pode ser no passado.';
        }
        return e;
    };

    const resetForm = () => {
        setForm({ titulo: '', descricao: '', departamento: '', prazo: '' });
        setErrors({});
        setSubmitError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        if (!liderInfo) {
            setErrors((prev) => ({ ...prev, departamento: 'Nao existe lider cadastrado para esse departamento.' }));
            return;
        }

        setLoading(true);
        try {
            await new Promise((r) => setTimeout(r, 400));

            const nova = await criarOS(
                {
                    titulo: form.titulo.trim(),
                    descricao: form.descricao.trim(),
                    departamento: form.departamento,
                    responsavel_id: liderInfo.id,
                    responsavel_uid: liderInfo.firebaseUid || liderInfo.id,
                    responsavel_email: liderInfo.email,
                    responsavel_nome: liderInfo.nome,
                    prazo: new Date(form.prazo).toISOString(),
                },
                user,
            );

            addNotification(
                `Nova SI: "${form.titulo.trim()}" criada e atribuída a ${liderInfo.nome} (${form.departamento}).`,
                'new_os',
            );

            setOsCriada(nova);
            setShowAlert(true);
        } catch (error) {
            setSubmitError(error.message || 'Nao foi possivel criar a solicitacao interna.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout pageTitle="Nova Solicitação Interna">
            <div className="max-w-2xl mx-auto animate-fadeIn">
                {/* Cabeçalho */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hotel-blue text-white text-sm font-semibold font-body hover:bg-hotel-blue/90 transition-all shadow-sm"
                        aria-label="Voltar"
                    >
                        <ArrowLeft size={18} /> Voltar
                    </button>
                    <div>
                        <h1 className="font-heading font-bold text-hotel-blue text-xl">Nova SI</h1>
                        <p className="text-hotel-gray-md text-xs font-body">Preencha os campos para criar uma nova solicitação interna.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate className="card space-y-5">
                    {/* Título */}
                    <div>
                        <label className="label" htmlFor="titulo">
                            <FileText size={14} className="inline mr-1.5" />Título
                        </label>
                        <input
                            id="titulo"
                            type="text"
                            className={`input ${errors.titulo ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                            placeholder="Ex.: Revisão do sistema de refrigeração — Ala Norte"
                            value={form.titulo}
                            onChange={set('titulo')}
                            maxLength={120}
                        />
                        {errors.titulo && <p className="text-red-500 text-xs mt-1">{errors.titulo}</p>}
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="label" htmlFor="descricao">
                            <FileText size={14} className="inline mr-1.5" />Descrição
                        </label>
                        <textarea
                            id="descricao"
                            rows={4}
                            className={`input resize-none ${errors.descricao ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                            placeholder="Descreva detalhadamente o que precisa ser feito..."
                            value={form.descricao}
                            onChange={set('descricao')}
                        />
                        {errors.descricao && <p className="text-red-500 text-xs mt-1">{errors.descricao}</p>}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                        {/* Departamento */}
                        <div>
                            <label className="label" htmlFor="departamento">
                                <Building2 size={14} className="inline mr-1.5" />Departamento
                            </label>
                            <select
                                id="departamento"
                                className={`input ${errors.departamento ? 'border-red-400 ring-1 ring-red-300' : ''}`}
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
                            <label className="label" htmlFor="prazo">
                                <CalendarDays size={14} className="inline mr-1.5" />Prazo
                            </label>
                            <input
                                id="prazo"
                                type="date"
                                className={`input ${errors.prazo ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                                min={format(new Date(), 'yyyy-MM-dd')}
                                value={form.prazo}
                                onChange={set('prazo')}
                            />
                            {errors.prazo && <p className="text-red-500 text-xs mt-1">{errors.prazo}</p>}
                        </div>
                    </div>

                    {/* Líder responsável (automático) */}
                    {liderInfo && (
                        <div className="flex items-center gap-3 p-3 bg-hotel-light border border-hotel-gray rounded-lg animate-fadeIn">
                            <div className="w-9 h-9 rounded-full bg-hotel-gold flex items-center justify-center font-bold text-white text-sm">
                                {liderInfo.nome[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs text-hotel-gray-md font-body">Responsável automático</p>
                                <p className="text-sm font-semibold text-hotel-blue font-body">{liderInfo.nome}</p>
                            </div>
                            <User size={16} className="ml-auto text-hotel-gold" />
                        </div>
                    )}

                    {/* Botões */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Send size={16} />
                            )}
                            {loading ? 'Criando...' : 'Criar SI'}
                        </button>
                    </div>

                    {submitError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700">
                            {submitError}
                        </div>
                    )}
                </form>
            </div>

            {/* Alerta fullscreen de OS criada */}
            <OSCreatedAlert
                isOpen={showAlert}
                os={osCriada}
                onClose={() => { setShowAlert(false); resetForm(); }}
                onVerOS={() => { setShowAlert(false); navigate('/ordens'); }}
            />
        </AppLayout>
    );
}
