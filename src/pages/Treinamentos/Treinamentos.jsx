import { useEffect, useMemo, useState } from 'react';
import {
    GraduationCap,
    Plus,
    Search,
    Filter,
    Calendar,
    Clock,
    User,
    Users,
    BookOpen,
    Trash2,
    Edit3,
    X,
    Sparkles,
    Check,
    ChevronRight,
    Award,
    Paperclip,
    FileText
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { hasPermission, PERMISSIONS } from '../../services/permissions';
import {
    subscribeTreinamentos,
    saveTreinamento,
    deleteTreinamento,
    respondToTrainingInvite
} from '../../services/treinamentosStorage';
import { uploadTreinamentoPdf } from '../../services/storage';
import { createUserNotification } from '../../services/notifications';


function getCurrentMonth() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export default function Treinamentos() {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { users, availableDepartments, currentUserProfile } = useUsers();
    const profile = currentUserProfile || user;
 
    // Filtrar e ordenar a lista de líderes selecionáveis
    const sortedSelectableUsers = useMemo(() => {
        const uniqueMap = new Map();
        users.forEach((u) => {
            const nameTrimmed = u.nome?.trim();
            if (!nameTrimmed) return;
            const nameLower = nameTrimmed.toLowerCase();
            if (nameLower === 'sarah') return; // Excluir Sarah
            if (nameLower === 'bernadino') return; // Excluir Bernadino (mantendo Bernardino)
            
            // De-duplicar nomes exatos (ex: Sofia)
            if (!uniqueMap.has(nameLower)) {
                uniqueMap.set(nameLower, u);
            }
        });
        return Array.from(uniqueMap.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }, [users]);

    // Estados locais
    const [treinamentos, setTreinamentos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [selectedTreinamento, setSelectedTreinamento] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Estado do Formulário
    const [formData, setFormData] = useState({
        tema: '',
        departamento: '',
        data: new Date().toISOString().slice(0, 10),
        duracao: '1h',
        customDuracao: '',
        palestrante: '',
        descricao: '',
        colaboradoresIds: [],
        customColaboradores: [],
        pdf: null,
        pdfFile: null
    });

    const [customColabName, setCustomColabName] = useState('');

    // Inscrição em tempo real nos dados do Firebase/localStorage
    useEffect(() => {
        const unsubscribe = subscribeTreinamentos(
            (data) => setTreinamentos(data),
            () => addNotification('Erro ao sincronizar treinamentos. Exibindo dados locais offline.', 'warning')
        );
        return () => unsubscribe?.();
    }, [addNotification]);

    // Filtragem dos Treinamentos
    const filteredTreinamentos = useMemo(() => {
        return treinamentos
            .filter((t) => {
                const keyword = searchTerm.toLowerCase();
                const matchKeyword =
                    t.tema.toLowerCase().includes(keyword) ||
                    t.palestrante.toLowerCase().includes(keyword) ||
                    t.descricao.toLowerCase().includes(keyword) ||
                    t.colaboradores.some((c) => c.toLowerCase().includes(keyword));

                const matchDept = !selectedDept || t.departamento === selectedDept;
                const matchMonth = !selectedMonth || t.data.startsWith(selectedMonth);

                return matchKeyword && matchDept && matchMonth;
            })
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    }, [treinamentos, searchTerm, selectedDept, selectedMonth]);

    // Métricas para o Dashboard
    const stats = useMemo(() => {
        const count = filteredTreinamentos.length;

        // Soma aproximada de horas de treinamento
        let totalHours = 0;
        filteredTreinamentos.forEach((t) => {
            const rawDur = t.duracao.toLowerCase().trim();
            if (rawDur.includes('h')) {
                const hours = parseFloat(rawDur) || 1;
                totalHours += hours;
            } else if (rawDur.includes('min')) {
                const mins = parseFloat(rawDur) || 30;
                totalHours += mins / 60;
            } else {
                totalHours += 1; // Default
            }
        });
        totalHours = Math.round(totalHours * 10) / 10;

        // Setores distintos envolvidos nos treinamentos
        const depts = new Set(filteredTreinamentos.map((t) => t.departamento).filter(Boolean));

        // Total acumulado de participações em treinamentos (soma de colaboradores em cada sessão)
        const totalParticipacoes = filteredTreinamentos.reduce((acc, t) => acc + (t.colaboradores?.length || 0), 0);

        return {
            count,
            hours: totalHours,
            departmentsCount: depts.size,
            participations: totalParticipacoes
        };
    }, [filteredTreinamentos]);

    // Group participants of the selected training by status
    const selectedTrainingParticipants = useMemo(() => {
        if (!selectedTreinamento) return { accepted: [], pending: [], declined: [] };

        const list = selectedTreinamento.customList || [];
        if (list.length === 0) {
            // Legacy fallback using colaboradores names array
            return {
                accepted: (selectedTreinamento.colaboradores || []).map((nome, idx) => ({
                    id: `legacy_${idx}`,
                    nome,
                    isUser: false,
                    status: 'aceito'
                })),
                pending: [],
                declined: []
            };
        }

        return {
            accepted: list.filter((c) => c.status === 'aceito' || !c.isUser),
            pending: list.filter((c) => c.isUser && c.status === 'pendente'),
            declined: list.filter((c) => c.isUser && c.status === 'recusado')
        };
    }, [selectedTreinamento]);

    // Check invite status of logged-in user for selected training
    const modalInviteStatus = useMemo(() => {
        if (!selectedTreinamento) return null;
        const uId = profile?.firebaseUid || profile?.id || user?.firebaseUid || user?.id;
        const uNome = profile?.nome || user?.nome || '';
        const uEmail = profile?.email || user?.email || '';

        const userInvite = selectedTreinamento.customList?.find((c) => {
            const matchId = c.id === profile?.firebaseUid || c.id === profile?.id || c.id === user?.firebaseUid || c.id === user?.id;
            const matchName = c.nome && uNome && c.nome.trim().toLowerCase() === uNome.trim().toLowerCase();
            const matchEmail = c.email && uEmail && c.email.trim().toLowerCase() === uEmail.trim().toLowerCase();
            return matchId || matchName || matchEmail;
        });
        return userInvite ? userInvite.status : null;
    }, [selectedTreinamento, profile, user]);

    // Lidar com a seleção de participantes (usuários do sistema)
    const handleToggleUserColab = (userId, nome) => {
        setFormData((prev) => {
            const isSelected = prev.colaboradoresIds.includes(userId);
            if (isSelected) {
                return {
                    ...prev,
                    colaboradoresIds: prev.colaboradoresIds.filter((id) => id !== userId),
                    customColaboradores: prev.customColaboradores.filter((c) => c.id !== userId)
                };
            } else {
                const userObj = sortedSelectableUsers.find((u) => u.id === userId);
                const email = userObj?.email || '';
                return {
                    ...prev,
                    colaboradoresIds: [...prev.colaboradoresIds, userId],
                    customColaboradores: [...prev.customColaboradores, { id: userId, nome, email, isUser: true }]
                };
            }
        });
    };

    // Adicionar um colaborador personalizado (nome livre)
    const handleAddCustomColab = () => {
        const nameTrimmed = customColabName.trim();
        if (!nameTrimmed) return;

        // Evitar duplicados
        const exists = formData.customColaboradores.some((c) => c.nome.toLowerCase() === nameTrimmed.toLowerCase());
        if (exists) {
            addNotification('Este colaborador já foi adicionado.', 'info');
            return;
        }

        const newCustom = {
            id: `custom_${Date.now()}`,
            nome: nameTrimmed,
            isUser: false
        };

        setFormData((prev) => ({
            ...prev,
            customColaboradores: [...prev.customColaboradores, newCustom]
        }));
        setCustomColabName('');
    };

    // Remover um colaborador da lista do formulário
    const handleRemoveColaborador = (colabId) => {
        setFormData((prev) => ({
            ...prev,
            colaboradoresIds: prev.colaboradoresIds.filter((id) => id !== colabId),
            customColaboradores: prev.customColaboradores.filter((c) => c.id !== colabId)
        }));
    };

    const handleCardAccept = async (trainingId, event) => {
        event?.stopPropagation();
        const uId = profile?.firebaseUid || profile?.id || user?.firebaseUid || user?.id;
        const uNome = profile?.nome || user?.nome || 'Usuário';
        if (!uId) return;

        try {
            await respondToTrainingInvite(trainingId, uId, uNome, true);
            addNotification('Convite de treinamento aceito com sucesso!', 'success');
        } catch (error) {
            addNotification(`Erro ao aceitar convite: ${error.message}`, 'error');
        }
    };

    const handleCardDecline = async (trainingId, event) => {
        event?.stopPropagation();
        const uId = profile?.firebaseUid || profile?.id || user?.firebaseUid || user?.id;
        const uNome = profile?.nome || user?.nome || 'Usuário';
        if (!uId) return;

        try {
            await respondToTrainingInvite(trainingId, uId, uNome, false);
            addNotification('Convite de treinamento recusado.', 'info');
        } catch (error) {
            addNotification(`Erro ao recusar convite: ${error.message}`, 'error');
        }
    };

    // Submissão do Formulário (Salvar)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.tema || !formData.departamento || !formData.palestrante) {
            addNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        setSaving(true);
        try {
            const finalDuracao = formData.duracao === 'custom' ? formData.customDuracao : formData.duracao;

            const nextCustomColaboradores = formData.customColaboradores.map((colab) => {
                if (colab.isUser) {
                    return {
                        ...colab,
                        status: colab.status || 'pendente'
                    };
                } else {
                    return {
                        ...colab,
                        status: 'aceito'
                    };
                }
            });

            // Extrair apenas os nomes dos participantes aceitos para o array final de string
            const colaboradoresNomes = nextCustomColaboradores
                .filter((c) => c.status === 'aceito')
                .map((c) => c.nome);

            let finalPdf = formData.pdf || null;
            if (formData.pdfFile) {
                addNotification('Enviando anexo PDF para o servidor...', 'info');
                const uploadResult = await uploadTreinamentoPdf(formData.pdfFile, formData.tema);
                if (uploadResult && uploadResult.url) {
                    finalPdf = {
                        name: formData.pdf.name,
                        data: uploadResult.url
                    };
                } else {
                    throw new Error('Falha no upload do arquivo PDF.');
                }
            }

            const existingTraining = editingId ? treinamentos.find(t => t.id === editingId) : null;
            const existingUserIds = existingTraining 
                ? (existingTraining.customList || []).map(c => c.id)
                : [];

            const newPendingUsers = nextCustomColaboradores.filter(c => 
                c.isUser && 
                c.status === 'pendente' && 
                !existingUserIds.includes(c.id)
            );

            const record = {
                id: editingId || undefined,
                tema: formData.tema.trim(),
                departamento: formData.departamento,
                data: formData.data,
                duracao: finalDuracao || '1h',
                palestrante: formData.palestrante.trim(),
                descricao: formData.descricao.trim(),
                colaboradores: colaboradoresNomes,
                criadoPorId: profile?.id || null,
                criadoPorNome: profile?.nome || 'Usuário',
                createdAt: editingId ? undefined : new Date().toISOString(),
                updatedAt: editingId ? new Date().toISOString() : null,
                usersIds: formData.colaboradoresIds,
                customList: nextCustomColaboradores,
                pdf: finalPdf
            };

            const savedRecord = await saveTreinamento(record);

            // Enviar solicitações aos novos participantes pendentes
            if (newPendingUsers.length > 0) {
                await Promise.allSettled(
                    newPendingUsers.map(async (pendingUser) => {
                        const userObj = users.find(u => u.id === pendingUser.id);
                        if (!userObj) return;

                        const recipientUid = userObj.firebaseUid || userObj.id || null;
                        const recipientEmail = userObj.email || null;

                        await createUserNotification(
                            { recipientUid, recipientEmail },
                            {
                                message: `Convite de Treinamento: Você foi selecionado para participar do treinamento "${savedRecord.tema}" no dia ${new Date(savedRecord.data + 'T12:00:00').toLocaleDateString('pt-BR')}. Por favor, responda ao convite nesta tela de Treinamentos.`,
                                type: 'info',
                                relatedTrainingId: savedRecord.id
                            }
                        );
                    })
                );
            }

            addNotification(
                editingId ? 'Treinamento atualizado com sucesso!' : 'Treinamento registrado com sucesso!',
                'success'
            );

            // Resetar formulário
            resetForm();
            setShowForm(false);
        } catch (error) {
            addNotification(`Erro ao salvar treinamento: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setFormData({
            tema: '',
            departamento: '',
            data: new Date().toISOString().slice(0, 10),
            duracao: '1h',
            customDuracao: '',
            palestrante: '',
            descricao: '',
            colaboradoresIds: [],
            customColaboradores: [],
            pdf: null,
            pdfFile: null
        });
        setCustomColabName('');
        setEditingId(null);
    };

    // Iniciar edição de um treinamento
    const handleStartEdit = (t, event) => {
        event.stopPropagation();
        setEditingId(t.id);

        // Mapear dados existentes de volta para o formulário
        const colabList = Array.isArray(t.customList)
            ? t.customList.map((colab) => {
                if (colab.isUser && !colab.email) {
                    const userObj = sortedSelectableUsers.find((u) => u.nome?.toLowerCase() === colab.nome?.toLowerCase());
                    if (userObj) {
                        return { ...colab, email: userObj.email };
                    }
                }
                return colab;
            })
            : (t.colaboradores || []).map((name, idx) => {
                const userObj = sortedSelectableUsers.find((u) => u.nome?.toLowerCase() === name.toLowerCase());
                return {
                    id: userObj?.id || `legacy_${idx}`,
                    nome: name,
                    email: userObj?.email || '',
                    isUser: !!userObj,
                    status: 'aceito'
                };
            });

        const userIds = Array.isArray(t.usersIds) ? t.usersIds : [];

        const isStandardDur = ['30 min', '1h', '2h', '3h'].includes(t.duracao);

        setFormData({
            tema: t.tema,
            departamento: t.departamento,
            data: t.data,
            duracao: isStandardDur ? t.duracao : 'custom',
            customDuracao: isStandardDur ? '' : t.duracao,
            palestrante: t.palestrante,
            descricao: t.descricao || '',
            colaboradoresIds: userIds,
            customColaboradores: colabList,
            pdf: t.pdf || null,
            pdfFile: null
        });

        setShowForm(true);
    };

    // Excluir treinamento
    const handleDelete = async (tId, event) => {
        event.stopPropagation();
        if (!window.confirm('Tem certeza que deseja remover este registro de treinamento permanente?')) return;

        try {
            await deleteTreinamento(tId);
            addNotification('Registro de treinamento excluído com sucesso.', 'success');
            if (selectedTreinamento?.id === tId) {
                setSelectedTreinamento(null);
            }
        } catch (error) {
            addNotification(`Erro ao excluir treinamento: ${error.message}`, 'error');
        }
    };

    return (
        <AppLayout pageTitle="Treinamentos Operacionais">
            <div className="mx-auto max-w-7xl animate-fadeIn space-y-6">
                
                {/* Header Premium com Gradiente */}
                <div 
                    className="relative overflow-hidden rounded-[28px] border border-white/10 text-white shadow-[0_20px_50px_rgba(4,21,35,0.18)]"
                    style={{ background: 'linear-gradient(135deg, #062135 0%, #0A3D62 60%, #1a5276 100%)' }}
                >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/[0.04]" />
                    <div className="pointer-events-none absolute -bottom-10 right-20 h-28 w-28 rounded-full bg-hotel-gold/10" />
                    
                    <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                                <Sparkles size={12} className="text-hotel-gold animate-pulse" /> Recursos Humanos
                            </div>
                            <h1 className="mt-4 font-heading text-3xl font-extrabold tracking-tight lg:text-4xl">
                                Registro de Treinamentos
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
                                Centralize o registro de capacitações e alinhamentos mensais realizados com a equipe. 
                                Monitore a carga horária e os colaboradores qualificados do hotel.
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    resetForm();
                                    setShowForm(true);
                                }}
                                className="inline-flex items-center gap-2.5 rounded-2xl bg-hotel-gold px-5 py-3 text-sm font-bold text-white shadow-lg shadow-hotel-gold/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-hotel-gold-lt hover:shadow-hotel-gold/40"
                            >
                                <Plus size={16} /> Registrar Treinamento
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dashboard de Estatísticas */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Sessões Realizadas</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{stats.count}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                                <GraduationCap size={20} className="text-hotel-blue" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Carga Horária Total</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{stats.hours}h</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                                <Clock size={20} className="text-hotel-gold" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Setores Capacitados</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{stats.departmentsCount}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                                <BookOpen size={20} className="text-hotel-blue" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Colaboradores Qualificados</p>
                                <p className="mt-1 text-2xl font-black text-slate-800 font-heading">{stats.participations}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                                <Users size={20} className="text-hotel-gold" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filtros e Barra de Pesquisa */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-hotel-blue/10 bg-white p-4 shadow-sm">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            placeholder="Buscar por tema, palestrante ou participante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue"
                        />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <Filter size={14} /> Filtrar por:
                        </div>
                        
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-hotel-blue focus:bg-white"
                        >
                            <option value="">Todos os setores</option>
                            {availableDepartments.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>

                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-hotel-blue focus:bg-white"
                        />

                        {(searchTerm || selectedDept || selectedMonth) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedDept('');
                                    setSelectedMonth('');
                                }}
                                className="h-10 rounded-xl border border-red-200 bg-red-50/50 px-4 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                            >
                                Limpar Filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* Listagem de Treinamentos */}
                {filteredTreinamentos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/60 bg-white py-10 px-6 text-center shadow-sm w-full">
                        <div className="w-12 h-12 rounded-full bg-hotel-blue/5 flex items-center justify-center text-hotel-blue/70">
                            <GraduationCap size={22} />
                        </div>
                        <h3 className="mt-3 font-heading text-sm font-bold text-slate-700">Nenhum treinamento encontrado</h3>
                        <p className="mt-1 text-[11px] text-slate-400 leading-relaxed max-w-sm">
                            Não encontramos registros de treinamentos para os filtros aplicados. Tente limpar os filtros ou registrar um novo treinamento.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredTreinamentos.map((t) => {
                            const uId = profile?.firebaseUid || profile?.id || user?.firebaseUid || user?.id;
                            const uNome = profile?.nome || user?.nome || '';
                            const uEmail = profile?.email || user?.email || '';

                            const userInvite = t.customList?.find((c) => {
                                const matchId = c.id === profile?.firebaseUid || c.id === profile?.id || c.id === user?.firebaseUid || c.id === user?.id;
                                const matchName = c.nome && uNome && c.nome.trim().toLowerCase() === uNome.trim().toLowerCase();
                                const matchEmail = c.email && uEmail && c.email.trim().toLowerCase() === uEmail.trim().toLowerCase();
                                return matchId || matchName || matchEmail;
                            });
                            const inviteStatus = userInvite ? userInvite.status : null;

                            return (
                                <div
                                    key={t.id}
                                    onClick={() => setSelectedTreinamento(t)}
                                    className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-150 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-hotel-blue/20 hover:shadow-md cursor-pointer"
                                >
                                    <div>
                                        {/* Badge Departamento e Ações */}
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="inline-flex items-center rounded-full bg-hotel-blue/10 px-2.5 py-1 text-[11px] font-bold text-hotel-blue">
                                                {t.departamento}
                                            </span>
                                            
                                            <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleStartEdit(t, e)}
                                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-hotel-blue"
                                                    title="Editar registro"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(t.id, e)}
                                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                                    title="Excluir registro"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Tema */}
                                        <h3 className="mt-3 font-heading text-base font-bold text-slate-800 group-hover:text-hotel-blue transition-colors">
                                            {t.tema}
                                        </h3>

                                        {/* Descrição curta */}
                                        <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                            {t.descricao || 'Sem descrição cadastrada.'}
                                        </p>

                                        {inviteStatus === 'pendente' && (
                                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Você foi convidado para este treinamento:</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCardAccept(t.id, e)}
                                                        className="flex-1 inline-flex items-center justify-center rounded-lg bg-emerald-500 py-1.5 px-2 text-[10px] font-bold text-white hover:bg-emerald-600 transition-colors shadow-sm"
                                                    >
                                                        Aceitar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCardDecline(t.id, e)}
                                                        className="flex-1 inline-flex items-center justify-center rounded-lg border border-red-200 bg-white py-1.5 px-2 text-[10px] font-bold text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                                                    >
                                                        Recusar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {inviteStatus === 'aceito' && (
                                            <div className="mt-3.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 w-fit">
                                                <Check size={10} /> Presença Confirmada
                                            </div>
                                        )}

                                        {inviteStatus === 'recusado' && (
                                            <div className="mt-3.5 inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700 w-fit">
                                                <X size={10} /> Presença Recusada
                                            </div>
                                        )}
                                    </div>

                                <div className="mt-5 border-t border-slate-100 pt-4">
                                    {/* Meta info */}
                                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-400">
                                        <span className="inline-flex items-center gap-1.5">
                                            <Calendar size={12} />
                                            {new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 justify-end">
                                            <Clock size={12} />
                                            {t.duracao}
                                            {t.pdf && (
                                                <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-600 border border-emerald-100" title="Possui PDF anexo">
                                                    <Paperclip size={8} /> PDF
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    {/* Palestrante e Participantes */}
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 truncate">
                                            <User size={12} className="text-hotel-gold" />
                                            <span className="truncate">{t.palestrante}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-hotel-blue/80 bg-hotel-blue/5 rounded-full px-2 py-0.5">
                                            <Users size={11} />
                                            {t.colaboradores?.length || 0}
                                        </div>
                                    </div>
                                </div>

                                {/* Link Indicator no Rodapé */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 translate-x-2 text-hotel-gold opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL / FORMULÁRIO DE CADASTRO */}
            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                        <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-5 animate-fadeIn">
                            
                            {/* Form Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="rounded-xl bg-hotel-blue/10 p-2 text-hotel-blue">
                                        <GraduationCap size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-heading text-lg font-bold text-slate-900">
                                            {editingId ? 'Editar Registro de Treinamento' : 'Registrar Novo Treinamento'}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Preencha as informações do alinhamento ou capacitação técnica.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                    title="Fechar"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Form Body */}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                            Tema/Assunto do Treinamento *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Padrões de Atendimento e Hospitalidade"
                                            value={formData.tema}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, tema: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                            Setor Beneficiado *
                                        </label>
                                        <select
                                            value={formData.departamento}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, departamento: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm cursor-pointer"
                                            required
                                        >
                                            <option value="" disabled>Selecione o Departamento</option>
                                            {availableDepartments.map((dept) => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                            Data do Treinamento *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.data}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                            Duração *
                                        </label>
                                        <select
                                            value={formData.duracao}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, duracao: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm cursor-pointer"
                                            required
                                        >
                                            <option value="30 min">30 minutos</option>
                                            <option value="1h">1 hora</option>
                                            <option value="2h">2 horas</option>
                                            <option value="3h">3 horas</option>
                                            <option value="custom">Outra duração...</option>
                                        </select>
                                    </div>

                                    {formData.duracao === 'custom' && (
                                        <div className="space-y-1 animate-fadeIn">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                                Especificar Duração *
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 45 min ou 1h 30m"
                                                value={formData.customDuracao}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, customDuracao: e.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                            Palestrante / Instrutor *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Coordenação de RH"
                                            value={formData.palestrante}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, palestrante: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                        Como foi feito / Conteúdo Abordado
                                    </label>
                                    <textarea
                                        placeholder="Descreva brevemente a metodologia utilizada, materiais aplicados ou pontos discutidos..."
                                        value={formData.descricao}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm min-h-[100px] resize-none"
                                    />
                                </div>

                                {/* Campo de Anexo PDF */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
                                        Anexo (Apenas PDF - Máx 10MB)
                                    </label>
                                    {formData.pdf ? (
                                        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-semibold text-emerald-800">
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-emerald-600" />
                                                <span className="truncate max-w-xs">{formData.pdf.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFormData((prev) => ({ ...prev, pdf: null, pdfFile: null }))}
                                                className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                                                title="Remover anexo"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-350 hover:border-hotel-blue bg-white p-3 text-xs font-semibold text-slate-500 hover:text-hotel-blue cursor-pointer transition-all">
                                            <Paperclip size={16} />
                                            <span>Selecionar PDF</span>
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    if (file.size > 10 * 1024 * 1024) {
                                                        addNotification('O PDF deve ter no máximo 10MB.', 'error');
                                                        return;
                                                    }
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        pdfFile: file,
                                                        pdf: {
                                                            name: file.name,
                                                            data: null
                                                        }
                                                    }));
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>

                                {/* Seleção de Participantes */}
                                <div className="rounded-2xl border border-slate-150 bg-slate-50/50 p-4 space-y-4">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Participantes</h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Selecione os colaboradores participantes deste treinamento.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto py-1">
                                            {sortedSelectableUsers.map((u) => {
                                                const selected = formData.colaboradoresIds.includes(u.id);
                                                return (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => handleToggleUserColab(u.id, u.nome)}
                                                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-all ${
                                                            selected
                                                                ? 'bg-hotel-blue border-hotel-blue text-white'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                                                        }`}
                                                    >
                                                        {selected && <Check size={10} />}
                                                        {u.nome}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Adicionar Colaborador Manualmente (Sem Login) */}
                                    <div className="border-t border-slate-100 pt-3 space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                            Outros Participantes (Colaboradores sem login)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                    type="text"
                                                    placeholder="Digite o nome do colaborador e clique em adicionar..."
                                                    value={customColabName}
                                                    onChange={(e) => setCustomColabName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddCustomColab();
                                                        }
                                                    }}
                                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomColab}
                                                    className="rounded-xl bg-hotel-gold px-4 py-2 text-xs font-bold text-white transition-all hover:bg-hotel-gold-lt active:scale-95 shadow-sm"
                                                >
                                                    Adicionar
                                                </button>
                                            </div>
                                        </div>

                                        {/* Lista de Colaboradores Selecionados / Adicionados */}
                                    <div className="border-t border-slate-100 pt-3">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                                            Lista de Presença ({formData.customColaboradores.length})
                                        </label>
                                        {formData.customColaboradores.length === 0 ? (
                                            <p className="text-[11px] text-slate-400 italic">Nenhum participante adicionado ainda.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
                                                {formData.customColaboradores.map((c) => (
                                                    <span
                                                        key={c.id}
                                                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                                                            c.isUser
                                                                ? 'bg-hotel-gold/15 text-hotel-gold-dk border border-transparent'
                                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                        }`}
                                                    >
                                                        {c.nome}
                                                        {c.isUser && (
                                                            <span className={`text-[9px] px-1 py-0.25 rounded-md ${
                                                                c.status === 'aceito' ? 'bg-emerald-100 text-emerald-800' :
                                                                c.status === 'recusado' ? 'bg-red-100 text-red-800' :
                                                                'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {c.status === 'aceito' ? 'Aceitou' : c.status === 'recusado' ? 'Recusou' : 'Pendente'}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveColaborador(c.id)}
                                                            className={`rounded-full p-0.5 transition-colors ${
                                                                c.isUser
                                                                    ? 'hover:bg-hotel-gold/30 text-hotel-gold-dk'
                                                                    : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'
                                                            }`}
                                                            title="Remover"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Form Actions */}
                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 rounded-xl bg-hotel-blue py-3 text-sm font-bold text-white transition-all hover:bg-hotel-blue-md disabled:opacity-60"
                                    >
                                        {saving ? 'Registrando...' : editingId ? 'Salvar Alterações' : 'Registrar Treinamento'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForm(false);
                                            resetForm();
                                        }}
                                        className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL DE DETALHES DO TREINAMENTO */}
                {selectedTreinamento && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                        <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-150 max-h-[90vh] overflow-y-auto space-y-6 animate-fadeIn">
                            
                            {/* Header Detalhes */}
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                                <div className="space-y-1">
                                    <span className="inline-flex items-center rounded-full bg-hotel-blue/10 px-2.5 py-1 text-[11px] font-bold text-hotel-blue">
                                        {selectedTreinamento.departamento}
                                    </span>
                                    <h2 className="font-heading text-lg font-black text-slate-800 pt-1">
                                        {selectedTreinamento.tema}
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTreinamento(null)}
                                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors flex-shrink-0"
                                    title="Fechar"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Invite Status inside Detail Modal */}
                            {modalInviteStatus === 'pendente' && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                            <Clock size={16} /> Convite de Participação Pendente
                                        </div>
                                        <span className="text-[11px] text-amber-700 font-bold">Por favor, responda a este convite</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                handleCardAccept(selectedTreinamento.id, e);
                                                setSelectedTreinamento(null);
                                            }}
                                            className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-600 shadow-sm"
                                        >
                                            Confirmar Presença (Aceitar)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                handleCardDecline(selectedTreinamento.id, e);
                                                setSelectedTreinamento(null);
                                            }}
                                            className="flex-1 rounded-xl border border-red-200 bg-white py-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 shadow-sm"
                                        >
                                            Recusar Participação
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Detalhes Técnicos */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Card Data */}
                                <div className="flex items-center gap-4 rounded-2xl border border-slate-150 bg-slate-50/50 p-5 transition-all duration-200 hover:border-hotel-blue/25 hover:bg-slate-50 hover:shadow-sm">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-hotel-blue/10 text-hotel-blue">
                                        <Calendar size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Data</span>
                                        <span className="block text-xs font-extrabold text-slate-700 mt-1">
                                            {new Date(selectedTreinamento.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>

                                {/* Card Duração */}
                                <div className="flex items-center gap-4 rounded-2xl border border-slate-150 bg-slate-50/50 p-5 transition-all duration-200 hover:border-hotel-gold/25 hover:bg-slate-50 hover:shadow-sm">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-hotel-gold/10 text-hotel-gold">
                                        <Clock size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Duração</span>
                                        <span className="block text-xs font-extrabold text-slate-700 mt-1">
                                            {selectedTreinamento.duracao}
                                        </span>
                                    </div>
                                </div>

                                {/* Card Palestrante */}
                                <div className="flex items-center gap-4 rounded-2xl border border-slate-150 bg-slate-50/50 p-5 transition-all duration-200 hover:border-emerald-600/25 hover:bg-slate-50 hover:shadow-sm">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                        <User size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-body">Palestrante</span>
                                        <span className="block text-xs font-extrabold text-slate-700 mt-1 truncate" title={selectedTreinamento.palestrante}>
                                            {selectedTreinamento.palestrante}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Metodologia / Como foi feito */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-body">
                                    <BookOpen size={14} className="text-hotel-blue" /> Como foi feito / Metodologia
                                </h4>
                                <div className="rounded-2xl border border-slate-150 bg-slate-50/30 p-4 text-xs text-slate-600 leading-relaxed min-h-[80px]">
                                    {selectedTreinamento.descricao || (
                                        <span className="text-slate-400 italic">Sem descrição registrada.</span>
                                    )}
                                </div>
                            </div>

                            {/* Anexo PDF */}
                            {selectedTreinamento.pdf && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-body">
                                        <FileText size={14} className="text-hotel-blue" /> Anexo PDF
                                    </h4>
                                    <div className="flex items-center justify-between rounded-2xl border border-slate-150 bg-slate-50/30 p-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                                                <FileText size={16} />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[320px]" title={selectedTreinamento.pdf.name}>
                                                {selectedTreinamento.pdf.name}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const pdfData = selectedTreinamento.pdf.data;
                                                if (pdfData && pdfData.startsWith('http')) {
                                                    window.open(pdfData, '_blank');
                                                } else {
                                                    const link = document.createElement('a');
                                                    link.href = pdfData;
                                                    link.download = selectedTreinamento.pdf.name;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-hotel-blue px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-hotel-blue-md"
                                        >
                                            {selectedTreinamento.pdf.data && selectedTreinamento.pdf.data.startsWith('http') ? 'Visualizar PDF' : 'Download PDF'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Lista de Colaboradores Presentes */}
                            <div className="space-y-4">
                                {/* Colaboradores Qualificados */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-body">
                                        <Users size={14} className="text-hotel-gold" /> 
                                        Colaboradores Qualificados ({selectedTrainingParticipants.accepted.length})
                                    </h4>
                                    
                                    {selectedTrainingParticipants.accepted.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic font-body">Nenhum participante qualificado ainda.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-[150px] overflow-y-auto py-1">
                                            {selectedTrainingParticipants.accepted.map((colab) => {
                                                const initials = colab.nome
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((w) => w[0].toUpperCase())
                                                    .join('');

                                                return (
                                                    <div
                                                        key={colab.id}
                                                        className="flex items-center gap-2.5 rounded-xl border border-slate-150 bg-white p-2 shadow-sm hover:border-slate-300 transition-colors duration-200"
                                                    >
                                                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600`}>
                                                            {initials || '?'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-700 truncate block" title={colab.nome}>
                                                                {colab.nome}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Convites Pendentes */}
                                {selectedTrainingParticipants.pending.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-body">
                                            <Clock size={14} className="text-amber-500" /> 
                                            Aguardando Confirmação ({selectedTrainingParticipants.pending.length})
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-[150px] overflow-y-auto py-1">
                                            {selectedTrainingParticipants.pending.map((colab) => {
                                                const initials = colab.nome
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((w) => w[0].toUpperCase())
                                                    .join('');

                                                return (
                                                    <div
                                                        key={colab.id}
                                                        className="flex items-center gap-2.5 rounded-xl border border-dashed border-amber-200 bg-amber-50/20 p-2 shadow-sm transition-colors duration-200"
                                                    >
                                                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-amber-50 text-amber-600`}>
                                                            {initials || '?'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-600 truncate block" title={colab.nome}>
                                                                {colab.nome}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Recusados */}
                                {selectedTrainingParticipants.declined.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-body">
                                            <X size={14} className="text-red-500" /> 
                                            Recusaram Participação ({selectedTrainingParticipants.declined.length})
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-[150px] overflow-y-auto py-1">
                                            {selectedTrainingParticipants.declined.map((colab) => {
                                                const initials = colab.nome
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((w) => w[0].toUpperCase())
                                                    .join('');

                                                return (
                                                    <div
                                                        key={colab.id}
                                                        className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/20 p-2 shadow-sm transition-colors duration-200"
                                                    >
                                                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-red-50 text-red-600`}>
                                                            {initials || '?'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-600 line-through truncate block" title={colab.nome}>
                                                                {colab.nome}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Rodapé do Modal */}
                            <div className="flex gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={(e) => handleDelete(selectedTreinamento.id, e)}
                                    className="inline-flex justify-center items-center rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-600 transition-colors hover:bg-red-100 active:scale-95 flex-shrink-0"
                                    title="Excluir Registro de Treinamento"
                                >
                                    <Trash2 size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        handleStartEdit(selectedTreinamento, e);
                                        setSelectedTreinamento(null);
                                    }}
                                    className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <Edit3 size={12} /> Editar Registro
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTreinamento(null)}
                                    className="flex-1 rounded-xl bg-hotel-blue py-2.5 text-xs font-bold text-white transition-colors hover:bg-hotel-blue-md"
                                >
                                    Fechar Detalhes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </AppLayout>
    );
}
