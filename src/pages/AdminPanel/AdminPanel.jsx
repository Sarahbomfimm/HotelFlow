import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff, KeyRound, ClipboardCheck, ExternalLink, Search, SlidersHorizontal, Link2, UserCog,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { UserRole } from '../../models/User';
import { auth, db, isFirebaseConfigured } from '../../services/firebase';
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { normalizePermissions, PERMISSION_DEFINITIONS } from '../../services/permissions';
import {
    normalizeAuditLink,
    saveAuditLinks,
    subscribeAuditLinks,
} from '../../services/auditoriasStorage';

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY?.trim();

function parseDepartamentos(value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

async function createFirebaseAuthUser(email, password) {
    if (!FIREBASE_API_KEY) {
        throw new Error('VITE_FIREBASE_API_KEY não configurada.');
    }

    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true,
            }),
        },
    );

    const data = await response.json();
    if (!response.ok) {
        const code = data?.error?.message;
        if (code === 'EMAIL_EXISTS') {
            const error = new Error('Este e-mail já existe no Firebase Auth.');
            error.code = 'EMAIL_EXISTS';
            throw error;
        }
        if (code === 'WEAK_PASSWORD : Password should be at least 6 characters') {
            throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }
        throw new Error('Não foi possível criar usuário no Firebase Auth.');
    }

    return data.localId;
}

