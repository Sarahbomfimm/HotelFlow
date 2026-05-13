import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Building2, Settings, ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { UserRole } from '../../models/User';
import { db, isFirebaseConfigured } from '../../services/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export default function AdminPanel() {
    const { users } = useUsers();
    const { addNotification } = useNotification();
    const navigate = useNavigate();

    const [tab, setTab] = useState('users');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        id: '',
        nome: '',
        email: '',
        telefone: '',
        role: UserRole.LIDER,
        departamentos: [],
    });
    const [editingId, setEditingId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');

    const handleSaveUser = async () => {
        if (!formData.nome || !formData.email || !password) {
            addNotification('Preencha nome, email e senha.', 'error');
            return;
        }

        try {
            const userData = {
                nome: formData.nome,
                email: formData.email,
                telefone: formData.telefone || null,
                role: formData.role,
                departamentos: formData.departamentos || [],
            };

            if (isFirebaseConfigured && db) {
                const docId = editingId || formData.id || `u${Date.now()}`;
                await setDoc(doc(db, 'users', docId), userData, { merge: true });
            }

            addNotification(
                editingId ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!',
                'success',
            );

            resetForm();
            setShowForm(false);
        } catch (error) {
            addNotification(`Erro ao salvar: ${error.message}`, 'error');
        }
    };

    const handleDeleteUser = async (userId, userName) => {
        if (!confirm(`Tem certeza que deseja deletar ${userName}?`)) return;

        try {
            if (isFirebaseConfigured && db) {
                await deleteDoc(doc(db, 'users', userId));
            }
            addNotification(`${userName} foi deletado.`, 'success');
        } catch (error) {
            addNotification(`Erro ao deletar: ${error.message}`, 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            id: '',
            nome: '',
            email: '',
            telefone: '',
            role: UserRole.LIDER,
            departamentos: [],
        });
        setEditingId(null);
        setPassword('');
    };

    const handleEditUser = (user) => {
        setFormData({ ...user, id: user.id });
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
                        <p className="text-hotel-gray-md text-xs font-body">Gerencie usuários, líderes e departamentos.</p>
                    </div>
                </div>

                {/* Abas */}
                <div className="mb-6 flex gap-2 border-b border-hotel-gray">
                    <button
                        onClick={() => setTab('users')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold font-body rounded-t-lg transition-colors ${
                            tab === 'users'
                                ? 'bg-hotel-blue text-white'
                                : 'text-hotel-gray-md hover:text-hotel-blue'
                        }`}
                    >
                        <Users size={18} /> Usuários ({users.length})
                    </button>
                </div>

                {/* Conteúdo da aba */}
                {tab === 'users' && (
                    <div>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowForm((v) => !v);
                            }}
                            className="mb-4 flex items-center gap-2 rounded-lg bg-hotel-blue px-4 py-2 text-sm font-semibold font-body text-white hover:bg-hotel-blue/90 transition-colors"
                        >
                            <Plus size={18} /> Novo Usuário
                        </button>

                        {/* Formulário */}
                        {showForm && (
                            <div className="mb-6 rounded-xl border border-hotel-gray bg-hotel-light p-4 space-y-4">
                                <h3 className="font-heading font-semibold text-hotel-blue">
                                    {editingId ? 'Editar Usuário' : 'Novo Usuário'}
                                </h3>
                                <input
                                    type="text"
                                    placeholder="Nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                                <div className="flex gap-2">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Senha"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="flex-1 rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                    />
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-hotel-gray-md hover:text-hotel-blue transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <input
                                    type="tel"
                                    placeholder="Telefone (opcional)"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                />
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full rounded-lg border border-hotel-gray px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-hotel-blue"
                                >
                                    <option value={UserRole.ADMIN}>Admin</option>
                                    <option value={UserRole.DIRETORA}>Diretora</option>
                                    <option value={UserRole.LIDER}>Líder</option>
                                </select>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveUser}
                                        className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold font-body text-white hover:bg-emerald-700 transition-colors"
                                    >
                                        Salvar
                                    </button>
                                    <button
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
                                        <th className="px-4 py-3 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-t border-hotel-gray hover:bg-hotel-light">
                                            <td className="px-4 py-3 font-semibold text-hotel-blue">{user.nome}</td>
                                            <td className="px-4 py-3">{user.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold text-white ${
                                                    user.role === UserRole.ADMIN ? 'bg-purple-600' :
                                                    user.role === UserRole.DIRETORA ? 'bg-blue-600' : 'bg-gray-600'
                                                }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {Array.isArray(user.departamentos) && user.departamentos.length > 0
                                                    ? user.departamentos.join(', ')
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id, user.nome)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                    title="Deletar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
