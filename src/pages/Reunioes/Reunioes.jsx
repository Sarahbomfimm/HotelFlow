import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import {
    CalendarDays, Clock3, MapPin, X, Users, ListTodo, CheckSquare, Square,
    BellRing, Plus, CalendarRange, ChevronLeft, ChevronRight, Edit2, Trash2, AlertCircle, Save, Eye, Trash, Check
} from 'lucide-react';
import { useReuniao } from '../../context/ReuniaoContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { RecorrenciaLabel, StatusLabel, RecorrenciaReuniao } from '../../models/Reuniao';
import { hasPermission, PERMISSIONS } from '../../services/permissions';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function SeletorParticipantes({ participantes, onChange, todosUsers, currentUserId }) {
    const [busca, setBusca] = useState('');

    const usersDisponiveis = todosUsers.filter(
        (u) => u.id !== currentUserId && !participantes.some((p) => p.id === u.id),
    );

    const filtrados = usersDisponiveis.filter(
        (u) =>
            !busca ||
            u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
            u.email?.toLowerCase().includes(busca.toLowerCase()),
    );

    const adicionar = (user) => {
        onChange([
            ...participantes,
            {
                id: user.id,
                uid: user.firebaseUid || user.id,
                nome: user.nome,
                email: user.email,
                telegram_chat_id: user.telegram_chat_id || null,
            },
        ]);
        setBusca('');
    };

    const remover = (id) => onChange(participantes.filter((p) => p.id !== id));

    return (
        <div>
            <label className="label">Participantes</label>

            {participantes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {participantes.map((p) => (
                        <span
                            key={p.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-hotel-blue/10 px-3 py-1 text-xs font-semibold text-hotel-blue"
                        >
                            <Users size={11} />
                            {p.nome}
                            <button
                                type="button"
                                onClick={() => remover(p.id)}
                                className="ml-0.5 text-hotel-blue/60 hover:text-red-500"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="relative">
                <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className="input"
                />
                {busca && filtrados.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-hotel-gray/30 bg-white shadow-lg">
                        {filtrados.slice(0, 6).map((u) => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => adicionar(u)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hotel-light"
                            >
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-hotel-blue/10 text-xs font-bold text-hotel-blue">
                                    {u.nome?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-hotel-blue truncate">{u.nome}</p>
                                    <p className="text-xs text-hotel-gray-md truncate">{u.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {busca && filtrados.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-hotel-gray/30 bg-white px-4 py-3 shadow-lg">
                        <p className="text-xs text-hotel-gray-md">Nenhum usuário encontrado.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function capitalizeFirstLetter(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function FormularioReuniao({ isOpen, onClose, onSave, reuniaoEditando, todosUsers, currentUserId }) {
    const initialFormData = {
        titulo: '',
        data_inicio: new Date().toISOString().split('T')[0],
        hora_inicio: '09:00',
        hora_fim: '10:00',
        sala: '',
        participantes: [],
        recorrencia: RecorrenciaReuniao.NENHUMA,
        ata: '',
        descricao: '',
        checklist: [],
    };

    const [formData, setFormData] = useState(initialFormData);
    const [novoItemChecklist, setNovoItemChecklist] = useState('');
    const [editingItemChecklist, setEditingItemChecklist] = useState({ id: null, text: '' });

    useEffect(() => {
        if (!isOpen) return;

        if (reuniaoEditando) {
            const dataInicio = new Date(reuniaoEditando.data_inicio);
            setFormData({
                ...reuniaoEditando,
                data_inicio: format(dataInicio, 'yyyy-MM-dd'),
                hora_inicio: format(dataInicio, 'HH:mm'),
                hora_fim: reuniaoEditando.hora_fim || format(new Date(reuniaoEditando.data_fim || reuniaoEditando.data_inicio), 'HH:mm'),
                participantes: reuniaoEditando.participantes || [],
                checklist: Array.isArray(reuniaoEditando.checklist) ? reuniaoEditando.checklist : [],
            });
            return;
        }

        setFormData(initialFormData);
    }, [isOpen, reuniaoEditando]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!formData.titulo || !formData.data_inicio) {
            return;
        }
        await onSave({
            ...formData,
            titulo: capitalizeFirstLetter(formData.titulo),
            sala: capitalizeFirstLetter(formData.sala),
        });
        setFormData(initialFormData);
        onClose();
    };

    const adicionarItemChecklist = () => {
        if (!novoItemChecklist.trim()) return;
        const novo = {
            id: `item-${Date.now()}`,
            texto: novoItemChecklist.trim(),
            concluido: false
        };
        setFormData({ ...formData, checklist: [...formData.checklist, novo] });
        setNovoItemChecklist('');
    };

    const removerItemChecklist = (id) => {
        setFormData({
            ...formData,
            checklist: formData.checklist.filter(item => item.id !== id)
        });
    };

    const salvarEdicaoChecklistForm = (id) => {
        if (!editingItemChecklist.text.trim()) return;
        setFormData({
            ...formData,
            checklist: formData.checklist.map(item => item.id === id ? { ...item, texto: editingItemChecklist.text.trim() } : item)
        });
        setEditingItemChecklist({ id: null, text: '' });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-hotel-gray/20 bg-white px-4 py-4 sm:px-6">
                    <h2 className="font-heading text-xl font-bold text-hotel-blue">
                        {reuniaoEditando ? 'Editar Reunião' : 'Nova Reunião'}
                    </h2>
                    <button onClick={onClose} className="text-hotel-gray-md hover:text-hotel-blue">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4 p-4 sm:p-6">
                    <div>
                        <label className="label">Título</label>
                        <input
                            type="text"
                            value={formData.titulo}
                            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                            placeholder="Ex: Reunião de alinhamento"
                            className="input"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Data</label>
                            <input
                                type="date"
                                value={formData.data_inicio}
                                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="label">Sala</label>
                            <input
                                type="text"
                                value={formData.sala}
                                onChange={(e) => setFormData({ ...formData, sala: e.target.value })}
                                placeholder="Ex: Sala de reuniões 2, Auditório..."
                                className="input"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Horário de início</label>
                            <input
                                type="time"
                                value={formData.hora_inicio}
                                onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="label">Horário de fim</label>
                            <input
                                type="time"
                                value={formData.hora_fim}
                                onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                                className="input"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Recorrência</label>
                        <select
                            value={formData.recorrencia}
                            onChange={(e) => setFormData({ ...formData, recorrencia: e.target.value })}
                            className="input"
                        >
                            {Object.entries(RecorrenciaLabel).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <SeletorParticipantes
                        participantes={formData.participantes}
                        onChange={(p) => setFormData({ ...formData, participantes: p })}
                        todosUsers={todosUsers}
                        currentUserId={currentUserId}
                    />

                    <div className="rounded-2xl border border-hotel-gray/30 bg-hotel-light/20 p-4">
                        <label className="label flex items-center gap-2">
                            <ListTodo size={16} className="text-hotel-blue" /> Checklist de Tarefas (Opcional)
                        </label>
                        <div className="mt-2 space-y-2">
                            {formData.checklist.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 shadow-sm border border-hotel-gray/20">
                                    {editingItemChecklist.id === item.id ? (
                                        <div className="flex flex-1 items-center gap-2">
                                            <input
                                                type="text"
                                                value={editingItemChecklist.text}
                                                onChange={(e) => setEditingItemChecklist({ ...editingItemChecklist, text: e.target.value })}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), salvarEdicaoChecklistForm(item.id))}
                                                className="input py-1 px-2 text-sm flex-1"
                                                autoFocus
                                            />
                                            <button type="button" onClick={() => salvarEdicaoChecklistForm(item.id)} className="text-emerald-600 hover:text-emerald-700 p-1">
                                                <Check size={16} />
                                            </button>
                                            <button type="button" onClick={() => setEditingItemChecklist({id: null, text: ''})} className="text-hotel-gray-md hover:text-red-500 p-1">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 flex-1">
                                                <div className="h-2 w-2 rounded-full bg-hotel-gold shrink-0" />
                                                <span className="text-sm font-body text-hotel-blue break-all">{item.texto}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button type="button" onClick={() => setEditingItemChecklist({ id: item.id, text: item.texto })} className="text-hotel-gray-md hover:text-hotel-blue transition-colors p-1">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button type="button" onClick={() => removerItemChecklist(item.id)} className="text-hotel-gray-md hover:text-red-500 transition-colors p-1">
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            <div className="flex items-center gap-2 mt-3">
                                <input
                                    type="text"
                                    value={novoItemChecklist}
                                    onChange={(e) => setNovoItemChecklist(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarItemChecklist())}
                                    placeholder="Adicionar nova tarefa..."
                                    className="input py-1.5 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={adicionarItemChecklist}
                                    className="rounded-lg bg-hotel-blue p-2 text-white hover:bg-hotel-blue/90 transition-colors"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="label">Descrição / Pauta</label>
                        <textarea
                            value={formData.descricao}
                            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                            placeholder="Tópicos a discutir..."
                            className="input min-h-[100px] resize-none"
                        />
                    </div>

                    <div>
                        <label className="label">Ata (após a reunião)</label>
                        <textarea
                            value={formData.ata}
                            onChange={(e) => setFormData({ ...formData, ata: e.target.value })}
                            placeholder="Resumo, decisões e responsáveis..."
                            className="input min-h-[100px] resize-none"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-hotel-gray/20 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <button
                        onClick={onClose}
                        className="w-full rounded-lg border border-hotel-gray/70 bg-white px-4 py-2 text-sm font-semibold text-hotel-gray-md hover:bg-hotel-light sm:w-auto"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-hotel-gold px-4 py-2 text-sm font-semibold text-white hover:bg-hotel-gold/90 sm:w-auto"
                    >
                        <Save size={16} /> {reuniaoEditando ? 'Atualizar' : 'Criar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function HistoricoReuniaoModal({ isOpen, onClose, historico = [] }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-hotel-gray/20 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="font-heading text-xl font-bold text-hotel-blue">Log de alterações</h2>
                        <p className="mt-1 text-sm text-hotel-gray-md">Veja o histórico da reunião quando precisar.</p>
                    </div>
                    <button onClick={onClose} className="text-hotel-gray-md transition-colors hover:text-hotel-blue" aria-label="Fechar histórico">
                        <X size={22} />
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 sm:p-6">
                    {[...historico].reverse().map((item, index) => (
                        <div key={`${item.data}-${index}`} className="flex gap-3 rounded-2xl border border-hotel-gray/40 bg-hotel-light/20 px-4 py-4">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hotel-blue/10 text-hotel-blue">
                                <Clock3 size={14} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-hotel-blue">{item.usuario_nome}</p>
                                <p className="mt-0.5 text-xs text-hotel-gray-md">
                                    {format(new Date(item.data), 'dd/MM/yyyy HH:mm')}
                                </p>
                                <p className="mt-1.5 text-sm leading-6 text-hotel-gray-md">{item.descricao}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end border-t border-hotel-gray/20 px-5 py-4 sm:px-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-xl bg-hotel-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hotel-blue/90"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModalRecusa({ isOpen, onClose, onConfirm }) {
    const [motivo, setMotivo] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-hotel-gray/20 px-5 py-4 sm:px-6">
                    <h3 className="font-heading text-lg font-bold text-hotel-blue">Recusar participação</h3>
                    <button onClick={() => { setMotivo(''); onClose(); }} className="text-hotel-gray-md transition-colors hover:text-hotel-blue">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 sm:p-6">
                    <p className="text-sm text-hotel-gray-md">Por favor, informe o motivo de não poder participar desta reunião:</p>
                    <textarea
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="input mt-3 min-h-[100px] w-full resize-none"
                        placeholder="Ex: Conflito de agenda, Férias..."
                    />
                </div>
                <div className="flex justify-end gap-3 border-t border-hotel-gray/20 px-5 py-4 sm:px-6">
                    <button
                        onClick={() => { setMotivo(''); onClose(); }}
                        className="rounded-xl border border-hotel-gray/50 bg-white px-4 py-2 text-sm font-semibold text-hotel-gray-md hover:bg-hotel-light"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            if (!motivo.trim()) return;
                            onConfirm(motivo.trim());
                            setMotivo('');
                        }}
                        disabled={!motivo.trim()}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                        Confirmar recusa
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Reunioes() {
    const { reunioes, criarReuniao, atualizarReuniao, deletarReuniao } = useReuniao();
    const { user } = useAuth();
    const { addNotification, notifications, marcarLida } = useNotification();
    const { users: todosUsers, currentUserProfile } = useUsers();
    const actor = currentUserProfile || user;
    const canManageReunioes = hasPermission(actor, PERMISSIONS.REUNIOES_MANAGE);
    const [mesAtual, setMesAtual] = useState(new Date());
    const [formularioAberto, setFormularioAberto] = useState(false);
    const [reuniaoEditando, setReuniaoEditando] = useState(null);
    const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
    const [diaSelecionado, setDiaSelecionado] = useState(new Date());
    const [confirmDelete, setConfirmDelete] = useState(null); // id da reunião a deletar
    const [historicoAberto, setHistoricoAberto] = useState(false);
    const [modalRecusaAberto, setModalRecusaAberto] = useState(false);
    const detalheReuniaoRef = useRef(null);
    const [editingChecklistDetalhe, setEditingChecklistDetalhe] = useState({ id: null, text: '' });

    const diasMes = useMemo(() => {
        const inicioDoMes = startOfMonth(mesAtual);
        const fimDoMes = endOfMonth(mesAtual);
        const inicioCalendario = startOfWeek(inicioDoMes, { locale: ptBR });
        const fimCalendario = endOfWeek(fimDoMes, { locale: ptBR });
        return eachDayOfInterval({ start: inicioCalendario, end: fimCalendario });
    }, [mesAtual]);

    const reunioesFiltradas = useMemo(() => {
        return reunioes.filter((r) => {
            const isRecusado = r.participantes?.some(
                (p) => (p.id === actor?.id || p.uid === actor?.firebaseUid || p.email === actor?.email) && p.status === 'RECUSADO'
            );
            return !isRecusado;
        });
    }, [reunioes, actor]);

    const reunioesExpandidas = useMemo(() => {
        if (!reunioesFiltradas || reunioesFiltradas.length === 0 || diasMes.length === 0) return [];
        
        const inicioCalendario = diasMes[0];
        const fimCalendario = diasMes[diasMes.length - 1];
        const expandidas = [];

        reunioesFiltradas.forEach((reuniao) => {
            const rec = String(reuniao.recorrencia || '').toLowerCase();
            if (!rec || rec === 'nenhuma' || rec === 'undefined') {
                expandidas.push({ ...reuniao, instanceId: reuniao.id });
                return;
            }

            let proximaData = new Date(reuniao.data_inicio);
            const dataFim = reuniao.data_fim ? new Date(reuniao.data_fim) : new Date(reuniao.data_inicio);
            const duracao = dataFim.getTime() - new Date(reuniao.data_inicio).getTime();

            while (proximaData <= fimCalendario) {
                if (proximaData >= inicioCalendario || isSameDay(proximaData, inicioCalendario) || isSameMonth(proximaData, mesAtual)) {
                    expandidas.push({
                        ...reuniao,
                        data_inicio: proximaData.toISOString(),
                        data_fim: new Date(proximaData.getTime() + duracao).toISOString(),
                        instanceId: `${reuniao.id}-${proximaData.toISOString()}`
                    });
                }

                let dataAvancada = null;
                if (rec === 'semanal' || rec === 'semanalmente') {
                    dataAvancada = addWeeks(proximaData, 1);
                } else if (rec === 'quinzenal' || rec === 'quinzenalmente') {
                    dataAvancada = addWeeks(proximaData, 2);
                } else if (rec === 'mensal' || rec === 'mensalmente') {
                    dataAvancada = addMonths(proximaData, 1);
                }

                if (dataAvancada && dataAvancada > proximaData) {
                    proximaData = dataAvancada;
                } else {
                    break;
                }
            }
        });

        return expandidas;
    }, [reunioesFiltradas, diasMes, mesAtual]);

    const reunioesDoMes = useMemo(() => {
        return reunioesExpandidas.filter((r) => {
            return isSameMonth(new Date(r.data_inicio), mesAtual);
        }).sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));
    }, [reunioesExpandidas, mesAtual]);

    useEffect(() => {
        notifications
            .filter((item) => !item.lida && item.type === 'reuniao')
            .forEach((item) => {
                void marcarLida(item.id);
            });
    }, [marcarLida, notifications]);

    const handleSalvarReuniao = async (dados) => {
        try {
            const dataCompleta = `${dados.data_inicio}T${dados.hora_inicio}`;
            const payload = {
                ...dados,
                data_inicio: dataCompleta,
                data_fim: `${dados.data_inicio}T${dados.hora_fim}`,
                criado_por_id: actor?.id,
                criado_por_uid: actor?.firebaseUid || actor?.id,
                criado_por_email: actor?.email || '',
                criado_por_nome: actor?.nome,
            };

            if (reuniaoEditando?.id) {
                const reuniaoAtualizada = await atualizarReuniao(reuniaoEditando.id, payload);
                if (reuniaoSelecionada?.id === reuniaoEditando.id) {
                    setReuniaoSelecionada(reuniaoAtualizada);
                }
                addNotification('Reunião atualizada com sucesso!', 'success');
            } else {
                const novaReuniao = await criarReuniao(payload);
                setReuniaoSelecionada(novaReuniao);
                addNotification('Reunião criada com sucesso!', 'success');
            }

            setFormularioAberto(false);
            setReuniaoEditando(null);
        } catch (err) {
            addNotification(err.message, 'error');
        }
    };

    const handleRecusarParticipacao = async (motivo) => {
        if (!reuniaoSelecionada) return;
        try {
            const novosParticipantes = reuniaoSelecionada.participantes.map((p) => {
                if (p.id === actor?.id || p.uid === actor?.firebaseUid || p.email === actor?.email) {
                    return { ...p, status: 'RECUSADO', motivo_recusa: motivo };
                }
                return p;
            });

            const payload = {
                ...reuniaoSelecionada,
                participantes: novosParticipantes,
                historico_adicional: `Recusou a participação. Motivo: ${motivo}`,
            };

            await atualizarReuniao(reuniaoSelecionada.id, payload);
            setReuniaoSelecionada(null); // Fecha os detalhes imediatamente após a recusa
            addNotification('Participação recusada e motivo registrado.', 'success');
            setModalRecusaAberto(false);
        } catch (err) {
            addNotification('Não foi possível recusar a participação.', 'error');
        }
    };

    const handleAceitarNovamente = async () => {
        if (!reuniaoSelecionada) return;
        try {
            const novosParticipantes = reuniaoSelecionada.participantes.map((p) => {
                if (p.id === actor?.id || p.uid === actor?.firebaseUid || p.email === actor?.email) {
                    const { status, motivo_recusa, ...resto } = p;
                    return resto;
                }
                return p;
            });

            const payload = {
                ...reuniaoSelecionada,
                participantes: novosParticipantes,
                historico_adicional: 'Confirmou participação (desfez a recusa).',
            };

            const atualizada = await atualizarReuniao(reuniaoSelecionada.id, payload);
            setReuniaoSelecionada(atualizada);
            addNotification('Participação confirmada novamente.', 'success');
        } catch (err) {
            addNotification('Não foi possível confirmar a participação.', 'error');
        }
    };

    const handleDeletarReuniao = (id) => setConfirmDelete(id);

    const confirmarDelecao = async () => {
        try {
            await deletarReuniao(confirmDelete);
            addNotification('Reunião excluída com sucesso!', 'success');
            setReuniaoSelecionada(null);
        } catch (err) {
            addNotification(err.message, 'error');
        } finally {
            setConfirmDelete(null);
        }
    };

    const handleToggleChecklist = async (itemId) => {
        if (!reuniaoSelecionada) return;
        
        const novoChecklist = reuniaoSelecionada.checklist.map(item => {
            if (item.id === itemId) {
                return { ...item, concluido: !item.concluido };
            }
            return item;
        });

        try {
            const payload = { ...reuniaoSelecionada, checklist: novoChecklist };
            const atualizada = await atualizarReuniao(reuniaoSelecionada.id, payload);
            setReuniaoSelecionada(atualizada);
        } catch (err) {
            addNotification("Não foi possível atualizar o item do checklist.", "error");
        }
    };

    const salvarEdicaoChecklistDetalhe = async (itemId) => {
        if (!reuniaoSelecionada || !editingChecklistDetalhe.text.trim()) return;
        const novoChecklist = reuniaoSelecionada.checklist.map(item =>
            item.id === itemId ? { ...item, texto: editingChecklistDetalhe.text.trim() } : item
        );
        try {
            const payload = { ...reuniaoSelecionada, checklist: novoChecklist };
            const atualizada = await atualizarReuniao(reuniaoSelecionada.id, payload);
            setReuniaoSelecionada(atualizada);
            setEditingChecklistDetalhe({ id: null, text: '' });
            addNotification("Item do checklist atualizado.", "success");
        } catch (err) {
            addNotification("Não foi possível editar o item do checklist.", "error");
        }
    };

    const reunioesPorDia = (data) => {
        return reunioesExpandidas.filter((r) => {
            const dataReuniao = new Date(r.data_inicio);
            return isSameDay(dataReuniao, data);
        });
    };

    const totalReunioesHoje = reunioesExpandidas.filter((r) => {
        const dataReuniao = new Date(r.data_inicio);
        return isSameDay(dataReuniao, new Date());
    }).length;

    const reunioesDiaSelecionado = reunioesPorDia(diaSelecionado);
    const proximaReuniao = reunioesDoMes.find((r) => new Date(r.data_inicio) >= new Date());
    const setorUsuario = actor?.departamentos?.[0] || 'Administração';

    const totalParticipantesUnicos = useMemo(() => {
        const ids = new Set();
        reunioesDoMes.forEach((r) => {
            (r.participantes || []).forEach((p) => p.id && ids.add(p.id));
            if (r.criado_por_id) ids.add(r.criado_por_id);
        });
        return ids.size;
    }, [reunioesDoMes]);

    useEffect(() => {
        if (!reuniaoSelecionada) {
            setHistoricoAberto(false);
            return;
        }

        detalheReuniaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        detalheReuniaoRef.current?.focus?.({ preventScroll: true });
    }, [reuniaoSelecionada]);

    const isParticipante = reuniaoSelecionada?.participantes?.some(
        (p) => p.id === actor?.id || p.uid === actor?.firebaseUid || p.email === actor?.email
    );
    const participanteAtual = reuniaoSelecionada?.participantes?.find(
        (p) => p.id === actor?.id || p.uid === actor?.firebaseUid || p.email === actor?.email
    );
    const isConcluida = reuniaoSelecionada && (reuniaoSelecionada.status === 'CONCLUIDA' || new Date(reuniaoSelecionada.data_fim || reuniaoSelecionada.data_inicio) < new Date());

    return (
        <AppLayout pageTitle="Reuniões">
            <div className="animate-fadeIn space-y-6">
                {/* Hero */}
                <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#07233a_0%,#0d4569_55%,#123b5d_100%)] text-white shadow-[0_24px_80px_rgba(4,21,35,0.22)]">
                    <div className="grid gap-8 px-6 py-7 lg:px-8 lg:py-8">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                                <CalendarRange size={14} className="text-hotel-gold" /> {setorUsuario}
                            </div>
                            <h1 className="mt-4 max-w-xl font-heading text-3xl font-bold leading-tight lg:text-4xl">
                                Calendário de reuniões corporativas
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 lg:text-base">
                                Agende, gerencie salas, participantes, registre atas e acompanhe ações em um único ambiente.
                            </p>

                            {canManageReunioes && (
                                <div className="mt-6">
                                    <button
                                        onClick={() => { setReuniaoEditando(null); setFormularioAberto(true); }}
                                        className="inline-flex items-center gap-2 rounded-xl bg-hotel-gold px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-hotel-gold/20 transition-transform hover:-translate-y-0.5"
                                    >
                                        <Plus size={16} /> Nova reunião
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Resumo */}
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                        {
                            label: 'Reuniões este mês',
                            value: reunioesDoMes.length,
                            icon: CalendarDays,
                            color: 'bg-hotel-blue',
                            hint: 'Ir para o mês atual',
                            onClick: () => setMesAtual(new Date()),
                        },
                        {
                            label: 'Hoje agendadas',
                            value: totalReunioesHoje,
                            icon: Clock3,
                            color: 'bg-emerald-500',
                            hint: 'Filtrar dia de hoje',
                            onClick: () => setDiaSelecionado(new Date()),
                        },
                        {
                            label: 'Pessoas envolvidas',
                            value: totalParticipantesUnicos,
                            icon: Users,
                            color: 'bg-amber-500',
                            hint: 'Participantes únicos este mês',
                            onClick: null,
                        },
                        {
                            label: 'Próxima reunião',
                            value: proximaReuniao ? format(new Date(proximaReuniao.data_inicio), 'dd/MM HH:mm') : '—',
                            icon: BellRing,
                            color: 'bg-purple-500',
                            hint: proximaReuniao ? 'Abrir próximo agendamento' : 'Sem próximos eventos',
                            onClick: () => {
                                if (!proximaReuniao) return;
                                setReuniaoSelecionada(proximaReuniao);
                                setDiaSelecionado(new Date(proximaReuniao.data_inicio));
                            },
                        },
                    ].map(({ label, value, icon: Icon, color, hint, onClick }) => {
                        const Tag = onClick ? 'button' : 'div';
                        return (
                            <Tag
                                type={onClick ? 'button' : undefined}
                                key={label}
                                onClick={onClick || undefined}
                                className={`card flex w-full items-center gap-4 text-left ${
                                    onClick
                                        ? 'transition hover:-translate-y-0.5 hover:border-hotel-blue/40 cursor-pointer'
                                        : 'cursor-default'
                                }`}
                            >
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${color}`}>
                                    <Icon size={20} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-2xl font-heading font-bold text-hotel-blue">{value}</p>
                                    <p className="text-xs font-body text-hotel-gray-md">{label}</p>
                                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-hotel-blue/60">{hint}</p>
                                </div>
                            </Tag>
                        );
                    })}
                </section>

                {/* Calendário + Lista */}
                <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                    {/* Calendário mensal */}
                    <div className="card">
                        <div className="mb-4 flex items-center justify-between">
                            <button
                                onClick={() => setMesAtual(addMonths(mesAtual, -1))}
                                className="text-hotel-gray-md hover:text-hotel-blue"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <h3 className="font-heading text-lg font-bold text-hotel-blue">
                                {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
                            </h3>
                            <button
                                onClick={() => setMesAtual(addMonths(mesAtual, 1))}
                                className="text-hotel-gray-md hover:text-hotel-blue"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-hotel-gray-md uppercase sm:text-xs">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d) => (
                                <div key={d} className="py-2">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {diasMes.map((dia) => {
                                const reunioesNoDia = reunioesPorDia(dia);
                                const isHoje = isSameDay(dia, new Date());
                                const isOutroMes = !isSameMonth(dia, mesAtual);
                                const isSelecionado = isSameDay(dia, diaSelecionado);

                                return (
                                    <button
                                        type="button"
                                        key={dia.toISOString()}
                                        onClick={() => {
                                            setDiaSelecionado(dia);
                                            if (reunioesNoDia.length > 0) {
                                                setReuniaoSelecionada(reunioesNoDia[0]);
                                            }
                                        }}
                                        className={`relative flex h-14 flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition-colors sm:h-16 sm:text-xs ${
                                            isHoje
                                                ? 'bg-hotel-gold text-white'
                                                : isSelecionado
                                                    ? 'bg-hotel-blue text-white'
                                                : isOutroMes
                                                    ? 'text-hotel-gray-md/30'
                                                    : reunioesNoDia.length > 0
                                                        ? 'bg-hotel-light text-hotel-blue hover:bg-hotel-gold/20'
                                                        : 'hover:bg-hotel-light/50 text-hotel-gray-md'
                                        }`}
                                    >
                                        {format(dia, 'd')}
                                        {reunioesNoDia.length > 0 && (
                                            <div className="mt-1 flex gap-0.5">
                                                {reunioesNoDia.slice(0, 2).map((_, idx) => (
                                                    <div key={idx} className="h-1 w-1 rounded-full bg-hotel-gold" />
                                                ))}
                                                {reunioesNoDia.length > 2 && <span className="text-[9px]">+{reunioesNoDia.length - 2}</span>}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Agenda do mês */}
                    <div className="card flex flex-col gap-0 p-0 overflow-hidden">
                        {/* Cabeçalho com gradiente sutil */}
                        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#07233a_0%,#0d4569_100%)] px-5 py-5">
                            <div className="relative z-10 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
                                        Agenda · {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
                                    </p>
                                    <p className="mt-2 font-heading text-2xl font-bold text-white">
                                        {reunioesDoMes.length === 0
                                            ? 'Sem reuniões'
                                            : `${reunioesDoMes.length} ${reunioesDoMes.length === 1 ? 'reunião' : 'reuniões'}`}
                                    </p>
                                    <p className="mt-1 text-xs text-white/55">
                                        {reunioesDiaSelecionado.length > 0
                                            ? `${reunioesDiaSelecionado.length} no dia selecionado`
                                            : `Dia ${format(diaSelecionado, 'dd')} sem agendamentos`}
                                    </p>
                                </div>
                                <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-center">
                                    <p className="text-[10px] font-semibold uppercase text-white/50">
                                        {format(diaSelecionado, 'MMM', { locale: ptBR })}
                                    </p>
                                    <p className="text-2xl font-bold leading-none text-hotel-gold">
                                        {format(diaSelecionado, 'dd')}
                                    </p>
                                    <p className="mt-0.5 text-[10px] capitalize text-white/50">
                                        {format(diaSelecionado, 'EEE', { locale: ptBR })}
                                    </p>
                                </div>
                            </div>
                            {/* Decoração de fundo */}
                            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.04]" />
                            <div className="pointer-events-none absolute -bottom-8 right-12 h-20 w-20 rounded-full bg-hotel-gold/10" />
                        </div>

                        {/* Lista */}
                        {reunioesDoMes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-hotel-light">
                                    <AlertCircle size={22} className="text-hotel-gray-md/50" />
                                </div>
                                <p className="text-sm font-semibold text-hotel-blue">Nenhuma reunião este mês</p>
                                <p className="mt-1 text-xs text-hotel-gray-md">
                                    {canManageReunioes ? 'Clique em "Nova reunião" para agendar.' : 'Você tem acesso de consulta, mas não pode criar reuniões.'}
                                </p>
                            </div>
                        ) : (
                            <div className="max-h-[420px] overflow-y-auto divide-y divide-hotel-gray/10">
                                {reunioesDoMes.map((reuniao) => {
                                    const isAtiva = reuniaoSelecionada?.instanceId ? reuniaoSelecionada.instanceId === reuniao.instanceId : reuniaoSelecionada?.id === reuniao.id;
                                    const dataR = new Date(reuniao.data_inicio);
                                    const isHoje = isSameDay(dataR, new Date());
                                    return (
                                        <button
                                            type="button"
                                            key={reuniao.instanceId || reuniao.id}
                                            onClick={() => {
                                                setReuniaoSelecionada(reuniao);
                                                setDiaSelecionado(dataR);
                                            }}
                                            className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors ${
                                                isAtiva
                                                    ? 'bg-hotel-gold/10'
                                                    : 'hover:bg-hotel-light'
                                            }`}
                                        >
                                            {/* indicador lateral */}
                                            <div className={`mt-0.5 h-full w-1 shrink-0 self-stretch rounded-full ${
                                                isAtiva ? 'bg-hotel-gold' : isHoje ? 'bg-emerald-400' : 'bg-hotel-blue/20'
                                            }`} />

                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-semibold truncate ${
                                                    isAtiva ? 'text-hotel-gold' : 'text-hotel-blue'
                                                }`}>
                                                    {reuniao.titulo}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <span className="inline-flex items-center gap-1 text-xs text-hotel-gray-md">
                                                        <Clock3 size={11} />
                                                        {format(dataR, 'EEE, dd/MM', { locale: ptBR })} · {format(dataR, 'HH:mm')}
                                                    </span>
                                                    {reuniao.sala && (
                                                        <span className="inline-flex items-center gap-1 text-xs text-hotel-gray-md">
                                                            <MapPin size={11} />
                                                            {reuniao.sala}
                                                        </span>
                                                    )}
                                                </div>
                                                {reuniao.participantes?.length > 0 && (
                                                    <div className="mt-1.5 flex -space-x-1.5">
                                                        {reuniao.participantes.slice(0, 4).map((p) => (
                                                            <div
                                                                key={p.id}
                                                                title={p.nome}
                                                                className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-hotel-blue/20 text-[9px] font-bold text-hotel-blue"
                                                            >
                                                                {p.nome?.charAt(0).toUpperCase()}
                                                            </div>
                                                        ))}
                                                        {reuniao.participantes.length > 4 && (
                                                            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-hotel-gray/20 text-[9px] font-semibold text-hotel-gray-md">
                                                                +{reuniao.participantes.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {isHoje && !isAtiva && (
                                                <span className="shrink-0 self-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                                    Hoje
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* Detalhe reunião selecionada */}
                {reuniaoSelecionada && (
                    <section ref={detalheReuniaoRef} tabIndex={-1} className="card overflow-hidden border border-hotel-blue/10 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-0 outline-none shadow-[0_18px_60px_rgba(4,21,35,0.08)] focus-visible:ring-2 focus-visible:ring-hotel-gold/40">
                        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#07233a_0%,#0d4569_100%)] px-6 py-6 text-white">
                            <div className="relative z-10 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
                                        Detalhes da reunião
                                    </p>
                                    <h3 className="mt-3 line-clamp-2 font-heading text-3xl font-bold leading-tight text-white">
                                        {reuniaoSelecionada.titulo}
                                    </h3>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/80">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                                            <Clock3 size={11} /> {format(new Date(reuniaoSelecionada.data_inicio), 'dd/MM/yyyy')} · {format(new Date(reuniaoSelecionada.data_inicio), 'HH:mm')}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                                            <MapPin size={11} /> {reuniaoSelecionada.sala}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setReuniaoSelecionada(null)}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-0" />
                            <div className="pointer-events-none absolute -bottom-10 right-20 h-24 w-24 rounded-full bg-hotel-gold/15" />
                        </div>

                        <div className="space-y-6 px-6 py-6">
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light/40 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Data e hora</p>
                                    <p className="mt-2 text-sm font-semibold text-hotel-blue">
                                        {format(new Date(reuniaoSelecionada.data_inicio), 'dd/MM/yyyy')}
                                    </p>
                                    <p className="mt-1 text-sm text-hotel-gray-md">
                                        {format(new Date(reuniaoSelecionada.data_inicio), 'HH:mm')} — {reuniaoSelecionada.hora_fim}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light/40 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Sala</p>
                                    <p className="mt-2 text-sm font-semibold text-hotel-blue">
                                        {reuniaoSelecionada.sala}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light/40 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Recorrência</p>
                                    <p className="mt-2 text-sm font-semibold text-hotel-blue">
                                        {RecorrenciaLabel[reuniaoSelecionada.recorrencia]}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light/40 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Status</p>
                                    {(() => {
                                        const isConcluida = reuniaoSelecionada.status === 'CONCLUIDA' || new Date(reuniaoSelecionada.data_fim || reuniaoSelecionada.data_inicio) < new Date();
                                        const statusLabel = isConcluida ? 'Concluída' : (StatusLabel[reuniaoSelecionada.status] || 'Agendada');
                                        return (
                                            <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isConcluida ? 'bg-emerald-100 text-emerald-700' : 'bg-hotel-gold/20 text-hotel-gold'}`}>
                                                {statusLabel}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            {reuniaoSelecionada.participantes?.length > 0 && (
                                <div className="rounded-2xl border border-hotel-gray/50 bg-white px-4 py-4 shadow-[0_1px_0_rgba(4,21,35,0.02)]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Participantes</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {reuniaoSelecionada.participantes.map((p) => (
                                            <span
                                                key={p.id}
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                                                    p.status === 'RECUSADO'
                                                        ? 'border-red-200 bg-red-50 text-red-600'
                                                        : 'border-hotel-blue/10 bg-hotel-blue/10 text-hotel-blue'
                                                }`}
                                                title={p.status === 'RECUSADO' ? `Recusou: ${p.motivo_recusa}` : undefined}
                                            >
                                                <Users size={11} /> {p.nome} {p.status === 'RECUSADO' && '(Recusou)'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {reuniaoSelecionada.checklist?.length > 0 && (
                                <div className="rounded-2xl border border-hotel-gray/50 bg-white px-4 py-4 shadow-[0_1px_0_rgba(4,21,35,0.02)]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md mb-3 flex items-center gap-2">
                                        <ListTodo size={14} /> Checklist da Reunião
                                    </p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {reuniaoSelecionada.checklist.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${item.concluido ? 'border-emerald-100 bg-emerald-50/50 text-emerald-700' : 'border-hotel-gray/40 bg-white text-hotel-blue'}`}
                                            >
                                                {editingChecklistDetalhe.id === item.id ? (
                                                    <div className="flex flex-1 items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={editingChecklistDetalhe.text}
                                                            onChange={(e) => setEditingChecklistDetalhe({ ...editingChecklistDetalhe, text: e.target.value })}
                                                            onKeyPress={(e) => e.key === 'Enter' && salvarEdicaoChecklistDetalhe(item.id)}
                                                            className="input py-1 px-2 text-sm flex-1 bg-white"
                                                            autoFocus
                                                        />
                                                        <button type="button" onClick={() => salvarEdicaoChecklistDetalhe(item.id)} className="text-emerald-600 hover:text-emerald-700 p-1">
                                                            <Check size={16} />
                                                        </button>
                                                        <button type="button" onClick={() => setEditingChecklistDetalhe({id: null, text: ''})} className="text-hotel-gray-md hover:text-red-500 p-1">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleToggleChecklist(item.id)} className="flex items-center gap-3 flex-1 text-left group">
                                                            {item.concluido ? <CheckSquare size={18} className="shrink-0" /> : <Square size={18} className="shrink-0 text-hotel-gray-md group-hover:text-hotel-blue/50 transition-colors" />}
                                                            <span className={`text-sm font-medium ${item.concluido ? 'line-through opacity-70' : ''}`}>{item.texto}</span>
                                                        </button>
                                                        {canManageReunioes && (
                                                            <button onClick={() => setEditingChecklistDetalhe({ id: item.id, text: item.texto })} className="shrink-0 p-1 text-hotel-gray-md hover:text-hotel-blue transition-colors">
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {reuniaoSelecionada.descricao && (
                                <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light/30 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Pauta</p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-hotel-gray-md">{reuniaoSelecionada.descricao}</p>
                                </div>
                            )}

                            {reuniaoSelecionada.ata && (
                                <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light/30 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Ata</p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-hotel-gray-md">{reuniaoSelecionada.ata}</p>
                                </div>
                            )}

                            <div className="flex flex-col-reverse gap-2 border-t border-hotel-gray/20 pt-2 sm:flex-row sm:justify-end">
                                {isParticipante && !isConcluida && (
                                    participanteAtual?.status === 'RECUSADO' ? (
                                        <button
                                            onClick={handleAceitarNovamente}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 sm:w-auto"
                                        >
                                            Aceitar novamente
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setModalRecusaAberto(true)}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 sm:w-auto"
                                        >
                                            <X size={14} /> Recusar participação
                                        </button>
                                    )
                                )}
                                {canManageReunioes && (
                                    <>
                                        <button
                                            onClick={() => handleDeletarReuniao(reuniaoSelecionada.id)}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 sm:w-auto"
                                        >
                                            <Trash2 size={16} /> Excluir
                                        </button>
                                        <button
                                            onClick={() => { setReuniaoEditando(reuniaoSelecionada); setFormularioAberto(true); }}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-hotel-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hotel-blue/90 sm:w-auto"
                                        >
                                            <Edit2 size={14} /> Editar
                                        </button>
                                    </>
                                )}
                                {Array.isArray(reuniaoSelecionada.historico) && reuniaoSelecionada.historico.length > 0 && (
                                    <button
                                        onClick={() => setHistoricoAberto(true)}
                                        className="inline-flex w-full items-center justify-center rounded-xl border border-hotel-blue/15 bg-hotel-blue/5 px-4 py-2.5 text-hotel-blue transition-colors hover:bg-hotel-blue/10 sm:w-auto sm:px-3"
                                        aria-label="Ver log de alterações"
                                        title="Ver log de alterações"
                                    >
                                        <Eye size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                )}
            </div>

            <ConfirmModal
                isOpen={Boolean(confirmDelete)}
                title="Excluir reunião"
                message="Tem certeza que deseja excluir esta reunião? Esta ação não pode ser desfeita."
                onConfirm={confirmarDelecao}
                onCancel={() => setConfirmDelete(null)}
                danger
            />

            <HistoricoReuniaoModal
                isOpen={historicoAberto}
                onClose={() => setHistoricoAberto(false)}
                historico={reuniaoSelecionada?.historico || []}
            />

            <ModalRecusa
                isOpen={modalRecusaAberto}
                onClose={() => setModalRecusaAberto(false)}
                onConfirm={handleRecusarParticipacao}
            />

            <FormularioReuniao
                isOpen={formularioAberto}
                onClose={() => { setFormularioAberto(false); setReuniaoEditando(null); }}
                onSave={handleSalvarReuniao}
                reuniaoEditando={reuniaoEditando}
                todosUsers={todosUsers}
                currentUserId={user?.id}
            />
        </AppLayout>
    );
}