function buildEmailDocId(email) {
    return `email_${String(email || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function getRoleBadgeClass(role) {
    if (role === UserRole.ADMIN) {
        return 'bg-slate-900 text-white';
    }

    if (role === UserRole.DIRETORA) {
        return 'bg-blue-600 text-white';
    }

    return 'bg-zinc-600 text-white';
}

export default function AdminPanel() {
    const { usersFromFirestore, availableDepartments } = useUsers();
    const { addNotification } = useNotification();
    const navigate = useNavigate();

    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        senha: '',
        telefone: '',
        telegram_chat_id: '',
        role: UserRole.LIDER,
        departamentosText: '',
        permissions: normalizePermissions(UserRole.LIDER),
    });
    const [editingId, setEditingId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sendingResetTo, setSendingResetTo] = useState('');
    const [auditLinksByDepartment, setAuditLinksByDepartment] = useState({});
    const [userSearch, setUserSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [activeSection, setActiveSection] = useState('users');

    const sortedUsers = useMemo(
        () => [...usersFromFirestore].sort((a, b) => (a?.nome || '').localeCompare(b?.nome || '')),
        [usersFromFirestore],
    );

    const sortedDepartments = useMemo(
        () => availableDepartments.filter((dep) => dep !== 'Teste').sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [availableDepartments],
    );

    const filteredUsers = useMemo(() => {
        const queryText = userSearch.trim().toLowerCase();

        return sortedUsers.filter((row) => {
            if (roleFilter !== 'ALL' && row.role !== roleFilter) {
                return false;
            }

            if (!queryText) {
                return true;
            }

            const searchable = [
                row.nome,
                row.email,
                ...(Array.isArray(row.departamentos) ? row.departamentos : []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(queryText);
        });
    }, [sortedUsers, roleFilter, userSearch]);

    const roleStats = useMemo(() => ({
        admin: sortedUsers.filter((row) => row.role === UserRole.ADMIN).length,
        diretora: sortedUsers.filter((row) => row.role === UserRole.DIRETORA).length,
        lider: sortedUsers.filter((row) => row.role === UserRole.LIDER).length,
    }), [sortedUsers]);

    useEffect(() => {
        const unsubscribe = subscribeAuditLinks(
            setAuditLinksByDepartment,
            () => addNotification('Nao foi possível carregar os links das auditorias do Firestore. Usando cache local.', 'warning'),
        );

        return unsubscribe;
    }, [addNotification]);

    const handleAuditLinkChange = (department, value) => {
        setAuditLinksByDepartment((prev) => ({
            ...prev,
            [department]: value,
        }));
    };

    const handleSaveAuditLinks = async () => {
        const sanitized = sortedDepartments.reduce((acc, department) => {
            const normalized = normalizeAuditLink(auditLinksByDepartment?.[department]);
            if (normalized) {
                acc[department] = normalized;
            }
            return acc;
        }, {});

        try {
            const savedLinks = await saveAuditLinks(sanitized);
            setAuditLinksByDepartment(savedLinks);
            addNotification('Links das auditorias por departamento salvos com sucesso.', 'success');
        } catch (error) {
            addNotification(`Erro ao salvar links das auditorias: ${error.message}`, 'error');
        }
    };

    const handleSaveUser = async () => {
        const nome = formData.nome.trim();
        const email = formData.email.trim().toLowerCase();
        const senha = formData.senha.trim();

        if (!nome || !email) {
            addNotification('Preencha nome e e-mail.', 'error');
            return;
        }

        if (!editingId && senha.length < 6) {
            addNotification('Senha obrigatória com no mínimo 6 caracteres para nova conta.', 'error');
            return;
        }

        if (!isFirebaseConfigured || !db) {
            addNotification('Firebase não configurado para salvar alterações.', 'error');
            return;
        }

        setSaving(true);

        try {
            const departamentos = parseDepartamentos(formData.departamentosText);
            const userData = {
                nome,
                email,
                telefone: formData.telefone.trim() || null,
                telegram_chat_id: formData.telegram_chat_id.trim() || null,
                role: formData.role,
                departamentos,
                permissions: normalizePermissions(formData.role, formData.permissions),
            };

            if (!editingId) {
                try {
                    const uid = await createFirebaseAuthUser(email, senha);
                    await setDoc(doc(db, 'users', uid), {
                        ...userData,
                        firebaseUid: uid,
                        criado_em: new Date().toISOString(),
                    }, { merge: true });
                    addNotification('Conta criada com sucesso no Firebase Auth e Firestore!', 'success');
                } catch (createError) {
                    if (createError?.code !== 'EMAIL_EXISTS') {
                        throw createError;
                    }

                    const existingByEmail = await getDocs(
                        query(collection(db, 'users'), where('email', '==', email)),
                    );

                    const existingDocId = existingByEmail.docs[0]?.id;
                    const targetDocId = existingDocId || buildEmailDocId(email);

                    await setDoc(doc(db, 'users', targetDocId), {
                        ...userData,
                        // A conta já existe no Auth; o UID será sincronizado no próximo login desse usuário.
                        firebaseUid: existingByEmail.docs[0]?.data()?.firebaseUid || null,
                        criado_em: new Date().toISOString(),
                    }, { merge: true });

                    addNotification('E-mail já existia no Auth. Perfil foi recriado no Firestore com sucesso!', 'success');
                    addNotification('Se necessário, use redefinição de senha para recuperar o acesso dessa conta.', 'info');
                }
            } else {
                await setDoc(doc(db, 'users', editingId), userData, { merge: true });
                addNotification('Usuário atualizado com sucesso no Firestore!', 'success');
            }

            resetForm();
            setShowForm(false);
        } catch (error) {
            addNotification(`Erro ao salvar: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (selectedUser) => {
        const userName = selectedUser?.nome || 'este usuário';
        if (!window.confirm(`Tem certeza que deseja deletar ${userName} do Firestore?`)) return;

        try {
            if (isFirebaseConfigured && db) {
                const email = String(selectedUser?.email || '').trim().toLowerCase();
                const docIds = new Set([selectedUser?.id].filter(Boolean));

                if (email) {
                    const usersByEmailSnapshot = await getDocs(
                        query(collection(db, 'users'), where('email', '==', email)),
                    );
                    usersByEmailSnapshot.docs.forEach((snapshotDoc) => docIds.add(snapshotDoc.id));
                }

                await Promise.all(
                    Array.from(docIds).map((docId) => deleteDoc(doc(db, 'users', docId))),
                );
            }
            addNotification(`${userName} foi removido do Firestore.`, 'success');
            addNotification('Observação: conta do Firebase Auth deve ser removida no console/admin SDK.', 'info');
        } catch (error) {
            addNotification(`Erro ao deletar: ${error.message}`, 'error');
        }
    };

    const handleSendPasswordReset = async (email) => {
        if (!auth) {
            addNotification('Auth não está disponível para enviar redefinição de senha.', 'error');
            return;
        }

        setSendingResetTo(email);
        try {
            await sendPasswordResetEmail(auth, email);
            addNotification(`E-mail de redefinição enviado para ${email}.`, 'success');
        } catch (error) {
            addNotification(`Erro ao enviar redefinição: ${error.message}`, 'error');
        } finally {
            setSendingResetTo('');
        }
    };

    const resetForm = () => {
        setFormData({
            nome: '',
            email: '',
            senha: '',
            telefone: '',
            telegram_chat_id: '',
            role: UserRole.LIDER,
            departamentosText: '',
            permissions: normalizePermissions(UserRole.LIDER),
        });
        setEditingId(null);
        setShowPassword(false);
    };

    const handleEditUser = (user) => {
        if (user?.role === UserRole.LIDER) {
            navigate(`/admin/lideres/${user.id}/editar`);
            return;
        }

        setFormData({
            nome: user.nome || '',
            email: user.email || '',
            senha: '',
            telefone: user.telefone || '',
            telegram_chat_id: user.telegram_chat_id || '',
            role: user.role || UserRole.LIDER,
            departamentosText: Array.isArray(user.departamentos) ? user.departamentos.join(', ') : '',
            permissions: normalizePermissions(user.role || UserRole.LIDER, user.permissions),
        });
        setEditingId(user.id);
        setShowForm(true);
    };

    return (
        <AppLayout pageTitle="Painel Administrativo">
            <div className="mx-auto max-w-7xl animate-fadeIn">
                <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                aria-label="Voltar"
                            >
                                <ArrowLeft size={16} /> Voltar
                            </button>
                            <div>
                                <h1 className="font-heading text-xl font-bold text-slate-900">Admin Console</h1>
                                <p className="text-xs text-slate-500">Gerenciamento de usuários, permissões e integrações.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
                                <p className="text-sm font-bold text-slate-900">{sortedUsers.length}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Admin</p>
                                <p className="text-sm font-bold text-slate-900">{roleStats.admin}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Diretora</p>
                                <p className="text-sm font-bold text-slate-900">{roleStats.diretora}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Líder</p>
                                <p className="text-sm font-bold text-slate-900">{roleStats.lider}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
                        <button
                            type="button"
                            onClick={() => setActiveSection('users')}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                activeSection === 'users'
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <UserCog size={13} /> Usuários e Permissões
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSection('audits')}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                activeSection === 'audits'
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <Link2 size={13} /> Links de Auditoria
                        </button>
                    </div>
                </div>

                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-body text-amber-800">
                    Criação de conta já sincroniza Firebase Auth + Firestore. Edição/deleção sincroniza Firestore.
                    Alteração de senha para contas existentes é feita por e-mail de redefinição.
                </div>

                {activeSection === 'users' && (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-2 text-sm font-semibold font-body text-slate-800">
                                <Users size={17} /> Usuários ({filteredUsers.length}{filteredUsers.length !== sortedUsers.length ? ` de ${sortedUsers.length}` : ''})
                            </p>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowForm((v) => !v);
                                }}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold font-body text-white transition-colors hover:bg-slate-700"
                            >
                                <Plus size={18} /> {showForm ? 'Fechar formulário' : 'Novo Usuário'}
                            </button>
                        </div>

                        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                            <label className="relative block">
                                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    placeholder="Buscar por nome, e-mail ou departamento"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="input py-2 pl-9 text-sm"
                                />
                            </label>
                            <label className="relative block">
                                <SlidersHorizontal size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="input py-2 pl-9 text-sm"
                                >
                                    <option value="ALL">Todas as roles</option>
                                    <option value={UserRole.ADMIN}>Admin</option>
                                    <option value={UserRole.DIRETORA}>Diretora</option>
                                    <option value={UserRole.LIDER}>Líder</option>
                                </select>
                            </label>
                        </div>

                        {showForm && (
                            <div className="mb-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <h3 className="font-heading font-semibold text-slate-900">
                                    {editingId ? 'Editar Usuário (Firestore)' : 'Novo Usuário (Auth + Firestore)'}
                                </h3>

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
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={editingId ? 'Nova senha (opcional, apenas para nova conta use este campo)' : 'Senha inicial (mín. 6)'}
                                        value={formData.senha}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, senha: e.target.value }))}
                                        className="input flex-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="rounded-2xl border border-slate-300 bg-white px-3 text-slate-500 shadow-sm transition-colors hover:border-slate-500 hover:text-slate-900"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
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

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <select
                                        value={formData.role}
                                        onChange={(e) => {
                                            const nextRole = e.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                role: nextRole,
                                                permissions: normalizePermissions(nextRole, prev.permissions),
                                            }));
                                        }}
                                        className="input"
                                    >
                                        <option value={UserRole.ADMIN}>Admin</option>
                                        <option value={UserRole.DIRETORA}>Diretora</option>
                                        <option value={UserRole.LIDER}>Líder</option>
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Departamentos (separados por vírgula)"
                                        value={formData.departamentosText}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, departamentosText: e.target.value }))}
                                        className="input"
                                    />
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="mb-3">
                                        <h4 className="font-semibold text-slate-900">Permissões operacionais</h4>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Use estes controles para liberar ou bloquear áreas específicas sem depender de alteração em código.
                                        </p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {PERMISSION_DEFINITIONS.map((permission) => {
                                            const enabled = Boolean(formData.permissions?.[permission.key]);
                                            return (
                                                <label key={permission.key} className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${enabled ? 'border-slate-900/20 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
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

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveUser}
                                        disabled={saving}
                                        className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold font-body text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
                                    >
                                        {saving ? 'Salvando...' : 'Salvar'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForm(false);
                                            resetForm();
                                        }}
                                        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold font-body text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                            <table className="w-full text-sm font-body">
                                <thead className="bg-slate-900 text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Nome</th>
                                        <th className="px-4 py-3 text-left">Email</th>
                                        <th className="px-4 py-3 text-left">Role</th>
                                        <th className="px-4 py-3 text-left">Departamentos</th>
                                        <th className="px-4 py-3 text-left">Permissões</th>
                                        <th className="px-4 py-3 text-left">Telefone</th>
                                        <th className="px-4 py-3 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((row) => (
                                        <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                                            <td className="px-4 py-3 font-semibold text-slate-900">{row.nome}</td>
                                            <td className="px-4 py-3 text-slate-700">{row.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getRoleBadgeClass(row.role)}`}
                                                >
                                                    {row.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600">
                                                {Array.isArray(row.departamentos) && row.departamentos.length > 0
                                                    ? row.departamentos.join(', ')
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600">
                                                {(() => {
                                                    const enabledPermissions = PERMISSION_DEFINITIONS.filter(
                                                        (permission) => normalizePermissions(row.role, row.permissions)[permission.key],
                                                    );

                                                    if (enabledPermissions.length === 0) {
                                                        return '—';
                                                    }

                                                    const visible = enabledPermissions.slice(0, 2).map((permission) => permission.label);
                                                    const hiddenCount = enabledPermissions.length - visible.length;

                                                    return `${visible.join(', ')}${hiddenCount > 0 ? ` +${hiddenCount}` : ''}`;
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600">{row.telefone || '—'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditUser(row)}
                                                        className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                                        title={row.role === UserRole.LIDER ? 'Editar líder em ambiente dedicado' : 'Editar'}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendPasswordReset(row.email)}
                                                        className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                                                        title="Enviar redefinição de senha"
                                                        disabled={sendingResetTo === row.email}
                                                    >
                                                        <KeyRound size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteUser(row)}
                                                        className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                                                        title="Deletar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="space-y-3 lg:hidden">
                            {filteredUsers.map((row) => (
                                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{row.nome}</p>
                                            <p className="text-xs text-slate-500">{row.email}</p>
                                        </div>
                                        <span className={`inline-block rounded px-2 py-1 text-[11px] font-semibold ${getRoleBadgeClass(row.role)}`}
                                        >
                                            {row.role}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        <strong>Deptos:</strong> {Array.isArray(row.departamentos) && row.departamentos.length > 0 ? row.departamentos.join(', ') : '—'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        <strong>Permissões:</strong> {PERMISSION_DEFINITIONS.filter((permission) => normalizePermissions(row.role, row.permissions)[permission.key])
                                            .map((permission) => permission.label)
                                            .join(', ') || '—'}
                                    </p>
                                    <div className="mt-3 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEditUser(row)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                                        >
                                            <Edit2 size={13} /> {row.role === UserRole.LIDER ? 'Editar líder' : 'Editar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSendPasswordReset(row.email)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                                            disabled={sendingResetTo === row.email}
                                        >
                                            <KeyRound size={13} /> Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteUser(row)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700"
                                        >
                                            <Trash2 size={13} /> Excluir
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredUsers.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                Nenhum usuário encontrado para os filtros atuais.
                            </div>
                        )}
                    </div>
                )}

                {activeSection === 'audits' && (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                        <div className="mb-4 flex flex-col gap-2">
                            <p className="flex items-center gap-2 text-sm font-semibold font-body text-slate-900">
                                <ClipboardCheck size={17} /> Links das Auditorias
                            </p>
                            <p className="text-xs text-slate-500 font-body">
                                Configure o link do Google Sheets por setor. O botão "Acessar Auditoria" será exibido automaticamente após salvar.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {sortedDepartments.map((department) => {
                                const savedLink = normalizeAuditLink(auditLinksByDepartment?.[department]);
                                return (
                                    <div key={department} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <label className="label mb-2 block">{department}</label>
                                        <input
                                            type="url"
                                            placeholder="Cole o link do Google Sheets"
                                            value={auditLinksByDepartment?.[department] || ''}
                                            onChange={(e) => handleAuditLinkChange(department, e.target.value)}
                                            className="input"
                                        />
                                        {savedLink && (
                                            <a
                                                href={savedLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
                                            >
                                                <ExternalLink size={13} /> Abrir link atual
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveAuditLinks}
                            className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold font-body text-white transition-colors hover:bg-slate-700"
                        >
                            Salvar links
                        </button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
