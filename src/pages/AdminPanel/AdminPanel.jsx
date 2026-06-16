import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff, KeyRound, ClipboardCheck, ExternalLink, Search, SlidersHorizontal, Link2, UserCog, Award, Info, X,
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
        return 'bg-slate-100 text-slate-800 border border-slate-200';
    }

    if (role === UserRole.DIRETORA) {
        return 'bg-blue-50 text-blue-700 border border-blue-150';
    }

    return 'bg-zinc-50 text-zinc-700 border border-zinc-200';
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
            <div className="mx-auto max-w-7xl animate-fadeIn space-y-6">
                {/* Header Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm"
                                aria-label="Voltar"
                            >
                                <ArrowLeft size={16} /> Voltar
                            </button>
                            <div>
                                <h1 className="font-heading text-2xl font-extrabold text-slate-900 tracking-tight">Admin Console</h1>
                                <p className="text-xs text-slate-500">Gerenciamento completo de usuários, permissões e integrações.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Estatísticas Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-300 group">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Total Usuários</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{sortedUsers.length}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500 transition-colors group-hover:bg-slate-950 group-hover:text-white">
                                <Users size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-300 group">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Administradores</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{roleStats.admin}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                                <UserCog size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-300 group">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Diretoras</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{roleStats.diretora}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                                <Award size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-300 group">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Líderes</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{roleStats.lider}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500 transition-colors group-hover:bg-slate-950 group-hover:text-white">
                                <Users size={20} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navegação de Abas */}
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setActiveSection('users')}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                            activeSection === 'users'
                                ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <UserCog size={16} /> Usuários e Permissões
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('audits')}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                            activeSection === 'audits'
                                ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <Link2 size={16} /> Links de Auditoria
                    </button>
                </div>

                {/* Banner de Sincronização */}
                <div className="flex items-start gap-3 rounded-2xl border border-amber-250 bg-amber-50/70 p-4 text-xs font-body text-amber-800 shadow-sm backdrop-blur-sm">
                    <Info size={18} className="flex-shrink-0 text-amber-600 mt-0.5" />
                    <div>
                        <span className="font-semibold block text-amber-900">Sincronização Ativa</span>
                        <p className="mt-1 text-slate-600 leading-relaxed font-medium">
                            A criação de novas contas realiza a sincronização automática entre o <strong>Firebase Auth</strong> e o <strong>Firestore</strong>. Edições e exclusões atualizam o banco de dados. A alteração de senha de contas existentes deve ser iniciada através do e-mail de redefinição.
                        </p>
                    </div>
                </div>

                {/* Seção de Usuários */}
                {activeSection === 'users' && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-bold font-heading text-slate-900">
                                    <Users size={20} className="text-slate-400" />
                                    Gerenciamento de Usuários
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Visualize, crie e edite perfis e permissões dos usuários do sistema.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowForm((v) => !v);
                                }}
                                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                                    showForm
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                        : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-sm'
                                }`}
                            >
                                {showForm ? (
                                    <>
                                        <EyeOff size={16} /> Fechar formulário
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} /> Novo Usuário
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Busca e Filtros */}
                        <div className="mb-6 grid gap-4 sm:grid-cols-2">
                            <div className="relative">
                                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    placeholder="Buscar por nome, e-mail ou departamento..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition-all duration-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                />
                            </div>
                            <div className="relative">
                                <SlidersHorizontal size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-850 shadow-sm outline-none transition-all duration-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 appearance-none"
                                >
                                    <option value="ALL">Todos os perfis (roles)</option>
                                    <option value={UserRole.ADMIN}>Admin</option>
                                    <option value={UserRole.DIRETORA}>Diretora</option>
                                    <option value={UserRole.LIDER}>Líder</option>
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Formulário Novo/Editar (Modal Overlay) */}
                        {showForm && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6 animate-fadeIn">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                        <div>
                                            <h3 className="font-heading text-lg font-bold text-slate-900">
                                                {editingId ? 'Editar Perfil de Usuário' : 'Criar Novo Usuário'}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {editingId
                                                    ? 'Altere as informações cadastrais e permissões operacionais do usuário.'
                                                    : 'Preencha os dados e configure as permissões iniciais do usuário.'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForm(false);
                                                resetForm();
                                            }}
                                            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                            title="Fechar"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Nome Completo</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Sarah Connor"
                                                value={formData.nome}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Endereço de E-mail</label>
                                            <input
                                                type="email"
                                                placeholder="Ex: sarah@hotelflow.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                            {editingId ? 'Senha (opcional)' : 'Senha de Acesso'}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder={editingId ? 'Preencha apenas se desejar redefinir localmente (mín. 6)' : 'Digite a senha inicial de acesso (mín. 6)'}
                                                value={formData.senha}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, senha: e.target.value }))}
                                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                className="rounded-xl border border-slate-200 bg-white px-4 text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
                                                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Telefone de Contato</label>
                                            <input
                                                type="tel"
                                                placeholder="Ex: (82) 99999-9999"
                                                value={formData.telefone}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Telegram Chat ID</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 123456789"
                                                value={formData.telegram_chat_id}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, telegram_chat_id: e.target.value.replace(/\D/g, '') }))}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Perfil do Usuário (Role)</label>
                                            <div className="relative">
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
                                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-sm appearance-none"
                                                >
                                                    <option value={UserRole.ADMIN}>Administrador</option>
                                                    <option value={UserRole.DIRETORA}>Diretoria</option>
                                                    <option value={UserRole.LIDER}>Líder</option>
                                                </select>
                                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Departamentos Vinculados</label>
                                            <input
                                                type="text"
                                                placeholder="Separados por vírgula (Ex: Recepção, Governança)"
                                                value={formData.departamentosText}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, departamentosText: e.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="mb-4">
                                            <h4 className="text-sm font-bold text-slate-800 font-heading uppercase tracking-wider">Permissões Operacionais</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Selecione as permissões ativas para esta conta nas áreas funcionais do sistema.
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {PERMISSION_DEFINITIONS.map((permission) => {
                                                const enabled = Boolean(formData.permissions?.[permission.key]);
                                                return (
                                                    <label
                                                        key={permission.key}
                                                        className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-all duration-200 select-none ${
                                                            enabled
                                                                ? 'border-slate-900/30 bg-slate-50/50 shadow-sm'
                                                                : 'border-slate-100 bg-slate-50/20 hover:border-slate-200'
                                                        }`}
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
                                                            className="mt-1 h-4 w-4 rounded border-slate-350 text-slate-950 focus:ring-slate-950 accent-slate-950"
                                                        />
                                                        <span className="min-w-0">
                                                            <span className={`block text-sm font-bold transition-colors ${enabled ? 'text-slate-900' : 'text-slate-700'}`}>
                                                                {permission.label}
                                                            </span>
                                                            <span className="mt-1 block text-xs text-slate-500 leading-normal">
                                                                {permission.description}
                                                            </span>
                                                            <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
                                                                {permission.key}
                                                            </span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                                        <button
                                            type="button"
                                            onClick={handleSaveUser}
                                            disabled={saving}
                                            className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-60 hover:shadow-sm"
                                        >
                                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForm(false);
                                                resetForm();
                                            }}
                                            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tabela de Usuários (Desktop) */}
                        <div className="hidden overflow-x-auto rounded-2xl border border-slate-205 bg-white lg:block shadow-sm">
                            <table className="w-full text-sm font-body border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                        <th className="px-5 py-4 text-left font-bold">Nome</th>
                                        <th className="px-5 py-4 text-left font-bold">Email</th>
                                        <th className="px-5 py-4 text-left font-bold">Perfil</th>
                                        <th className="px-5 py-4 text-left font-bold">Departamentos</th>
                                        <th className="px-5 py-4 text-left font-bold">Permissões</th>
                                        <th className="px-5 py-4 text-left font-bold">Telefone</th>
                                        <th className="px-5 py-4 text-center font-bold w-40 min-w-[150px] whitespace-nowrap">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.map((row) => (
                                        <tr key={row.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-4 font-bold text-slate-900">{row.nome}</td>
                                            <td className="px-5 py-4 text-slate-500 font-medium">{row.email}</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeClass(row.role)}`}>
                                                    {row.role === UserRole.ADMIN ? 'Admin' : row.role === UserRole.DIRETORA ? 'Diretora' : 'Líder'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500">
                                                {Array.isArray(row.departamentos) && row.departamentos.length > 0
                                                    ? row.departamentos.join(', ')
                                                    : <span className="text-slate-350">—</span>}
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500">
                                                {(() => {
                                                    const enabledPermissions = PERMISSION_DEFINITIONS.filter(
                                                        (permission) => normalizePermissions(row.role, row.permissions)[permission.key],
                                                    );

                                                    if (enabledPermissions.length === 0) {
                                                        return <span className="text-slate-350">—</span>;
                                                    }

                                                    const visible = enabledPermissions.slice(0, 2).map((permission) => permission.label);
                                                    const hiddenCount = enabledPermissions.length - visible.length;

                                                    return (
                                                        <span className="font-semibold text-slate-650">
                                                            {visible.join(', ')}
                                                            {hiddenCount > 0 && (
                                                                <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                                                    +{hiddenCount}
                                                                </span>
                                                            )}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500 font-medium">{row.telefone || <span className="text-slate-350">—</span>}</td>
                                            <td className="px-5 py-4 text-center w-40 min-w-[150px] whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditUser(row)}
                                                        className="inline-flex items-center justify-center rounded-xl bg-slate-50 p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 hover:scale-105"
                                                        title={row.role === UserRole.LIDER ? 'Editar líder em ambiente dedicado' : 'Editar'}
                                                    >
                                                        <Edit2 size={14} className="flex-shrink-0" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendPasswordReset(row.email)}
                                                        className="inline-flex items-center justify-center rounded-xl bg-slate-50 p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 hover:scale-105"
                                                        title="Enviar e-mail de redefinição de senha"
                                                        disabled={sendingResetTo === row.email}
                                                    >
                                                        <KeyRound size={14} className={`flex-shrink-0 ${sendingResetTo === row.email ? 'animate-spin' : ''}`} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteUser(row)}
                                                        className="inline-flex items-center justify-center rounded-xl bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100 hover:text-red-700 hover:scale-105"
                                                        title="Excluir Usuário"
                                                    >
                                                        <Trash2 size={14} className="flex-shrink-0" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Cards de Usuários (Mobile) */}
                        <div className="space-y-4 lg:hidden">
                            {filteredUsers.map((row) => (
                                <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{row.nome}</p>
                                            <p className="text-xs text-slate-500 font-medium truncate">{row.email}</p>
                                        </div>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getRoleBadgeClass(row.role)}`}>
                                            {row.role === UserRole.ADMIN ? 'Admin' : row.role === UserRole.DIRETORA ? 'Diretora' : 'Líder'}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                                        <p className="text-slate-600">
                                            <strong className="text-slate-800">Deptos:</strong> {Array.isArray(row.departamentos) && row.departamentos.length > 0 ? row.departamentos.join(', ') : '—'}
                                        </p>
                                        <p className="text-slate-600 leading-relaxed">
                                            <strong className="text-slate-800">Permissões:</strong> {(() => {
                                                const enabledPermissions = PERMISSION_DEFINITIONS.filter(
                                                    (permission) => normalizePermissions(row.role, row.permissions)[permission.key],
                                                );
                                                return enabledPermissions.length > 0
                                                    ? enabledPermissions.map((permission) => permission.label).join(', ')
                                                    : '—';
                                            })()}
                                        </p>
                                        {row.telefone && (
                                            <p className="text-slate-600">
                                                <strong className="text-slate-800">Telefone:</strong> {row.telefone}
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => handleEditUser(row)}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
                                        >
                                            <Edit2 size={13} /> {row.role === UserRole.LIDER ? 'Editar líder' : 'Editar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSendPasswordReset(row.email)}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                                            disabled={sendingResetTo === row.email}
                                        >
                                            <KeyRound size={13} /> Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteUser(row)}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-650 transition-all hover:bg-red-100"
                                        >
                                            <Trash2 size={13} /> Excluir
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredUsers.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500 font-medium">
                                Nenhum usuário encontrado para os filtros atuais.
                            </div>
                        )}
                    </div>
                )}

                {/* Seção de Links de Auditorias */}
                {activeSection === 'audits' && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-6">
                            <h2 className="flex items-center gap-2 text-lg font-bold font-heading text-slate-900">
                                <ClipboardCheck size={20} className="text-slate-400" />
                                Links das Auditorias
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Vincule uma planilha do Google Sheets para cada setor de auditoria. O botão "Acessar Planilha" será exibido nas respectivas páginas.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {sortedDepartments.map((department) => {
                                const savedLink = normalizeAuditLink(auditLinksByDepartment?.[department]);
                                return (
                                    <div key={department} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-all hover:border-slate-200 hover:bg-white shadow-sm flex flex-col justify-between">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">{department}</label>
                                            <input
                                                type="url"
                                                placeholder="Cole a URL do Google Sheets..."
                                                value={auditLinksByDepartment?.[department] || ''}
                                                onChange={(e) => handleAuditLinkChange(department, e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                            />
                                        </div>
                                        {savedLink && (
                                            <div className="mt-3 pt-2.5 border-t border-slate-150/40">
                                                <a
                                                    href={savedLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-slate-900"
                                                >
                                                    <ExternalLink size={13} /> Abrir planilha atual
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveAuditLinks}
                            className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 hover:shadow-sm"
                        >
                            Salvar Links de Auditoria
                        </button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
