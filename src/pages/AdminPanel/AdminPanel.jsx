import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff, KeyRound,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { UserRole } from '../../models/User';
import { auth, db, isFirebaseConfigured } from '../../services/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';

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
            throw new Error('Este e-mail já existe no Firebase Auth.');
        }
        if (code === 'WEAK_PASSWORD : Password should be at least 6 characters') {
            throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }
        throw new Error('Não foi possível criar usuário no Firebase Auth.');
    }

    return data.localId;
}

export default function AdminPanel() {
    const { users } = useUsers();
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
    });
    const [editingId, setEditingId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sendingResetTo, setSendingResetTo] = useState('');

    const sortedUsers = useMemo(
        () => [...users].sort((a, b) => (a?.nome || '').localeCompare(b?.nome || '')),
        [users],
    );

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
            };

            if (!editingId) {
                const uid = await createFirebaseAuthUser(email, senha);
                await setDoc(doc(db, 'users', uid), {
                    ...userData,
                    firebaseUid: uid,
                    criado_em: new Date().toISOString(),
                }, { merge: true });
                addNotification('Conta criada com sucesso no Firebase Auth e Firestore!', 'success');
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

    const handleDeleteUser = async (userId, userName) => {
        if (!window.confirm(`Tem certeza que deseja deletar ${userName} do Firestore?`)) return;

        try {
            if (isFirebaseConfigured && db) {
                await deleteDoc(doc(db, 'users', userId));
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
        });
        setEditingId(null);
        setShowPassword(false);
    };

    const handleEditUser = (user) => {
        setFormData({
            nome: user.nome || '',
            email: user.email || '',
            senha: '',
            telefone: user.telefone || '',
            telegram_chat_id: user.telegram_chat_id || '',
            role: user.role || UserRole.LIDER,
            departamentosText: Array.isArray(user.departamentos) ? user.departamentos.join(', ') : '',
        });
        setEditingId(user.id);
        setShowForm(true);
    };

    return (
        <AppLayout pageTitle="Painel Administrativo">
            <div className="max-w-6xl mx-auto animate-fadeIn">
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
                        <h1 className="font-heading font-bold text-hotel-blue text-xl">Painel Administrativo</h1>
                        <p className="text-hotel-gray-md text-xs font-body">Gerencie contas, perfis e acesso no Firebase.</p>
                    </div>
                </div>

                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-body text-amber-800">
                    Criação de conta já sincroniza Firebase Auth + Firestore. Edição/deleção sincroniza Firestore.
                    Alteração de senha para contas existentes é feita por e-mail de redefinição.
                </div>

                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <p className="flex items-center gap-2 text-sm font-semibold font-body text-hotel-blue">
                            <Users size={17} /> Usuários ({sortedUsers.length})
                        </p>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowForm((v) => !v);
                            }}
                            className="flex items-center gap-2 rounded-lg bg-hotel-blue px-4 py-2 text-sm font-semibold font-body text-white hover:bg-hotel-blue/90 transition-colors"
                        >
                            <Plus size={18} /> {showForm ? 'Fechar formulário' : 'Novo Usuário'}
                        </button>
                    </div>

                    {/* Formulário */}
                    {showForm && (
                        <div className="mb-6 rounded-xl border border-hotel-gray bg-hotel-light p-4 space-y-4">
                            <h3 className="font-heading font-semibold text-hotel-blue">
                                {editingId ? 'Editar Usuário (Firestore)' : 'Novo Usuário (Auth + Firestore)'}
                            </h3>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    type="text"
                                    placeholder="Nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={formData.email}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={editingId ? 'Nova senha (opcional, apenas para nova conta use este campo)' : 'Senha inicial (mín. 6)'}
                                    value={formData.senha}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, senha: e.target.value }))}
                                    className="flex-1 rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="rounded-lg border border-hotel-gray bg-white px-3 text-hotel-gray-md hover:text-hotel-blue transition-colors"
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
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                                <input
                                    type="text"
                                    placeholder="Telegram Chat ID"
                                    value={formData.telegram_chat_id}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, telegram_chat_id: e.target.value.replace(/\D/g, '') }))}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
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
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveUser}
                                    disabled={saving}
                                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold font-body text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                                >
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false);
                                        resetForm();
                                    }}
                                    className="flex-1 rounded-lg bg-hotel-gray px-4 py-2 text-sm font-semibold font-body text-white hover:bg-hotel-gray/90 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tabela de usuários */}
                    <div className="overflow-x-auto rounded-xl border border-hotel-gray">
                        <table className="w-full text-sm font-body">
                            <thead className="bg-hotel-blue text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left">Nome</th>
                                    <th className="px-4 py-3 text-left">Email</th>
                                    <th className="px-4 py-3 text-left">Role</th>
                                    <th className="px-4 py-3 text-left">Departamentos</th>
                                    <th className="px-4 py-3 text-left">Telefone</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedUsers.map((row) => (
                                    <tr key={row.id} className="border-t border-hotel-gray hover:bg-hotel-light">
                                        <td className="px-4 py-3 font-semibold text-hotel-blue">{row.nome}</td>
                                        <td className="px-4 py-3">{row.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block rounded px-2 py-1 text-xs font-semibold text-white ${
                                                row.role === UserRole.ADMIN
                                                    ? 'bg-purple-600'
                                                    : row.role === UserRole.DIRETORA
                                                        ? 'bg-blue-600'
                                                        : 'bg-gray-600'
                                            }`}
                                            >
                                                {row.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {Array.isArray(row.departamentos) && row.departamentos.length > 0
                                                ? row.departamentos.join(', ')
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs">{row.telefone || '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditUser(row)}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendPasswordReset(row.email)}
                                                    className="text-amber-600 hover:text-amber-800 transition-colors disabled:opacity-50"
                                                    title="Enviar redefinição de senha"
                                                    disabled={sendingResetTo === row.email}
                                                >
                                                    <KeyRound size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteUser(row.id, row.nome)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
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
                </div>
            </div>
        </AppLayout>
    );
}
