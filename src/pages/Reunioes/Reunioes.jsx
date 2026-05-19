import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import {
    CalendarDays, Clock3, MapPin, X, Users,
    BellRing, Plus, CalendarRange, ChevronLeft, ChevronRight, Edit2, Trash2, AlertCircle, Save,
} from 'lucide-react';
import { useReuniao } from '../../context/ReuniaoContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { RecorrenciaLabel, StatusLabel, RecorrenciaReuniao } from '../../models/Reuniao';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths } from 'date-fns';
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
        onChange([...participantes, { id: user.id, nome: user.nome, email: user.email }]);
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
    };

    const [formData, setFormData] = useState(initialFormData);

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

export default function Reunioes() {
    const { reunioes, criarReuniao, atualizarReuniao, deletarReuniao, reunioesPorMes } = useReuniao();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { users: todosUsers } = useUsers();
    const [mesAtual, setMesAtual] = useState(new Date());
    const [formularioAberto, setFormularioAberto] = useState(false);
    const [reuniaoEditando, setReuniaoEditando] = useState(null);
    const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
    const [diaSelecionado, setDiaSelecionado] = useState(new Date());
    const [confirmDelete, setConfirmDelete] = useState(null); // id da reunião a deletar
    const detalheReuniaoRef = useRef(null);

    const diasMes = useMemo(() => {
        const inicio = startOfMonth(mesAtual);
        const fim = endOfMonth(mesAtual);
        return eachDayOfInterval({ start: inicio, end: fim });
    }, [mesAtual]);

    const reunioesDoMes = reunioesPorMes(mesAtual.getFullYear(), mesAtual.getMonth());

    const handleSalvarReuniao = async (dados) => {
        try {
            const dataCompleta = `${dados.data_inicio}T${dados.hora_inicio}`;
            const participanteIds = (dados.participantes || []).map((p) => p.id).filter(Boolean);
            const visivelPara = [...new Set([user?.id, ...participanteIds].filter(Boolean))];
            const payload = {
                ...dados,
                data_inicio: dataCompleta,
                data_fim: `${dados.data_inicio}T${dados.hora_fim}`,
                criado_por_id: user?.id,
                criado_por_nome: user?.nome,
                visivel_para: visivelPara,
            };

            if (reuniaoEditando?.id) {
                await atualizarReuniao(reuniaoEditando.id, payload);
                addNotification('Reunião atualizada com sucesso!', 'success');
            } else {
                await criarReuniao(payload);
                addNotification('Reunião criada com sucesso!', 'success');
            }

            setFormularioAberto(false);
            setReuniaoEditando(null);
        } catch (err) {
            addNotification(err.message, 'error');
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

    const reunioesPorDia = (data) => {
        return reunioesDoMes.filter((r) => {
            const dataReuniao = new Date(r.data_inicio);
            return isSameDay(dataReuniao, data);
        });
    };

    const totalReunioesHoje = reunioesDoMes.filter((r) => {
        const dataReuniao = new Date(r.data_inicio);
        return isSameDay(dataReuniao, new Date());
    }).length;

    const reunioesDiaSelecionado = reunioesPorDia(diaSelecionado);
    const proximaReuniao = reunioesDoMes.find((r) => new Date(r.data_inicio) >= new Date());

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
            return;
        }

        detalheReuniaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        detalheReuniaoRef.current?.focus?.({ preventScroll: true });
    }, [reuniaoSelecionada]);

    return (
        <AppLayout pageTitle="Reuniões">
            <div className="animate-fadeIn space-y-6">
                {/* Hero */}
                <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#07233a_0%,#0d4569_55%,#123b5d_100%)] text-white shadow-[0_24px_80px_rgba(4,21,35,0.22)]">
                    <div className="grid gap-8 px-6 py-7 lg:px-8 lg:py-8">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                                <CalendarRange size={14} className="text-hotel-gold" /> Administração
                            </div>
                            <h1 className="mt-4 max-w-xl font-heading text-3xl font-bold leading-tight lg:text-4xl">
                                Calendário de reuniões corporativas
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 lg:text-base">
                                Agende, gerencie salas, participantes, registre atas e acompanhe ações em um único ambiente.
                            </p>

                            <div className="mt-6">
                                <button
                                    onClick={() => { setReuniaoEditando(null); setFormularioAberto(true); }}
                                    className="inline-flex items-center gap-2 rounded-xl bg-hotel-gold px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-hotel-gold/20 transition-transform hover:-translate-y-0.5"
                                >
                                    <Plus size={16} /> Nova reunião
                                </button>
                            </div>
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
                                <p className="mt-1 text-xs text-hotel-gray-md">Clique em "Nova reunião" para agendar.</p>
                            </div>
                        ) : (
                            <div className="max-h-[420px] overflow-y-auto divide-y divide-hotel-gray/10">
                                {reunioesDoMes.map((reuniao) => {
                                    const isAtiva = reuniaoSelecionada?.id === reuniao.id;
                                    const dataR = new Date(reuniao.data_inicio);
                                    const isHoje = isSameDay(dataR, new Date());
                                    return (
                                        <button
                                            type="button"
                                            key={reuniao.id}
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
                                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                        {StatusLabel[reuniaoSelecionada.status]}
                                    </span>
                                </div>
                            </div>

                            {reuniaoSelecionada.participantes?.length > 0 && (
                                <div className="rounded-2xl border border-hotel-gray/50 bg-white px-4 py-4 shadow-[0_1px_0_rgba(4,21,35,0.02)]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hotel-gray-md">Participantes</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {reuniaoSelecionada.participantes.map((p) => (
                                            <span
                                                key={p.id}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-hotel-blue/10 bg-hotel-blue/10 px-3 py-1 text-xs font-semibold text-hotel-blue"
                                            >
                                                <Users size={11} /> {p.nome}
                                            </span>
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