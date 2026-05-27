import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, UserCog } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import AppLayout from '../../components/Layout/AppLayout';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { db, isFirebaseConfigured } from '../../services/firebase';
import { UserRole } from '../../models/User';
import { normalizePermissions, PERMISSION_DEFINITIONS } from '../../services/permissions';

function parseDepartamentos(value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export default function EditLeader() {
    const navigate = useNavigate();
    const { userId } = useParams();
    const { usersFromFirestore } = useUsers();
    const { addNotification } = useNotification();

    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        telefone: '',
        telegram_chat_id: '',
        departamentosText: '',
        permissions: normalizePermissions(UserRole.LIDER),
    });

    const selectedLeader = useMemo(
        () => usersFromFirestore.find((user) => user.id === userId) || null,
        [usersFromFirestore, userId],
    );

    useEffect(() => {
        if (!selectedLeader) {
            return;
        }

        setFormData({
            nome: selectedLeader.nome || '',
            email: selectedLeader.email || '',
            telefone: selectedLeader.telefone || '',
            telegram_chat_id: selectedLeader.telegram_chat_id || '',
            departamentosText: Array.isArray(selectedLeader.departamentos)
                ? selectedLeader.departamentos.join(', ')
                : '',
            permissions: normalizePermissions(UserRole.LIDER, selectedLeader.permissions),
        });
    }, [selectedLeader]);

    const handleSave = async () => {
        if (!selectedLeader) {
            addNotification('Lider nao encontrado.', 'error');
            return;
        }

        const nome = formData.nome.trim();
        const email = formData.email.trim().toLowerCase();

        if (!nome || !email) {
            addNotification('Preencha nome e e-mail.', 'error');
            return;
        }

        if (!isFirebaseConfigured || !db) {
            addNotification('Firebase nao configurado para salvar alteracoes.', 'error');
            return;
        }

        setSaving(true);
        try {
            await setDoc(doc(db, 'users', selectedLeader.id), {
                nome,
                email,
                telefone: formData.telefone.trim() || null,
                telegram_chat_id: formData.telegram_chat_id.trim() || null,
                role: UserRole.LIDER,
                departamentos: parseDepartamentos(formData.departamentosText),
                permissions: normalizePermissions(UserRole.LIDER, formData.permissions),
            }, { merge: true });

            addNotification('Lider atualizado com sucesso.', 'success');
            navigate('/admin');
        } catch (error) {
            addNotification(`Erro ao salvar lider: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!selectedLeader) {
        return (
            <AppLayout pageTitle="Editar Lider">
                <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                    Lider nao encontrado. Volte para Gerenciamento e tente novamente.
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout pageTitle="Editar Lider">
            <div className="mx-auto max-w-4xl animate-fadeIn space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ambiente dedicado</p>
                            <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-slate-900">
                                <UserCog size={20} /> Editar Lider
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">Edicao separada para evitar confusao na tela principal de Gerenciamento.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/admin')}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <ArrowLeft size={16} /> Voltar ao Gerenciamento
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <input
                            type="text"
                            placeholder="Nome"
                            value={formData.nome}
                            onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                            className="input"
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                            className="input"
                        />
                        <input
                            type="tel"
                            placeholder="Telefone"
                            value={formData.telefone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                            className="input"
                        />
                        <input
                            type="text"
                            placeholder="Telegram Chat ID"
                            value={formData.telegram_chat_id}
                            onChange={(e) => setFormData((prev) => ({ ...prev, telegram_chat_id: e.target.value.replace(/\D/g, '') }))}
                            className="input"
                        />
                    </div>

                    <div className="mt-3">
                        <input
                            type="text"
                            placeholder="Departamentos (separados por virgula)"
                            value={formData.departamentosText}
                            onChange={(e) => setFormData((prev) => ({ ...prev, departamentosText: e.target.value }))}
                            className="input"
                        />
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="font-semibold text-slate-900">Permissoes do lider</h3>
                                <p className="mt-1 text-xs text-slate-500">Ative ou desative as permissoes disponiveis no sistema.</p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {PERMISSION_DEFINITIONS.map((permission) => {
                                const enabled = Boolean(formData.permissions?.[permission.key]);
                                return (
                                    <label
                                        key={permission.key}
                                        className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${enabled ? 'border-slate-900/20 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={(e) => setFormData((prev) => ({
                                                ...prev,
                                                permissions: {
                                                    ...prev.permissions,
                                                    [permission.key]: e.target.checked,
                                                },
                                            }))}
                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-slate-900">{permission.label}</span>
                                            <span className="mt-0.5 block text-xs text-slate-500">{permission.description}</span>
                                            <span className="mt-1 block text-[11px] text-slate-400">{permission.key}</span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar alteracoes'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/admin')}
                            className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
