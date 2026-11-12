import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Users, ArrowLeft, Trash2, Eye, EyeOff, KeyRound, ClipboardCheck,
    ExternalLink, Search, UserCog,
    UserPlus, Check, Building2, ChevronRight, Save, RotateCcw
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { UserRole } from '../../models/User';
import { auth, db, isFirebaseConfigured } from '../../services/firebase';
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getDefaultPermissions, normalizePermissions, PERMISSION_DEFINITIONS } from '../../services/permissions';
import {
    normalizeAuditLink,
    saveAuditLinks,
    subscribeAuditLinks,
} from '../../services/auditoriasStorage';

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY?.trim();

function parseDepartamentos(value) {
    return String(value || '')
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
        return 'bg-slate-900 text-white border border-slate-900';
    }

    if (role === UserRole.DIRETORA) {
        return 'bg-amber-50 text-amber-800 border border-amber-200';
    }

    return 'bg-blue-50 text-blue-700 border border-blue-200';
}

function isBernardinoRow(row) {
    return (
        row?.email?.toLowerCase() === 'bernadino@hotelflow.com' ||
        row?.nome?.toLowerCase() === 'bernardino' ||
        row?.nome?.toLowerCase() === 'bernadino'
    );
}

function getRoleDisplayLabel(row) {
    if (isBernardinoRow(row)) return 'Diretoria';
    if (row?.role === UserRole.ADMIN) return 'Admin';
    if (row?.role === UserRole.DIRETORA) return 'Diretoria';
    return 'Líder';
}

