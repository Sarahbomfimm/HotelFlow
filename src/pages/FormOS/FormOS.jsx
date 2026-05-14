import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, CalendarDays, User, Building2, FileText, Upload, X, Loader } from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import OSCreatedAlert from '../../components/OSCreatedAlert/OSCreatedAlert';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { DEPARTAMENTOS } from '../../models/OrdemDeServico';
import { format } from 'date-fns';
import { UserRole } from '../../models/User';

export default function FormOS() {
    const { criarOS } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { getLeaderByDepartment, currentUserProfile } = useUsers();
    const navigate = useNavigate();
    const isDiretora = user?.role === UserRole.DIRETORA;
    const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
    const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
    const isCloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryUploadPreset);

    const [form, setForm] = useState({
        titulo: '',
        descricao: '',
        departamento: '',
        prazo: '',
        imagem: null,
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [osCriada, setOsCriada] = useState(null);
    const [showAlert, setShowAlert] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const prazoInputRef = useRef(null);

    const liderInfo = form.departamento ? getLeaderByDepartment(form.departamento) : null;

    const set = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
        if (submitError) setSubmitError('');
    };

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
    const toLocalEndOfDayISO = (dateString) => {
        const date = new Date(`${dateString}T23:59:59`);
        return date.toISOString();
    };

    const uploadImageToCloudinary = async (file) => {
        if (!isCloudinaryConfigured) {
            addNotification(
                'Cloudinary não configurado. Defina VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env e reinicie o npm run dev.',
                'error',
            );
            return;
        }

        try {
            setUploadingImage(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', cloudinaryUploadPreset);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
                { method: 'POST', body: formData },
            );

            const data = await response.json();

            if (!response.ok) {
                const cloudinaryMessage = data?.error?.message || 'Erro ao fazer upload da imagem.';
                throw new Error(cloudinaryMessage);
            }

            setForm((prev) => ({ ...prev, imagem: data.secure_url }));
            addNotification('Imagem anexada com sucesso!', 'success');
        } catch (error) {
            addNotification(`Erro ao enviar imagem: ${error.message}`, 'error');
            console.error(error);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validar tamanho (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                addNotification('Imagem muito grande. Máximo 5MB.', 'error');
                return;
            }
            uploadImageToCloudinary(file);
        }
    };

    const removeImage = () => {
        setForm((prev) => ({ ...prev, imagem: null }));
    };

    const validate = () => {
        const e = {};
        const hoje = format(new Date(), 'yyyy-MM-dd');
        if (!form.titulo.trim()) e.titulo = 'Título é obrigatório.';
        if (!form.descricao.trim()) e.descricao = 'Descrição é obrigatória.';
        if (!form.departamento) e.departamento = 'Selecione um departamento.';
        if (!form.prazo) e.prazo = 'Prazo é obrigatório.';
        else if (form.prazo < hoje) {
            e.prazo = 'O prazo não pode ser no passado.';
        }
        return e;
    };

    const resetForm = () => {
        setForm({ titulo: '', descricao: '', departamento: '', prazo: '', imagem: null });
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

            const responsavel = liderInfo;

            const nova = await criarOS(
                {
                    titulo: form.titulo.trim(),
                    descricao: form.descricao.trim(),
                    departamento: form.departamento,
                    responsavel_id: responsavel.id,
                    responsavel_uid: responsavel.firebaseUid || responsavel.id,
                    responsavel_email: responsavel.email,
                    responsavel_nome: responsavel.nome,
                    responsavel_telefone: responsavel.telefone || null,
                    responsavel_telegram_chat_id: responsavel.telegram_chat_id || null,
                    criado_por_telegram_chat_id: currentUserProfile?.telegram_chat_id || null,
                    prazo: toLocalEndOfDayISO(form.prazo),
                    imagem: form.imagem,
                },
                user,
            );

            addNotification(
                `Nova SI: "${form.titulo.trim()}" criada${isDiretora ? ` e atribuída a ${responsavel.nome} (${form.departamento})` : ''}.`,
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
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 rounded-xl bg-hotel-blue px-4 py-2 text-sm font-semibold font-body text-white shadow-sm transition-all hover:bg-hotel-blue/90"
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
                                className={`input cursor-pointer ${errors.departamento ? 'border-red-400 ring-1 ring-red-300' : ''}`}
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
                        <div onClick={abrirSeletorPrazo} className="cursor-pointer">
                            <label className="label" htmlFor="prazo">
                                <CalendarDays size={14} className="inline mr-1.5" />Prazo
                            </label>
                            <input
                                ref={prazoInputRef}
                                id="prazo"
                                type="date"
                                className={`input cursor-pointer ${errors.prazo ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                                min={format(new Date(), 'yyyy-MM-dd')}
                                value={form.prazo}
                                onChange={set('prazo')}
                            />
                            {errors.prazo && <p className="text-red-500 text-xs mt-1">{errors.prazo}</p>}
                        </div>
                    </div>

                    {/* Upload de Imagem com Cloudinary */}
                    <div>
                        <label className="label">
                            <Upload size={14} className="inline mr-1.5" />Anexar Foto <span className="text-hotel-gray-md font-normal">(opcional)</span>
                        </label>
                        {form.imagem ? (
                            <div className="relative">
                                <img
                                    src={form.imagem}
                                    alt="Preview SI"
                                    className="w-full max-h-40 object-cover rounded-lg border border-hotel-gray"
                                />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className={`w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors block ${
                                isCloudinaryConfigured
                                    ? 'border-hotel-gray hover:border-hotel-blue hover:bg-hotel-light/50 cursor-pointer'
                                    : 'border-red-200 bg-red-50 cursor-not-allowed'
                            }`}>
                                {uploadingImage ? (
                                    <>
                                        <Loader size={24} className="mx-auto mb-2 text-hotel-blue animate-spin" />
                                        <p className="text-sm font-semibold text-hotel-blue font-body">Enviando...</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={24} className={`mx-auto mb-2 ${isCloudinaryConfigured ? 'text-hotel-gray-md' : 'text-red-400'}`} />
                                        <p className={`text-sm font-semibold font-body ${isCloudinaryConfigured ? 'text-hotel-blue' : 'text-red-600'}`}>
                                            {isCloudinaryConfigured ? 'Clique para enviar uma foto' : 'Cloudinary não configurado'}
                                        </p>
                                        <p className="text-xs text-hotel-gray-md font-body mt-1">
                                            {isCloudinaryConfigured
                                                ? 'ou arraste um arquivo'
                                                : 'Adicione VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env'}
                                        </p>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageFileChange}
                                    disabled={uploadingImage || !isCloudinaryConfigured}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {/* Líder responsável (automático) */}
                    {liderInfo && (
                        <div className="flex flex-col gap-3 rounded-lg border border-hotel-gray bg-hotel-light p-3 animate-fadeIn sm:flex-row sm:items-center">
                            <div className="w-9 h-9 rounded-full bg-hotel-gold flex items-center justify-center font-bold text-white text-sm">
                                {liderInfo.nome[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs text-hotel-gray-md font-body">Responsável {isDiretora ? 'automático' : ''}</p>
                                <p className="text-sm font-semibold text-hotel-blue font-body">{liderInfo.nome}</p>
                            </div>
                            <User size={16} className="text-hotel-gold sm:ml-auto" />
                        </div>
                    )}

                    {/* Botões */}
                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                        <button type="button" onClick={() => navigate(-1)} className="btn-secondary w-full sm:w-auto">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
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
