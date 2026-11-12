import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Save, UserCog, Building2, ShieldCheck, Check, RotateCcw
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import AppLayout from '../../components/Layout/AppLayout';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { db, isFirebaseConfigured } from '../../services/firebase';
import { UserRole } from '../../models/User';
import { getDefaultPermissions, normalizePermissions, PERMISSION_DEFINITIONS } from '../../services/permissions';

const PERMISSION_CATEGORY_GROUPS = [
    {
        id: 'SI',
        title: 'Solicitações Internas (SI)',
        subtitle: 'Criação, edição, finalização e aprovações no Kanban',
        categories: ['SI'],
    },
    {
        id: 'Auditorias',
        title: 'Auditorias 5S',
        subtitle: 'Visualização, aplicação e gerenciamento de auditorias',
        categories: ['Auditorias'],
    },
    {
        id: 'Reuniões',
        title: 'Reuniões & Pautas',
        subtitle: 'Acesso ao calendário e gestão de atas de reunião',
        categories: ['Reuniões'],
    },
    {
        id: 'Modulos',
        title: 'Administração & Módulos',
        subtitle: 'Gerenciamento do sistema, indicadores, treinamentos e investimentos',
        categories: ['Admin', 'Indicadores', 'Treinamentos', 'Investimentos'],
    },
];

function parseDepartamentos(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export default function EditLeader() {
    const navigate = useNavigate();
    const { userId } = useParams();
    const { usersFromFirestore, availableDepartments } = useUsers();
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

    const sortedDepartments = useMemo(
        () => availableDepartments.filter((dep) => dep !== 'Teste').sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [availableDepartments],
    );

    const selectedDepartmentsList = useMemo(
        () => parseDepartamentos(formData.departamentosText),
        [formData.departamentosText],
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

    const toggleDepartment = (dept) => {
        const current = parseDepartamentos(formData.departamentosText);
        const exists = current.some((item) => item.toLowerCase() === dept.toLowerCase());
        const next = exists
            ? current.filter((item) => item.toLowerCase() !== dept.toLowerCase())
            : [...current, dept];
        setFormData((prev) => ({
            ...prev,
            departamentosText: next.join(', '),
        }));
    };

    const handleSave = async () => {
        if (!selectedLeader) {
            addNotification('Líder não encontrado.', 'error');
            return;
        }

        const nome = formData.nome.trim();
        const email = formData.email.trim().toLowerCase();

        if (!nome || !email) {
            addNotification('Preencha nome e e-mail.', 'error');
            return;
        }

        if (!isFirebaseConfigured || !db) {
            addNotification('Firebase não configurado para salvar alterações.', 'error');
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

            addNotification('Líder atualizado com sucesso.', 'success');
            navigate('/admin/usuarios');
        } catch (error) {
            addNotification(`Erro ao salvar líder: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!selectedLeader) {
        return (
            <AppLayout pageTitle="Editar Líder">
                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-xs text-slate-600 shadow-sm">
                    Líder não encontrado. Volte para Gerenciamento e tente novamente.
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout pageTitle="Editar Líder">
            <div className="mx-auto max-w-7xl animate-fadeIn space-y-4">
                {/* Header Container Compacto */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-hotel-blue text-white shadow-sm">
                                <UserCog size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="font-heading text-lg font-extrabold text-slate-900">
                                        Editar Líder: {selectedLeader.nome}
                                    </h1>
                                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                        Líder
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Ajuste os dados de contato, setores vinculados e permissões operacionais.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/usuarios')}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                <ArrowLeft size={14} /> Voltar para Usuários
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-hotel-blue px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-60"
                            >
                                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Layout em 2 Colunas de Containers */}
                <div className="grid gap-4 lg:grid-cols-12 items-start">
                    {/* Coluna Esquerda (4 cols): Dados Cadastrais */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5 lg:col-span-4">
                        <div className="border-b border-slate-100 pb-2.5">
                            <h2 className="font-heading text-sm font-bold text-slate-900">Dados Cadastrais</h2>
                            <p className="text-[11px] text-slate-500">Informações básicas e contato do líder.</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Nome Completo
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    E-mail
                                </label>
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={formData.email}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Telefone
                                </label>
                                <input
                                    type="tel"
                                    placeholder="(82) 99999-9999"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Telegram Chat ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 123456789"
                                    value={formData.telegram_chat_id}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, telegram_chat_id: e.target.value.replace(/\D/g, '') }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Coluna Direita (8 cols): Departamentos + Permissões */}
                    <div className="space-y-4 lg:col-span-8">
                        {/* Container: Departamentos Vinculados */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="flex items-center gap-1.5 font-heading text-sm font-bold text-slate-900">
                                        <Building2 size={15} className="text-slate-400" />
                                        Setores Vinculados
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Selecione os departamentos sob responsabilidade deste líder.
                                    </p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                                    {selectedDepartmentsList.length} selecionado(s)
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {sortedDepartments.map((dept) => {
                                    const selected = selectedDepartmentsList.some(
                                        (item) => item.toLowerCase() === dept.toLowerCase(),
                                    );
                                    return (
                                        <button
                                            key={dept}
                                            type="button"
                                            onClick={() => toggleDepartment(dept)}
                                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border ${
                                                selected
                                                    ? 'border-hotel-blue bg-hotel-blue text-white'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {selected && <Check size={11} />}
                                            {dept}
                                        </button>
                                    );
                                })}
                            </div>

                            <input
                                type="text"
                                placeholder="Ou digite setores separados por vírgula"
                                value={formData.departamentosText}
                                onChange={(e) => setFormData((prev) => ({ ...prev, departamentosText: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-900 focus:bg-white"
                            />
                        </div>

                        {/* Container: Permissões Agrupadas */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                <div>
                                    <h3 className="flex items-center gap-1.5 font-heading text-sm font-bold text-slate-900">
                                        <ShieldCheck size={16} className="text-slate-400" />
                                        Permissões do Líder
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Ative ou desative os acessos por módulo do sistema.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            permissions: getDefaultPermissions(UserRole.LIDER),
                                        }))
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    <RotateCcw size={11} /> Restaurar padrão
                                </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {PERMISSION_CATEGORY_GROUPS.map((group) => {
                                    const groupPerms = PERMISSION_DEFINITIONS.filter((p) =>
                                        group.categories.includes(p.category),
                                    );
                                    return (
                                        <div
                                            key={group.id}
                                            className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-2"
                                        >
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800">{group.title}</h4>
                                                <p className="text-[10px] text-slate-400">{group.subtitle}</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                {groupPerms.map((permission) => {
                                                    const enabled = Boolean(formData.permissions?.[permission.key]);
                                                    return (
                                                        <label
                                                            key={permission.key}
                                                            className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer transition-all select-none ${
                                                                enabled
                                                                    ? 'border-slate-300 bg-white shadow-2xs'
                                                                    : 'border-transparent bg-transparent hover:bg-white/60'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={enabled}
                                                                onChange={(e) =>
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        permissions: {
                                                                            ...prev.permissions,
                                                                            [permission.key]: e.target.checked,
                                                                        },
                                                                    }))
                                                                }
                                                                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                                                            />
                                                            <span className="min-w-0 leading-tight">
                                                                <span className="block text-xs font-semibold text-slate-800">
                                                                    {permission.label}
                                                                </span>
                                                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                                                    {permission.description}
                                                                </span>
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