export default function AdminPanel() {
    const { usersFromFirestore, availableDepartments } = useUsers();
    const { addNotification } = useNotification();
    const navigate = useNavigate();
    const { section, itemId } = useParams();

    // Estado para formulário de edição (página individual do usuário) ou criação (página Novo Usuário)
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
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sendingResetTo, setSendingResetTo] = useState('');

    // Busca e filtro na página de lista de usuários
    const [userSearch, setUserSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');

    // Estado de links de auditoria e busca de setores
    const [auditLinksByDepartment, setAuditLinksByDepartment] = useState({});
    const [auditSearch, setAuditSearch] = useState('');
    const [sectorLinkInput, setSectorLinkInput] = useState('');
    const [savingSectorLink, setSavingSectorLink] = useState(false);

    const sortedUsers = useMemo(
        () => [...usersFromFirestore].sort((a, b) => (a?.nome || '').localeCompare(b?.nome || '', 'pt-BR')),
        [usersFromFirestore],
    );

    const sortedDepartments = useMemo(
        () => availableDepartments.filter((dep) => dep !== 'Teste').sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [availableDepartments],
    );

    // Usuário selecionado quando estamos em /admin/usuarios/:itemId
    const selectedUser = useMemo(() => {
        if (section !== 'usuarios' || !itemId) return null;
        return sortedUsers.find((u) => u.id === itemId) || null;
    }, [section, itemId, sortedUsers]);

    // Setor selecionado quando estamos em /admin/auditorias/:itemId
    const selectedDepartment = useMemo(() => {
        if (section !== 'auditorias' || !itemId) return null;
        const decoded = decodeURIComponent(itemId);
        return sortedDepartments.find((dep) => dep.toLowerCase() === decoded.toLowerCase()) || decoded;
    }, [section, itemId, sortedDepartments]);

    // Se a URL estiver em uma sub-rota antiga/inválida (ex: /admin/permissoes), redireciona para /admin
    useEffect(() => {
        if (section && !['usuarios', 'novo', 'auditorias'].includes(section)) {
            navigate('/admin', { replace: true });
        }
    }, [section, navigate]);

    // Sincroniza dados do formulário quando abre a página de um usuário (/admin/usuarios/:itemId) ou a página de Novo Usuário (/admin/novo)
    useEffect(() => {
        if (section === 'usuarios' && selectedUser) {
            setFormData({
                nome: selectedUser.nome || '',
                email: selectedUser.email || '',
                senha: '',
                telefone: selectedUser.telefone || '',
                telegram_chat_id: selectedUser.telegram_chat_id || '',
                role: selectedUser.role || UserRole.LIDER,
                departamentosText: Array.isArray(selectedUser.departamentos)
                    ? selectedUser.departamentos.join(', ')
                    : '',
                permissions: normalizePermissions(
                    selectedUser.role || UserRole.LIDER,
                    selectedUser.permissions,
                ),
            });
            setShowPassword(false);
        } else if (section === 'novo') {
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
            setShowPassword(false);
        }
    }, [section, selectedUser]);

    // Assina links de auditoria do Firestore
    useEffect(() => {
        const unsubscribe = subscribeAuditLinks(
            setAuditLinksByDepartment,
            () => addNotification('Não foi possível carregar os links das auditorias do Firestore. Usando cache local.', 'warning'),
        );

        return unsubscribe;
    }, [addNotification]);

    // Atualiza o input do setor quando abre a página individual de um setor
    useEffect(() => {
        if (selectedDepartment) {
            setSectorLinkInput(auditLinksByDepartment?.[selectedDepartment] || '');
        }
    }, [selectedDepartment, auditLinksByDepartment]);

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
                row.telefone,
                ...(Array.isArray(row.departamentos) ? row.departamentos : []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(queryText);
        });
    }, [sortedUsers, roleFilter, userSearch]);

    const filteredDepartments = useMemo(() => {
        const q = auditSearch.trim().toLowerCase();
        if (!q) return sortedDepartments;
        return sortedDepartments.filter((dep) => dep.toLowerCase().includes(q));
    }, [sortedDepartments, auditSearch]);

    const configuredAuditCount = useMemo(
        () => sortedDepartments.filter((dep) => Boolean(normalizeAuditLink(auditLinksByDepartment?.[dep]))).length,
        [sortedDepartments, auditLinksByDepartment],
    );

    const formDepartmentsList = useMemo(
        () => parseDepartamentos(formData.departamentosText),
        [formData.departamentosText],
    );

    const toggleFormDepartment = (dept) => {
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

    const handleSaveNewUser = async () => {
        const nome = formData.nome.trim();
        const email = formData.email.trim().toLowerCase();
        const senha = formData.senha.trim();

        if (!nome || !email) {
            addNotification('Preencha nome e e-mail.', 'error');
            return;
        }

        if (senha.length < 6) {
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
                    firebaseUid: existingByEmail.docs[0]?.data()?.firebaseUid || null,
                    criado_em: new Date().toISOString(),
                }, { merge: true });

                addNotification('E-mail já existia no Auth. Perfil foi recriado no Firestore com sucesso!', 'success');
                addNotification('Se necessário, use redefinição de senha para recuperar o acesso dessa conta.', 'info');
            }

            if (email && isFirebaseConfigured && db) {
                try {
                    await deleteDoc(doc(db, 'deleted_users', email));
                } catch {
                    // ignore
                }
            }
            if (email) {
                try {
                    const stored = JSON.parse(localStorage.getItem('hotelflow:deleted_user_emails') || '[]');
                    const updated = stored.filter((e) => e.toLowerCase() !== email.toLowerCase());
                    localStorage.setItem('hotelflow:deleted_user_emails', JSON.stringify(updated));
                } catch {
                    // ignore
                }
            }

            navigate('/admin/usuarios');
        } catch (error) {
            addNotification(`Erro ao criar usuário: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateExistingUser = async () => {
        if (!selectedUser) return;
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

            await setDoc(doc(db, 'users', selectedUser.id), userData, { merge: true });
            addNotification('Dados do usuário atualizados com sucesso!', 'success');
            navigate('/admin/usuarios');
        } catch (error) {
            addNotification(`Erro ao atualizar usuário: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (targetUser) => {
        const userName = targetUser?.nome || 'este usuário';
        if (!window.confirm(`Tem certeza que deseja deletar ${userName}?`)) return;

        try {
            const email = String(targetUser?.email || '').trim().toLowerCase();

            if (isFirebaseConfigured && db) {
                const docIds = new Set([targetUser?.id].filter(Boolean));

                if (email) {
                    const usersByEmailSnapshot = await getDocs(
                        query(collection(db, 'users'), where('email', '==', email)),
                    );
                    usersByEmailSnapshot.docs.forEach((snapshotDoc) => docIds.add(snapshotDoc.id));

                    await setDoc(doc(db, 'deleted_users', email), {
                        email,
                        deletedAt: new Date().toISOString(),
                    });
                }

                await Promise.all(
                    Array.from(docIds).map((docId) => deleteDoc(doc(db, 'users', docId))),
                );
            }

            if (email) {
                try {
                    const stored = JSON.parse(localStorage.getItem('hotelflow:deleted_user_emails') || '[]');
                    if (!stored.includes(email)) {
                        stored.push(email);
                        localStorage.setItem('hotelflow:deleted_user_emails', JSON.stringify(stored));
                    }
                } catch {
                    // ignore
                }
            }

            addNotification(`${userName} foi removido com sucesso.`, 'success');
            navigate('/admin/usuarios');
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

    const handleSaveSingleSectorLink = async () => {
        if (!selectedDepartment) return;

        const updatedMap = {
            ...auditLinksByDepartment,
            [selectedDepartment]: sectorLinkInput,
        };

        const sanitized = sortedDepartments.reduce((acc, department) => {
            const normalized = normalizeAuditLink(updatedMap?.[department]);
            if (normalized) {
                acc[department] = normalized;
            }
            return acc;
        }, {});

        setSavingSectorLink(true);
        try {
            const savedLinks = await saveAuditLinks(sanitized);
            setAuditLinksByDepartment(savedLinks);
            addNotification(`Link de auditoria do setor "${selectedDepartment}" salvo com sucesso!`, 'success');
        } catch (error) {
            addNotification(`Erro ao salvar link: ${error.message}`, 'error');
        } finally {
            setSavingSectorLink(false);
        }
    };

    // =========================================================================
    // TELA 0: PÁGINA INICIAL DO GERENCIAMENTO (/admin) — 3 DIVS/BOTÕES
    // =========================================================================
    if (!section || !['usuarios', 'novo', 'auditorias'].includes(section)) {
        return (
            <AppLayout pageTitle="Gerenciamento">
                <div className="mx-auto max-w-5xl animate-fadeIn space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-3.5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hotel-blue text-white shadow-sm">
                                <UserCog size={24} />
                            </div>
                            <div>
                                <h1 className="font-heading text-2xl font-extrabold text-slate-900 tracking-tight">
                                    Gerenciamento
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Selecione abaixo a área administrativa que deseja acessar.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* As 3 Divs / Botões de Navegação */}
                    <div className="grid gap-5 md:grid-cols-3">
                        {/* 1. Usuários */}
                        <button
                            type="button"
                            onClick={() => navigate('/admin/usuarios')}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-hotel-blue hover:shadow-lg"
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-hotel-blue transition-colors group-hover:bg-hotel-blue group-hover:text-white">
                                        <Users size={24} />
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                        {sortedUsers.length} contas
                                    </span>
                                </div>
                                <div>
                                    <h2 className="font-heading text-lg font-bold text-slate-900 group-hover:text-hotel-blue transition-colors">
                                        Usuários
                                    </h2>
                                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                                        Visualize a lista completa de usuários cadastrados e clique em qualquer perfil para editar seus dados e permissões.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-hotel-blue">
                                <span>Acessar lista de usuários</span>
                                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                            </div>
                        </button>

                        {/* 2. Novo Usuário */}
                        <button
                            type="button"
                            onClick={() => navigate('/admin/novo')}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-hotel-blue hover:shadow-lg"
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-hotel-blue transition-colors group-hover:bg-hotel-blue group-hover:text-white">
                                        <UserPlus size={24} />
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                        Cadastro
                                    </span>
                                </div>
                                <div>
                                    <h2 className="font-heading text-lg font-bold text-slate-900 group-hover:text-hotel-blue transition-colors">
                                        Novo Usuário
                                    </h2>
                                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                                        Crie uma nova conta de acesso sincronizada com o banco de dados, definindo setores e permissões iniciais.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-hotel-blue">
                                <span>Cadastrar novo usuário</span>
                                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                            </div>
                        </button>

                        {/* 3. Gerenciamento de Auditorias */}
                        <button
                            type="button"
                            onClick={() => navigate('/admin/auditorias')}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-hotel-blue hover:shadow-lg"
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-hotel-blue transition-colors group-hover:bg-hotel-blue group-hover:text-white">
                                        <ClipboardCheck size={24} />
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                        {configuredAuditCount}/{sortedDepartments.length} setores
                                    </span>
                                </div>
                                <div>
                                    <h2 className="font-heading text-lg font-bold text-slate-900 group-hover:text-hotel-blue transition-colors">
                                        Gerenciamento de Auditorias
                                    </h2>
                                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                                        Consulte a lista de todos os setores do hotel e clique no setor desejado para configurar o link da planilha de auditoria.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-hotel-blue">
                                <span>Gerenciar setores e links</span>
                                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                            </div>
                        </button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // =========================================================================
    // TELA 1A: LISTA DE USUÁRIOS (/admin/usuarios)
    // =========================================================================
    if (section === 'usuarios' && !itemId) {
        return (
            <AppLayout pageTitle="Usuários">
                <div className="mx-auto max-w-5xl animate-fadeIn space-y-5">
                    {/* Cabeçalho com botão Voltar */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <ArrowLeft size={15} /> Voltar
                                </button>
                                <div>
                                    <h1 className="font-heading text-xl font-extrabold text-slate-900">
                                        Usuários Cadastrados
                                    </h1>
                                    <p className="text-xs text-slate-500">
                                        Clique em qualquer usuário abaixo para abrir sua página e editar seus dados.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate('/admin/novo')}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-hotel-blue px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800"
                            >
                                <UserPlus size={15} /> Novo Usuário
                            </button>
                        </div>

                        {/* Busca e Filtro por Perfil */}
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center border-t border-slate-100 pt-4">
                            <div className="relative flex-1">
                                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    placeholder="Buscar usuário por nome, e-mail ou setor..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs text-slate-800 outline-none transition-all focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                {[
                                    { key: 'ALL', label: 'Todos' },
                                    { key: UserRole.ADMIN, label: 'Admin' },
                                    { key: UserRole.DIRETORA, label: 'Diretoria' },
                                    { key: UserRole.LIDER, label: 'Líderes' },
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setRoleFilter(tab.key)}
                                        className={`rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
                                            roleFilter === tab.key
                                                ? 'border-slate-900 bg-slate-900 text-white'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Lista de Usuários (Clicável para abrir outra página) */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
                        {filteredUsers.map((row) => {
                            const deps = Array.isArray(row.departamentos) ? row.departamentos : [];
                            return (
                                <button
                                    key={row.id}
                                    type="button"
                                    onClick={() => navigate(`/admin/usuarios/${row.id}`)}
                                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 group"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 font-heading text-sm font-bold text-slate-700 border border-slate-200 group-hover:bg-hotel-blue group-hover:text-white group-hover:border-hotel-blue transition-colors">
                                            {row.nome?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-bold text-slate-900 truncate">
                                                    {row.nome}
                                                </p>
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isBernardinoRow(row) ? getRoleBadgeClass(UserRole.DIRETORA) : getRoleBadgeClass(row.role)}`}>
                                                    {getRoleDisplayLabel(row)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                                {row.email}
                                                {deps.length > 0 ? ` • ${deps.join(', ')}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0 text-xs font-bold text-slate-400 group-hover:text-hotel-blue">
                                        <span className="hidden sm:inline">Ver dados</span>
                                        <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                </button>
                            );
                        })}

                        {filteredUsers.length === 0 && (
                            <div className="px-6 py-10 text-center text-sm text-slate-500">
                                Nenhum usuário encontrado para a busca atual.
                            </div>
                        )}
                    </div>
                </div>
            </AppLayout>
        );
    }

    // =========================================================================
    // TELA 1B: PÁGINA INDIVIDUAL DE DADOS DO USUÁRIO (/admin/usuarios/:itemId)
    // =========================================================================
    if (section === 'usuarios' && itemId) {
        if (!selectedUser) {
            return (
                <AppLayout pageTitle="Dados do Usuário">
                    <div className="mx-auto max-w-4xl animate-fadeIn space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                            <p className="text-sm text-slate-600">Usuário não encontrado.</p>
                            <button
                                type="button"
                                onClick={() => navigate('/admin/usuarios')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                <ArrowLeft size={15} /> Voltar para Usuários
                            </button>
                        </div>
                    </div>
                </AppLayout>
            );
        }

        return (
            <AppLayout pageTitle={`Usuário: ${selectedUser.nome}`}>
                <div className="mx-auto max-w-4xl animate-fadeIn space-y-5">
                    {/* Cabeçalho da Página do Usuário */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/usuarios')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <ArrowLeft size={15} /> Voltar para Usuários
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="font-heading text-xl font-extrabold text-slate-900">
                                            {selectedUser.nome}
                                        </h1>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isBernardinoRow(selectedUser) ? getRoleBadgeClass(UserRole.DIRETORA) : getRoleBadgeClass(selectedUser.role)}`}>
                                            {getRoleDisplayLabel(selectedUser)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSendPasswordReset(selectedUser.email)}
                                    disabled={sendingResetTo === selectedUser.email}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <KeyRound size={14} /> Redefinir Senha por E-mail
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteUser(selectedUser)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                                >
                                    <Trash2 size={14} /> Excluir Conta
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Dados Cadastrais do Usuário */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                        <div className="border-b border-slate-100 pb-3">
                            <h2 className="font-heading text-base font-bold text-slate-900">
                                Dados Cadastrais
                            </h2>
                            <p className="text-xs text-slate-500">
                                Altere as informações pessoais, de contato e perfil desta conta.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Nome Completo
                                </label>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    E-mail
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Perfil do Usuário
                                </label>
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
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                >
                                    <option value={UserRole.LIDER}>Líder</option>
                                    <option value={UserRole.DIRETORA}>Diretoria</option>
                                    <option value={UserRole.ADMIN}>Administrador</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Telefone
                                </label>
                                <input
                                    type="tel"
                                    placeholder="(82) 99999-9999"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Telegram Chat ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 123456789"
                                    value={formData.telegram_chat_id}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, telegram_chat_id: e.target.value.replace(/\D/g, '') }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* Setores Vinculados */}
                        <div className="border-t border-slate-100 pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Setores Vinculados</h3>
                                    <p className="text-xs text-slate-500">Clique nos setores para vincular ou remover do usuário.</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                                    {formDepartmentsList.length} selecionado(s)
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {sortedDepartments.map((dept) => {
                                    const selected = formDepartmentsList.some(
                                        (item) => item.toLowerCase() === dept.toLowerCase(),
                                    );
                                    return (
                                        <button
                                            key={dept}
                                            type="button"
                                            onClick={() => toggleFormDepartment(dept)}
                                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border ${
                                                selected
                                                    ? 'border-hotel-blue bg-hotel-blue text-white'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {selected && <Check size={12} />}
                                            {dept}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Permissões do Usuário */}
                        <div className="border-t border-slate-100 pt-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Permissões de Acesso</h3>
                                    <p className="text-xs text-slate-500">Defina o que este usuário pode acessar e operar no sistema.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            permissions: getDefaultPermissions(prev.role),
                                        }))
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    <RotateCcw size={12} /> Restaurar padrão do perfil
                                </button>
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-2">
                                {PERMISSION_DEFINITIONS.map((permission) => {
                                    const enabled = Boolean(formData.permissions?.[permission.key]);
                                    return (
                                        <label
                                            key={permission.key}
                                            className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-all select-none ${
                                                enabled
                                                    ? 'border-slate-900/25 bg-slate-50/80'
                                                    : 'border-slate-100 bg-white hover:border-slate-200'
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
                                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                                            />
                                            <span className="min-w-0 leading-tight">
                                                <span className="block text-xs font-bold text-slate-800">
                                                    {permission.label}
                                                </span>
                                                <span className="block text-[11px] text-slate-500 mt-0.5">
                                                    {permission.description}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/usuarios')}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdateExistingUser}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-xl bg-hotel-blue px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                            >
                                <Save size={15} />
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // =========================================================================
    // TELA 2: PÁGINA DE NOVO USUÁRIO (/admin/novo)
    // =========================================================================
    if (section === 'novo') {
        return (
            <AppLayout pageTitle="Novo Usuário">
                <div className="mx-auto max-w-4xl animate-fadeIn space-y-5">
                    {/* Cabeçalho com botão Voltar */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/admin')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900"
                            >
                                <ArrowLeft size={15} /> Voltar
                            </button>
                            <div>
                                <h1 className="font-heading text-xl font-extrabold text-slate-900">
                                    Criar Novo Usuário
                                </h1>
                                <p className="text-xs text-slate-500">
                                    Preencha os campos abaixo para cadastrar uma nova conta no sistema.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Formulário Completo de Novo Usuário */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Nome Completo *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Maria Clara"
                                    value={formData.nome}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    E-mail de Login *
                                </label>
                                <input
                                    type="email"
                                    placeholder="Ex: maria@hotelflow.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Senha de Acesso *
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Mínimo de 6 caracteres"
                                        value={formData.senha}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, senha: e.target.value }))}
                                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="rounded-xl border border-slate-200 bg-white px-3.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                        title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Perfil do Usuário (Role)
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => {
                                        const nextRole = e.target.value;
                                        setFormData((prev) => ({
                                            ...prev,
                                            role: nextRole,
                                            permissions: getDefaultPermissions(nextRole),
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                >
                                    <option value={UserRole.LIDER}>Líder</option>
                                    <option value={UserRole.DIRETORA}>Diretoria</option>
                                    <option value={UserRole.ADMIN}>Administrador</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Telefone de Contato
                                </label>
                                <input
                                    type="tel"
                                    placeholder="Ex: (82) 99999-9999"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                    Telegram Chat ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 123456789"
                                    value={formData.telegram_chat_id}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, telegram_chat_id: e.target.value.replace(/\D/g, '') }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* Seleção de Setores */}
                        <div className="border-t border-slate-100 pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Setores Vinculados</h3>
                                    <p className="text-xs text-slate-500">Selecione os setores aos quais o novo usuário pertence.</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                                    {formDepartmentsList.length} selecionado(s)
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {sortedDepartments.map((dept) => {
                                    const selected = formDepartmentsList.some(
                                        (item) => item.toLowerCase() === dept.toLowerCase(),
                                    );
                                    return (
                                        <button
                                            key={dept}
                                            type="button"
                                            onClick={() => toggleFormDepartment(dept)}
                                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border ${
                                                selected
                                                    ? 'border-hotel-blue bg-hotel-blue text-white'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {selected && <Check size={12} />}
                                            {dept}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Permissões Iniciais */}
                        <div className="border-t border-slate-100 pt-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Permissões Operacionais</h3>
                                    <p className="text-xs text-slate-500">Selecione as permissões iniciais desta conta.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            permissions: getDefaultPermissions(prev.role),
                                        }))
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    <RotateCcw size={12} /> Restaurar padrão
                                </button>
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-2">
                                {PERMISSION_DEFINITIONS.map((permission) => {
                                    const enabled = Boolean(formData.permissions?.[permission.key]);
                                    return (
                                        <label
                                            key={permission.key}
                                            className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-all select-none ${
                                                enabled
                                                    ? 'border-slate-900/25 bg-slate-50/80'
                                                    : 'border-slate-100 bg-white hover:border-slate-200'
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
                                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                                            />
                                            <span className="min-w-0 leading-tight">
                                                <span className="block text-xs font-bold text-slate-800">
                                                    {permission.label}
                                                </span>
                                                <span className="block text-[11px] text-slate-500 mt-0.5">
                                                    {permission.description}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                            <button
                                type="button"
                                onClick={() => navigate('/admin')}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNewUser}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-xl bg-hotel-blue px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                            >
                                <UserPlus size={15} />
                                {saving ? 'Criando Conta...' : 'Criar Usuário'}
                            </button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // =========================================================================
    // TELA 3A: GERENCIAMENTO DE AUDITORIAS — LISTA DE SETORES (/admin/auditorias)
    // =========================================================================
    if (section === 'auditorias' && !itemId) {
        return (
            <AppLayout pageTitle="Gerenciamento de Auditorias">
                <div className="mx-auto max-w-4xl animate-fadeIn space-y-5">
                    {/* Cabeçalho com botão Voltar */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <ArrowLeft size={15} /> Voltar
                                </button>
                                <div>
                                    <h1 className="font-heading text-xl font-extrabold text-slate-900">
                                        Gerenciamento de Auditorias
                                    </h1>
                                    <p className="text-xs text-slate-500">
                                        Clique em um setor da lista para visualizar suas informações e configurar o link da auditoria.
                                    </p>
                                </div>
                            </div>

                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                                {configuredAuditCount} de {sortedDepartments.length} com planilha
                            </span>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <div className="relative">
                                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    placeholder="Buscar setor..."
                                    value={auditSearch}
                                    onChange={(e) => setAuditSearch(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs text-slate-800 outline-none transition-all focus:border-slate-900 focus:bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Lista de Todos os Setores (Clicável para abrir a página do setor) */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
                        {filteredDepartments.map((department) => {
                            const savedLink = normalizeAuditLink(auditLinksByDepartment?.[department]);
                            const usersInDept = sortedUsers.filter(
                                (u) =>
                                    Array.isArray(u.departamentos) &&
                                    u.departamentos.some((d) => d.toLowerCase() === department.toLowerCase()),
                            );

                            return (
                                <button
                                    key={department}
                                    type="button"
                                    onClick={() => navigate(`/admin/auditorias/${encodeURIComponent(department)}`)}
                                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 group"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-hotel-blue group-hover:text-white transition-colors">
                                            <Building2 size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-bold text-slate-900 truncate">
                                                    {department}
                                                </p>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                        savedLink
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}
                                                >
                                                    {savedLink ? 'Planilha vinculada' : 'Sem planilha'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                                {usersInDept.length > 0
                                                    ? `${usersInDept.length} responsável(is): ${usersInDept.map((u) => u.nome).join(', ')}`
                                                    : 'Nenhum usuário vinculado diretamente a este setor'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0 text-xs font-bold text-slate-400 group-hover:text-hotel-blue">
                                        <span className="hidden sm:inline">Abrir setor</span>
                                        <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                </button>
                            );
                        })}

                        {filteredDepartments.length === 0 && (
                            <div className="px-6 py-10 text-center text-sm text-slate-500">
                                Nenhum setor encontrado.
                            </div>
                        )}
                    </div>
                </div>
            </AppLayout>
        );
    }

    // =========================================================================
    // TELA 3B: PÁGINA INDIVIDUAL DO SETOR (/admin/auditorias/:itemId)
    // =========================================================================
    if (section === 'auditorias' && itemId) {
        const currentSavedLink = normalizeAuditLink(auditLinksByDepartment?.[selectedDepartment]);
        const sectorUsers = sortedUsers.filter(
            (u) =>
                Array.isArray(u.departamentos) &&
                u.departamentos.some((d) => d.toLowerCase() === String(selectedDepartment).toLowerCase()),
        );

        return (
            <AppLayout pageTitle={`Setor: ${selectedDepartment}`}>
                <div className="mx-auto max-w-3xl animate-fadeIn space-y-5">
                    {/* Cabeçalho com botão Voltar */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/auditorias')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <ArrowLeft size={15} /> Voltar para Setores
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="font-heading text-xl font-extrabold text-slate-900">
                                            {selectedDepartment}
                                        </h1>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                                currentSavedLink
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            {currentSavedLink ? 'Planilha Ativa' : 'Sem Planilha'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Informações do setor e configuração do link da planilha de auditoria 5S.
                                    </p>
                                </div>
                            </div>

                            {currentSavedLink && (
                                <a
                                    href={currentSavedLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-hotel-blue hover:bg-slate-100"
                                >
                                    <ExternalLink size={14} /> Abrir Planilha Atual
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Informações do Setor + Campo do Link da Auditoria */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                        {/* Bloco de Informações do Setor */}
                        <div className="space-y-3">
                            <h2 className="font-heading text-sm font-bold text-slate-900 uppercase tracking-wider">
                                Informações do Setor
                            </h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                    <p className="text-[11px] font-bold uppercase text-slate-400">Nome do Setor</p>
                                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedDepartment}</p>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                    <p className="text-[11px] font-bold uppercase text-slate-400">Usuários Vinculados</p>
                                    <p className="mt-1 text-sm font-bold text-slate-900">
                                        {sectorUsers.length > 0
                                            ? sectorUsers.map((u) => u.nome).join(', ')
                                            : 'Nenhum usuário vinculado'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Campo do Link da Auditoria */}
                        <div className="border-t border-slate-100 pt-5 space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    Link da Planilha de Auditoria (Google Sheets)
                                </label>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Cole abaixo o endereço completo da planilha de auditoria deste setor.
                                </p>
                            </div>

                            <input
                                type="url"
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                value={sectorLinkInput}
                                onChange={(e) => setSectorLinkInput(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:bg-white"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/auditorias')}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSingleSectorLink}
                                disabled={savingSectorLink}
                                className="inline-flex items-center gap-2 rounded-xl bg-hotel-blue px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                            >
                                <Save size={15} />
                                {savingSectorLink ? 'Salvando...' : 'Salvar Link da Auditoria'}
                            </button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // Fallback: redireciona para o hub /admin
    return null;
}
