import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle, Send, PlusCircle, Play, Check, ArrowRight, CalendarDays,
    Sparkles, Filter, ChevronDown, ChevronRight, Activity, TrendingUp
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import StatusObservacaoModal from '../../components/Modal/StatusObservacaoModal';
import DetalhesOSModal from '../../components/Modal/DetalhesOSModal';
import { useOS } from '../../context/OSContext';
import { matchesOrderActor, isPrimaryResponsible } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusOS, StatusLabel, PDCAStep } from '../../models/OrdemDeServico';
import { hasPermission, PERMISSIONS } from '../../services/permissions';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getApplicableDeadlineDate, getLeaderEstimatedDeadlineValue, isSIOverdue } from '../../utils/osDeadlineRules';
import { isOrderInSelectedDashboardMonth } from '../../utils/osMonthRules';

const DEPARTAMENTO_TESTE = 'Teste';
const TELEGRAM_PROMO_EVENT = 'hotelflow:open-telegram-banner';

function CustomSelect({ value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const selectedOption = options.find(o => o.value === value);

    return (
        <div ref={containerRef} className="relative flex-1 min-w-[120px] sm:min-w-[140px] font-body">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between gap-1.5 sm:gap-2 rounded-xl border border-hotel-gray/50 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-hotel-blue hover:border-hotel-gold/60 hover:bg-slate-50 transition-all cursor-pointer shadow-sm w-full min-w-0 sm:min-w-[140px]"
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown size={14} className={`text-hotel-blue/60 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute left-0 z-50 mt-1 max-h-60 w-full min-w-[150px] overflow-y-auto rounded-xl border border-hotel-gray/40 bg-white p-1.5 shadow-lg animate-fadeIn">
                    {placeholder && (
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false); }}
                            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-hotel-gray-md hover:bg-slate-50 transition-colors"
                        >
                            {placeholder}
                        </button>
                    )}
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => { onChange(option.value); setOpen(false); }}
                                className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors
                                            ${isSelected
                                                ? 'bg-hotel-light text-hotel-gold font-bold'
                                                : 'text-hotel-blue hover:bg-slate-50'}`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, value, type, onClick }) {
    const theme = {
        total: {
            iconBg: 'bg-slate-50 text-hotel-blue border border-slate-200/50',
            cardHover: 'hover:border-hotel-blue/30',
            accentBar: 'bg-hotel-blue'
        },
        abertas: {
            iconBg: 'bg-blue-50 text-blue-600 border border-blue-100/50',
            cardHover: 'hover:border-blue-400/30',
            accentBar: 'bg-blue-500'
        },
        em_andamento: {
            iconBg: 'bg-amber-50 text-amber-600 border border-amber-100/50',
            cardHover: 'hover:border-amber-400/30',
            accentBar: 'bg-amber-500'
        },
        concluidas: {
            iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100/50',
            cardHover: 'hover:border-emerald-400/30',
            accentBar: 'bg-emerald-500'
        },
        atrasadas: {
            iconBg: 'bg-red-50 text-red-600 border border-red-100/50',
            cardHover: 'hover:border-red-400/30',
            accentBar: 'bg-red-500 animate-pulse'
        }
    }[type || 'total'];

    return (
        <button
            onClick={onClick}
            className={`group relative overflow-hidden bg-white/95 border border-hotel-gray/40 p-5 rounded-2xl text-left transition-all duration-300 shadow-sm flex flex-col justify-between h-[115px]
                  ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-card-hover ' + theme.cardHover : 'cursor-default'}`}
        >
            {/* Top row */}
            <div className="flex items-start justify-between w-full">
                <span className="text-[10px] font-bold tracking-wider text-hotel-gray-md uppercase font-heading">
                    {label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${theme.iconBg}`}>
                    <Icon size={16} />
                </div>
            </div>

            {/* Value & subtle indicator */}
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-hotel-blue tracking-tight font-heading group-hover:text-hotel-blue-md transition-colors">
                    {value}
                </span>
            </div>

            {/* Top Accent Bar */}
            <div className={`absolute top-0 left-0 w-full h-[3px] ${theme.accentBar}`} />
        </button>
    );
}

function PDCAStatCard({ etapa, total, totalBase, onClick }) {
    const config = {
        [PDCAStep.PLAN]: { 
            label: 'Planejar', 
            color: 'text-red-500', 
            bg: 'bg-red-50/50', 
            border: 'border-red-100', 
            letterBg: 'bg-red-500',
            barColor: 'bg-red-500',
            hoverBorder: 'hover:border-red-300'
        },
        [PDCAStep.DO]: { 
            label: 'Executar', 
            color: 'text-blue-500', 
            bg: 'bg-blue-50/50', 
            border: 'border-blue-100', 
            letterBg: 'bg-blue-500',
            barColor: 'bg-blue-500',
            hoverBorder: 'hover:border-blue-300'
        },
        [PDCAStep.CHECK]: { 
            label: 'Checar', 
            color: 'text-amber-500', 
            bg: 'bg-amber-50/50', 
            border: 'border-amber-100', 
            letterBg: 'bg-amber-500',
            barColor: 'bg-amber-500',
            hoverBorder: 'hover:border-amber-300'
        },
        [PDCAStep.ACT]: { 
            label: 'Agir', 
            color: 'text-emerald-500', 
            bg: 'bg-emerald-50/50', 
            border: 'border-emerald-100', 
            letterBg: 'bg-emerald-500',
            barColor: 'bg-emerald-500',
            hoverBorder: 'hover:border-emerald-300'
        },
    };
    const { label, letterBg, barColor, hoverBorder } = config[etapa];
    const pct = totalBase > 0 ? Math.round((total / totalBase) * 100) : 0;

    return (
        <button
            onClick={onClick}
            className={`group bg-white/95 border border-hotel-gray/40 p-4 rounded-2xl text-left transition-all duration-300 shadow-sm flex flex-col justify-between h-[120px] hover:-translate-y-0.5 hover:shadow-card-hover ${hoverBorder} w-full`}
        >
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${letterBg} shadow-sm group-hover:scale-105 transition-transform`}>
                        <span className="font-heading text-sm font-black text-white">{etapa}</span>
                    </div>
                    <span className="text-xs font-bold text-hotel-blue/80 font-heading">{label}</span>
                </div>
                <span className="text-[10px] font-bold text-hotel-gray-md font-body">{pct}%</span>
            </div>

            <div className="mt-3">
                <p className="text-2xl font-extrabold text-hotel-blue tracking-tight font-heading leading-none">{total}</p>
                <p className="text-[10px] text-hotel-gray-md mt-1 font-body">Solicitações</p>
            </div>

            {/* Micro progress bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                <div 
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                    style={{ width: `${pct}%` }}
                />
            </div>
        </button>
    );
}

export default function DashboardLider() {
    const { getOSPorLider, atualizarStatus, error: ordensError } = useOS();
    const { user } = useAuth();
    const { lideres, currentUserProfile, updateTelegramChatId } = useUsers();
    const { addNotification } = useNotification();
    const navigate = useNavigate();
    const displayName = currentUserProfile?.nome || user?.nome;

    const [obsModal, setObsModal] = useState({ open: false, os: null, novoStatus: null });
    const [selectedOsId, setSelectedOsId] = useState(null);
    const [filterLider, setFilterLider] = useState('');
    const [tab, setTab] = useState('minhas');
    const [filterStatus, setFilterStatus] = useState('');
    const [telegramInput, setTelegramInput] = useState('');
    const [telegramSaving, setTelegramSaving] = useState(false);
    const [showTelegramForm, setShowTelegramForm] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
    const telegramBannerRef = useRef(null);

    const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'HotelFloww_Bot';
    const telegramBotLink = `https://t.me/${telegramBotUsername}`;

    const selectedMonthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth]);
    const actor = currentUserProfile || user;
    const canFinalizeSI = hasPermission(actor, PERMISSIONS.SI_FINALIZE);
    const actorDepartments = actor?.departamentos || [];

    const ordens = useMemo(
        () => getOSPorLider(actorDepartments, actor),
        [getOSPorLider, actorDepartments, actor],
    );
    const ordensSemTeste = useMemo(
        () => ordens.filter((o) => o.departamento !== DEPARTAMENTO_TESTE),
        [ordens],
    );

    // SIs do mês selecionado considerando criação, herança do mês anterior e mês real de conclusão
    const ordensMes = useMemo(
        () => ordensSemTeste.filter((o) => isOrderInSelectedDashboardMonth(o, selectedMonthDate)),
        [ordensSemTeste, selectedMonthDate],
    );

    const minhasSIs = useMemo(
        () => ordensMes.filter((o) => {
            const isResp = matchesOrderActor(o, actor, 'responsavel');
            const isInDept = actorDepartments && actorDepartments.includes(o.departamento);
            return isResp || isInDept;
        }),
        [ordensMes, actor, actorDepartments],
    );

    const abertosPorMim = useMemo(
        () => ordensMes.filter((o) => matchesOrderActor(o, actor, 'criado_por')),
        [ordensMes, actor],
    );

    const currentTabList = useMemo(() => {
        if (tab === 'minhas') return minhasSIs;
        if (tab === 'abertas') return abertosPorMim;
        return [];
    }, [tab, minhasSIs, abertosPorMim]);

    const filteredList = useMemo(() => {
        let list = currentTabList;

        if (filterLider) {
            const selectedLeader = lideres.find((l) => l.id === filterLider);
            if (selectedLeader) {
                list = list.filter((o) => matchesOrderActor(o, selectedLeader, 'responsavel'));
            }
        }

        if (filterStatus) {
            list = list.filter((o) => o.status === filterStatus);
        }
        return list;
    }, [currentTabList, filterLider, filterStatus, lideres]);

    const stats = useMemo(() => ({
        total: minhasSIs.length,
        abertas: minhasSIs.filter((o) => o.status === StatusOS.ABERTO).length,
        em_andamento: minhasSIs.filter((o) => o.status === StatusOS.EM_ANDAMENTO).length,
        concluidas: minhasSIs.filter((o) => o.status === StatusOS.CONCLUIDO).length,
        atrasadas: minhasSIs.filter(isSIOverdue).length,
    }), [minhasSIs]);

    const pdcaStats = useMemo(() => ({
        [PDCAStep.PLAN]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.PLAN).length,
        [PDCAStep.DO]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.DO).length,
        [PDCAStep.CHECK]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.CHECK).length,
        [PDCAStep.ACT]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.ACT).length,
    }), [minhasSIs]);

    const totalPdca = useMemo(() => {
        return Object.values(pdcaStats).reduce((sum, val) => sum + val, 0);
    }, [pdcaStats]);

    // OS urgentes (prazo em até 2 dias, não concluídas)
    const urgentes = useMemo(() =>
        minhasSIs
            .filter((o) => o.status !== StatusOS.CONCLUIDO)
            .filter((o) => {
                const deadline = getApplicableDeadlineDate(o);
                const officialDeadline = o.prazo ? parseISO(o.prazo) : null;

                // Se o prazo aplicável está vencido ou vence em até 2 dias, é urgente
                if (deadline) {
                    if (isSIOverdue(o)) return true;
                    if (differenceInDays(deadline, new Date()) <= 2) return true;
                }

                // Se o prazo oficial está vencido ou vence em até 2 dias, também inclui
                if (officialDeadline) {
                    if (differenceInDays(officialDeadline, new Date()) <= 2) return true;
                }

                return false;
            })
            .sort((a, b) => {
                const aAtrasada = isSIOverdue(a);
                const bAtrasada = isSIOverdue(b);

                // 1. As atrasadas sempre devem ficar em primeiro
                if (aAtrasada && !bAtrasada) return -1;
                if (!aAtrasada && bAtrasada) return 1;

                // 2. Ordena pela data do prazo aplicável (da mais próxima de vencer para a mais longe)
                const dateA = getApplicableDeadlineDate(a);
                const dateB = getApplicableDeadlineDate(b);

                if (!dateA && dateB) return 1;
                if (dateA && !dateB) return -1;
                if (!dateA && !dateB) return 0;

                return new Date(dateA) - new Date(dateB);
            }),
        [minhasSIs],
    );

    const nextStatus = {
        [StatusOS.ABERTO]: StatusOS.EM_ANDAMENTO,
        [StatusOS.EM_ANDAMENTO]: StatusOS.CONCLUIDO,
    };

    const nextStatusLabel = {
        [StatusOS.ABERTO]: 'Iniciar',
        [StatusOS.EM_ANDAMENTO]: 'Concluir',
    };

    const solicitarStatus = async (os, status) => {
        // Ao iniciar, não exige observação — o líder ainda vai ler e trabalhar na OS
        if (status === StatusOS.EM_ANDAMENTO) {
            await atualizarStatus(os.id, status, actor, '');
            addNotification(`SI "${os.titulo}" iniciada.`, 'info');
            return;
        }
        setObsModal({ open: true, os, novoStatus: status });
    };

    const confirmarStatus = async (observacao) => {
        const { os, novoStatus } = obsModal;
        setObsModal({ open: false, os: null, novoStatus: null });
        await atualizarStatus(os.id, novoStatus, actor, observacao);
        addNotification(
            `SI "${os.titulo}" atualizada para ${StatusLabel[novoStatus]}.`,
            novoStatus === StatusOS.CONCLUIDO ? 'success' : 'info',
        );
    };

    const handleSaveTelegram = async () => {
        const chatId = telegramInput.trim();
        if (!chatId || !/^\d+$/.test(chatId)) {
            addNotification('ID inválido. Cole apenas os números que o bot enviou.', 'error');
            return;
        }
        setTelegramSaving(true);
        try {
            await updateTelegramChatId(chatId);
            addNotification('Telegram conectado com sucesso! 🎉 Você receberá notificações de novas SIs.', 'success');
            setShowTelegramForm(false);
            setTelegramInput('');
        } catch {
            addNotification('Erro ao salvar ID do Telegram. Tente novamente.', 'error');
        } finally {
            setTelegramSaving(false);
        }
    };

    useEffect(() => {
        const openTelegramBanner = () => {
            if (currentUserProfile?.telegram_chat_id) return;
            setShowTelegramForm(true);
            telegramBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            sessionStorage.removeItem(TELEGRAM_PROMO_EVENT);
        };

        if (sessionStorage.getItem(TELEGRAM_PROMO_EVENT) === '1') {
            openTelegramBanner();
        }

        window.addEventListener(TELEGRAM_PROMO_EVENT, openTelegramBanner);
        return () => window.removeEventListener(TELEGRAM_PROMO_EVENT, openTelegramBanner);
    }, [currentUserProfile?.telegram_chat_id]);

    const navigateToOrders = (state = {}) => navigate('/ordens', { state: { selectedMonth, viewMode: 'todos', ...state } });

    return (
        <>
            <AppLayout pageTitle="Dashboard">
                <div className="relative overflow-visible">
                    {/* Ambient background glows */}
                    <div className="pointer-events-none absolute -top-40 right-10 h-72 w-72 rounded-full bg-hotel-gold/10 blur-3xl" />
                    <div className="pointer-events-none absolute -left-20 top-60 h-80 w-80 rounded-full bg-hotel-blue/5 blur-3xl" />

                    {ordensError && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700">
                            {ordensError}
                        </div>
                    )}

                    {/* Saudação */}
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative z-10">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-heading text-2xl text-hotel-blue">
                                    <span className="font-light">Olá, </span>
                                    <span className="font-extrabold">{displayName}</span>
                                </h1>
                                <Sparkles size={20} className="text-hotel-gold animate-pulse shrink-0" />
                            </div>
                            <p className="text-hotel-gray-md font-body text-xs mt-1 capitalize">
                                {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {/* Filtro por mês */}
                            <div className="relative h-9 w-9 flex items-center justify-center rounded-xl border border-hotel-gray/50 bg-white shadow-sm hover:border-hotel-gold/60 hover:bg-slate-50 transition-all cursor-pointer" title="Filtrar por Mês">
                                <Filter size={14} className="text-hotel-blue" />
                                <input
                                    id="dashboard-mes"
                                    name="dashboard-mes"
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(event) => setSelectedMonth(event.target.value)}
                                    onClick={(event) => event.currentTarget.showPicker?.()}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                            
                            <button
                                onClick={() => navigate('/nova-os')}
                                className="btn-gold inline-flex items-center justify-center gap-2 px-4 py-2 text-sm"
                            >
                                <PlusCircle size={16} /> Nova SI
                            </button>
                        </div>
                    </div>


                    {currentUserProfile?.telegram_chat_id && (
                        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 relative z-10 animate-fadeIn">
                            <Send size={16} className="text-emerald-500" />
                            <p className="text-emerald-700 font-body text-xs font-semibold">
                                Telegram conectado — você receberá notificações de novas SIs ✓
                            </p>
                        </div>
                    )}

                    {/* Cards de estatísticas */}
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 relative z-10">
                        <StatCard
                            icon={ClipboardList}
                            label="Total de SIs"
                            value={stats.total}
                            type="total"
                            onClick={() => navigateToOrders({ onlyMine: true })}
                        />
                        <StatCard
                            icon={AlertCircle}
                            label="Abertas"
                            value={stats.abertas}
                            type="abertas"
                            onClick={() => navigateToOrders({ filterStatus: StatusOS.ABERTO, onlyMine: true })}
                        />
                        <StatCard
                            icon={Clock}
                            label="Em Andamento"
                            value={stats.em_andamento}
                            type="em_andamento"
                            onClick={() => navigateToOrders({ filterStatus: StatusOS.EM_ANDAMENTO, onlyMine: true })}
                        />
                        <StatCard
                            icon={CheckCircle2}
                            label="Concluídas"
                            value={stats.concluidas}
                            type="concluidas"
                            onClick={() => navigateToOrders({ filterStatus: StatusOS.CONCLUIDO, onlyMine: true })}
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Atrasadas"
                            value={stats.atrasadas}
                            type="atrasadas"
                            onClick={() => navigateToOrders({ onlyOverdue: true, onlyMine: true })}
                        />
                    </div>

                    {/* Ciclo PDCA */}
                    <div className="mb-8 space-y-3 relative z-10 animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-hotel-blue/70" />
                            <h3 className="font-heading font-bold text-sm tracking-tight text-hotel-blue/90">
                                Ciclo de Melhoria Contínua (PDCA)
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            <PDCAStatCard
                                etapa={PDCAStep.PLAN}
                                total={pdcaStats[PDCAStep.PLAN]}
                                totalBase={totalPdca}
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.PLAN, pdcaOnly: true, onlyMine: true })}
                            />
                            <PDCAStatCard
                                etapa={PDCAStep.DO}
                                total={pdcaStats[PDCAStep.DO]}
                                totalBase={totalPdca}
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.DO, pdcaOnly: true, onlyMine: true })}
                            />
                            <PDCAStatCard
                                etapa={PDCAStep.CHECK}
                                total={pdcaStats[PDCAStep.CHECK]}
                                totalBase={totalPdca}
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.CHECK, pdcaOnly: true, onlyMine: true })}
                            />
                            <PDCAStatCard
                                etapa={PDCAStep.ACT}
                                total={pdcaStats[PDCAStep.ACT]}
                                totalBase={totalPdca}
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.ACT, pdcaOnly: true, onlyMine: true })}
                            />
                        </div>
                    </div>

                    {/* Grid de Conteúdo Principal */}
                    <div className="grid gap-6 lg:grid-cols-3 relative z-10">
                        {/* Todas as OS */}
                        <div className="flex flex-col rounded-3xl border border-hotel-gray/30 bg-white p-4 sm:p-6 shadow-sm lg:col-span-2 min-h-[480px] h-[520px] sm:h-[560px] animate-fadeIn">
                            <div className="mb-3 sm:mb-4">
                                <h3 className="font-heading font-semibold text-hotel-blue text-sm sm:text-base">
                                    Solicitações Internas
                                </h3>
                            </div>

                            {/* Alternador de Abas (Modo Cápsula) */}
                            <div className="mb-3 sm:mb-4 flex items-center gap-1 bg-hotel-light p-1 rounded-xl w-full sm:w-fit border border-hotel-gray/30 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setTab('minhas')}
                                    className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 text-center ${
                                        tab === 'minhas'
                                            ? 'bg-white text-hotel-blue shadow-sm'
                                            : 'text-hotel-gray-md hover:text-hotel-blue'
                                    }`}
                                >
                                    Minhas SIs ({minhasSIs.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTab('abertas')}
                                    className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 text-center ${
                                        tab === 'abertas'
                                            ? 'bg-white text-hotel-blue shadow-sm'
                                            : 'text-hotel-gray-md hover:text-hotel-blue'
                                    }`}
                                >
                                    SIs abertas por mim ({abertosPorMim.length})
                                </button>
                            </div>

                            {/* Filtros */}
                            <div className="flex flex-wrap gap-2.5 sm:gap-3 mb-3 sm:mb-4 items-center">
                                <CustomSelect
                                    value={filterLider}
                                    onChange={setFilterLider}
                                    options={lideres.map((l) => ({ value: l.id, label: l.nome }))}
                                    placeholder="Todos os líderes"
                                />
                                <CustomSelect
                                    value={filterStatus}
                                    onChange={setFilterStatus}
                                    options={Object.entries(StatusLabel).map(([k, v]) => ({ value: k, label: v }))}
                                    placeholder="Todos os status"
                                />
                                {(filterLider || filterStatus) && (
                                    <button
                                        onClick={() => { setFilterLider(''); setFilterStatus(''); }}
                                        className="text-xs font-semibold text-hotel-gray-md hover:text-red-500 transition-colors px-2 py-1"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </div>

                            {/* Lista da aba ativa com scroll independente */}
                            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-2.5">
                                {filteredList.length === 0 ? (
                                    <p className="text-center text-hotel-gray-md text-sm py-10">Nenhuma SI encontrada com os filtros selecionados.</p>
                                ) : (
                                    filteredList.map((os) => {
                                        const atrasada = isSIOverdue(os);
                                        const prazoEstimadoCard = getLeaderEstimatedDeadlineValue(os);
                                        const isResponsavel = matchesOrderActor(os, actor, 'responsavel');
                                        const isCriador = matchesOrderActor(os, actor, 'criado_por');
                                        const isInDept = actorDepartments && actorDepartments.includes(os.departamento);
                                        const isActStage = os.etapa_pdca === PDCAStep.ACT;
                                        const isManagement = actor?.role === 'diretora' || actor?.role === 'admin';
                                        const canReopen = (os.status === StatusOS.CONCLUIDO || (isActStage && os.status !== StatusOS.EM_ANDAMENTO)) && (isManagement || isCriador || isResponsavel);

                                        const canConclude = isCriador || (canFinalizeSI && hasPermission(actor, PERMISSIONS.SI_FINALIZE));
                                        const canStart = os.status === StatusOS.ABERTO && (isResponsavel || isCriador || isInDept);
                                        const canConcludeLider = os.status === StatusOS.EM_ANDAMENTO && (isCriador || (isResponsavel && canConclude));
                                        const podeAtualizar = !canReopen && (canStart || canConcludeLider);

                                        return (
                                            <div
                                                key={os.id}
                                                onClick={() => setSelectedOsId(os.id)}
                                                className={`group relative flex flex-col justify-between rounded-xl border border-hotel-gray/40 bg-white p-3 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer border-l-4
                                                    ${atrasada ? 'border-l-red-500' : os.status === StatusOS.CONCLUIDO ? 'border-l-emerald-500' : os.status === StatusOS.EM_ANDAMENTO ? 'border-l-amber-500' : 'border-l-blue-500'}`}
                                            >
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start w-full">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                                                            <StatusBadge status={os.status} />
                                                            <PDCABadge etapa={os.etapa_pdca} status={os.status} compact />
                                                            <span className="text-xs text-hotel-gray-md font-body bg-hotel-gray px-2 py-0.5 rounded-full">
                                                                {os.departamento}
                                                            </span>
                                                            {atrasada && (
                                                                <span className="text-xs text-red-600 font-semibold">⚠ Atrasada</span>
                                                            )}
                                                        </div>
                                                        <p className="font-semibold font-body text-hotel-blue text-xs sm:text-sm mt-1 line-clamp-2 sm:truncate">{os.titulo}</p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-body">
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-hotel-gray/60 bg-hotel-light px-2 py-0.5 text-hotel-gray-md">
                                                                Prazo oficial:
                                                                <strong className={atrasada ? 'text-red-500' : 'text-hotel-blue'}>
                                                                    {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                                                </strong>
                                                            </span>
                                                            {prazoEstimadoCard && (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-hotel-gray/60 bg-hotel-light px-2 py-0.5 text-hotel-gray-md">
                                                                    Prazo do líder:
                                                                    <strong className="text-hotel-gold">{format(parseISO(prazoEstimadoCard), 'dd/MM/yyyy')}</strong>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end self-stretch sm:self-center shrink-0">
                                                        {podeAtualizar && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); solicitarStatus(os, nextStatus[os.status]); }}
                                                                className="btn-gold flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-center text-xs w-24 flex items-center justify-center"
                                                                title={nextStatusLabel[os.status]}
                                                            >
                                                                {os.status === StatusOS.ABERTO ? <Play size={14} className="mr-1" /> : <Check size={14} className="mr-1" />}
                                                                {nextStatusLabel[os.status]}
                                                            </button>
                                                        )}
                                                        {canReopen && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); solicitarStatus(os, StatusOS.EM_ANDAMENTO); }}
                                                                className="flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-center text-xs w-24 flex items-center justify-center gap-1 rounded-lg border border-hotel-blue/60 bg-hotel-blue/10 text-hotel-blue hover:bg-hotel-blue hover:text-white transition-colors"
                                                                title="Reativar SI"
                                                            >
                                                                <Play size={14} /> Reativar
                                                            </button>
                                                        )}
                                                        <ChevronRight size={16} className="text-hotel-blue/30 group-hover:text-hotel-gold transition-colors shrink-0" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {filteredList.length > 8 && (
                                <button
                                    onClick={() => navigate('/ordens', { state: { viewMode: 'todos' } })}
                                    className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-hotel-gold/30 bg-gradient-to-r from-hotel-gold/10 via-white to-hotel-blue/5 px-4 py-2.5 text-sm font-semibold text-hotel-blue shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-hotel-gold/60 hover:text-hotel-gold hover:shadow-md shrink-0"
                                >
                                    Ver todas <ArrowRight size={14} />
                                </button>
                            )}
                        </div>

                        {/* Urgentes */}
                        <div className="flex flex-col rounded-3xl border border-hotel-gray/30 bg-white p-4 sm:p-6 shadow-sm min-h-[480px] h-[520px] sm:h-[560px] animate-fadeIn">
                            <h3 className="font-heading font-semibold text-hotel-blue text-base mb-4 flex items-center gap-2">
                                <AlertCircle size={18} className="text-amber-500" /> Urgentes / Próximas
                            </h3>
                            
                            {urgentes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-3 flex-1">
                                    <CheckCircle2 size={36} className="text-emerald-400 font-bold" />
                                    <p className="text-sm text-hotel-gray-md font-body text-center">
                                        Nenhuma SI urgente. Ótimo trabalho!
                                    </p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3">
                                    {urgentes.map((os) => {
                                        const atrasoRef = getApplicableDeadlineDate(os);
                                        const dias = atrasoRef ? differenceInDays(atrasoRef, new Date()) : null;
                                        const atrasada = isSIOverdue(os);
                                        return (
                                            <button
                                                key={os.id}
                                                onClick={() => setSelectedOsId(os.id)}
                                                className={`w-full text-left p-3 rounded-lg border-l-4 transition-all hover:shadow-card cursor-pointer
                                                        ${atrasada ? 'border-red-400 bg-red-50 hover:bg-red-100' : 'border-amber-400 bg-amber-50 hover:bg-amber-100'}`}
                                            >
                                                <p className="text-sm font-semibold font-body text-hotel-blue leading-snug">{os.titulo}</p>
                                                <p className="text-xs mt-1 font-body font-semibold">
                                                    {atrasada
                                                        ? <span className="text-red-500 font-bold">Atrasada {Math.abs(dias || 0)}d — clique para ver</span>
                                                        : atrasoRef
                                                            ? <span className="text-amber-600">Vence em {dias === 0 ? 'hoje' : `${dias}d`} — clique para ver</span>
                                                            : <span className="text-amber-600">Em andamento sem prazo do líder — clique para ver</span>
                                                    }
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </AppLayout>
            <StatusObservacaoModal
                isOpen={obsModal.open}
                os={obsModal.os}
                novoStatus={obsModal.novoStatus}
                onConfirm={confirmarStatus}
                onCancel={() => setObsModal({ open: false, os: null, novoStatus: null })}
            />

            <DetalhesOSModal
                isOpen={!!selectedOsId}
                osId={selectedOsId}
                onClose={() => setSelectedOsId(null)}
            />
        </>
    );
}
