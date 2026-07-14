
function belongsToLeader(os, leader) {
    if (!os || !leader) return false;

    if (
        os.responsavel_id === leader.id
        || (leader.firebaseUid && os.responsavel_uid === leader.firebaseUid)
        || (leader.email && os.responsavel_email?.toLowerCase() === leader.email.toLowerCase())
    ) {
        return true;
    }

    return Array.isArray(os.co_responsaveis) && os.co_responsaveis.some((responsavel) => (
        responsavel.id === leader.id
        || (leader.firebaseUid && responsavel.uid === leader.firebaseUid)
        || (leader.email && responsavel.email?.toLowerCase() === leader.email.toLowerCase())
    ));
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle,
    Users, TrendingUp, ArrowRight, Send, PlusCircle, CalendarDays,
    Calendar, ChevronRight, Info, Activity, Sparkles, Filter, ChevronDown,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusOS, StatusLabel, PDCAStep } from '../../models/OrdemDeServico';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLeaderEstimatedDeadlineValue, isSIOverdue } from '../../utils/osDeadlineRules';
import { isOrderInSelectedDashboardMonth } from '../../utils/osMonthRules';

const DEPARTAMENTO_TESTE = 'Teste';
const TELEGRAM_PROMO_EVENT = 'hotelflow:open-telegram-banner';

function CustomSelect({ value, onChange, options, placeholder }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div ref={containerRef} className="relative flex-1 min-w-[140px] font-body">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 bg-white border border-hotel-gray/50 rounded-xl px-3 py-1.5 text-xs font-semibold text-hotel-blue shadow-sm outline-none hover:border-hotel-gold/60 focus:border-hotel-gold focus:ring-2 focus:ring-hotel-gold/10 transition-all cursor-pointer"
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown size={14} className={`text-hotel-blue/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-hotel-gray/30 bg-white py-1 shadow-lg max-h-60 overflow-y-auto min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                        type="button"
                        onClick={() => { onChange(''); setIsOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${!value ? 'bg-hotel-light text-hotel-gold font-bold' : 'text-hotel-blue hover:bg-slate-50'}`}
                    >
                        {placeholder}
                    </button>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors truncate ${value === opt.value ? 'bg-hotel-light text-hotel-gold font-bold' : 'text-hotel-blue hover:bg-slate-50'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
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
    const { label, color, bg, border, letterBg, barColor, hoverBorder } = config[etapa];
    const pct = totalBase > 0 ? Math.round((total / totalBase) * 100) : 0;

    return (
        <button
            onClick={onClick}
            className={`group bg-white/95 border border-hotel-gray/40 p-4 rounded-2xl text-left transition-all duration-300 shadow-sm flex flex-col justify-between h-[120px] hover:-translate-y-0.5 hover:shadow-card-hover ${hoverBorder}`}
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

export default function DashboardDiretora() {
    const { ordens, error: ordensError } = useOS();
    const { user } = useAuth();
    const { lideres, currentUserProfile, updateTelegramChatId } = useUsers();
    const navigate = useNavigate();
    const displayName = currentUserProfile?.nome || user?.nome;
    const isAdmin = (currentUserProfile?.role || user?.role) === 'admin';

    const [filterLider, setFilterLider] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [tab, setTab] = useState('todas'); // 'todas' ou 'minhas'
    const [telegramInput, setTelegramInput] = useState('');
    const [telegramSaving, setTelegramSaving] = useState(false);
    const [showTelegramForm, setShowTelegramForm] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
    const telegramBannerRef = useRef(null);

    const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'HotelFloww_Bot';
    const telegramBotLink = `https://t.me/${telegramBotUsername}`;

    const { addNotification } = useNotification();

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

    const selectedMonthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth]);
    const ordensSemTeste = useMemo(
        () => ordens.filter((o) => o.departamento !== DEPARTAMENTO_TESTE),
        [ordens],
    );

    // SIs do mês selecionado considerando criação, herança do mês anterior e mês real de conclusão
    const ordensMes = useMemo(
        () => ordensSemTeste.filter((o) => isOrderInSelectedDashboardMonth(o, selectedMonthDate)),
        [ordensSemTeste, selectedMonthDate],
    );

    const stats = useMemo(() => ({
        total: ordensMes.length,
        abertas: ordensMes.filter((o) => o.status === StatusOS.ABERTO).length,
        em_andamento: ordensMes.filter((o) => o.status === StatusOS.EM_ANDAMENTO).length,
        concluidas: ordensMes.filter((o) => o.status === StatusOS.CONCLUIDO).length,
        atrasadas: ordensMes.filter((o) => isSIOverdue(o)).length,
    }), [ordensMes]);

    // SIs designadas para Sofia no mês atual
    const minhasSIs = useMemo(() => {
        return ordensMes.filter((os) =>
            belongsToLeader(os, user)
        );
    }, [ordensMes, user]);

    const pdcaBase = tab === 'minhas' ? minhasSIs : ordensMes;

    const pdcaStats = useMemo(() => ({
        [PDCAStep.PLAN]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.PLAN).length,
        [PDCAStep.DO]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.DO).length,
        [PDCAStep.CHECK]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.CHECK).length,
        [PDCAStep.ACT]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.ACT).length,
    }), [pdcaBase]);

    const totalPdca = useMemo(() => {
        return pdcaStats[PDCAStep.PLAN] + pdcaStats[PDCAStep.DO] + pdcaStats[PDCAStep.CHECK] + pdcaStats[PDCAStep.ACT];
    }, [pdcaStats]);

    const base = tab === 'minhas' ? minhasSIs : ordensMes;

    const ordensFiltradas = useMemo(() => {
        const selectedLeader = lideres.find((l) => l.id === filterLider) || null;

        return base
            .filter((o) => !selectedLeader || belongsToLeader(o, selectedLeader))
            .filter((o) => !filterStatus || o.status === filterStatus)
            .slice(0, 8);
    }, [base, filterLider, filterStatus, lideres]);

    const navigateToOrders = (state = {}) => navigate('/ordens', { state: { selectedMonth, viewMode: 'todos', ...state } });

    const getInitials = (name) => {
        if (!name) return '';
        const parts = name.split(' ').filter(Boolean);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const gradients = [
        'from-blue-500 to-indigo-600',
        'from-emerald-400 to-teal-600',
        'from-amber-400 to-orange-500',
        'from-purple-500 to-pink-600',
        'from-rose-400 to-red-600',
    ];

    return (
        <AppLayout pageTitle={isAdmin ? 'Dashboard — Administradora' : 'Dashboard — Diretora'}>
            <div className="relative min-h-full">
                {/* Ambient background glows */}
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-hotel-gold/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-10 left-10 w-80 h-80 bg-hotel-blue/5 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="relative z-10 space-y-6">
                    {ordensError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700">
                            {ordensError}
                        </div>
                    )}
                    
                    {/* Saudação e controles */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="font-heading text-2xl font-extrabold text-hotel-blue tracking-tight sm:text-3xl flex items-center gap-2">
                                <span className="font-light text-hotel-blue/70">Olá,</span> {displayName}!
                                <Sparkles size={24} className="text-hotel-gold animate-pulse flex-shrink-0" />
                            </h1>
                            <div className="text-hotel-gray-md font-body text-xs mt-1.5 flex items-center gap-1.5">
                                <Calendar size={13} className="text-hotel-gray-md/80" />
                                <span>{format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
                            {/* Selector de Mes (Botão de Filtro) */}
                            <div className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl border border-hotel-gray/50 bg-white text-hotel-blue hover:border-hotel-gold/60 hover:bg-slate-50 transition-all shadow-sm cursor-pointer" title={`Filtrar mês: ${format(selectedMonthDate, "MMMM 'de' yyyy", { locale: ptBR })}`}>
                                <Filter size={16} className="text-hotel-blue/70" />
                                <input
                                    id="diretora-mes"
                                    name="diretora-mes"
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(event) => setSelectedMonth(event.target.value)}
                                    onClick={(event) => event.currentTarget.showPicker?.()}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>

                            <button
                                onClick={() => navigate('/nova-os')}
                                className="btn-gold inline-flex items-center justify-center gap-2 px-4 py-2 text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
                            >
                                <PlusCircle size={15} /> Nova SI
                            </button>
                        </div>
                    </div>




                    {/* Cards de estatísticas */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                        <StatCard
                            icon={ClipboardList}
                            label="Total de SIs"
                            value={stats.total}
                            type="total"
                            onClick={() => navigateToOrders()}
                        />
                        <StatCard
                            icon={AlertCircle}
                            label="Abertas"
                            value={stats.abertas}
                            type="abertas"
                            onClick={() => navigateToOrders({ filterStatus: StatusOS.ABERTO })}
                        />
                        <StatCard
                            icon={Clock}
                            label="Em Andamento"
                            value={stats.em_andamento}
                            type="em_andamento"
                            onClick={() => navigateToOrders({ filterStatus: StatusOS.EM_ANDAMENTO })}
                        />
                        <StatCard
                            icon={CheckCircle2}
                            label="Concluídas"
                            value={stats.concluidas}
                            type="concluidas"
                            onClick={() => navigateToOrders({ filterStatus: StatusOS.CONCLUIDO })}
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Atrasadas"
                            value={stats.atrasadas}
                            type="atrasadas"
                            onClick={() => navigateToOrders({ onlyOverdue: true })}
                        />
                    </div>

                    {/* Ciclo PDCA */}
                    <div className="space-y-3">
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
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.PLAN, pdcaOnly: true, onlyMine: tab === 'minhas' })}
                            />
                            <PDCAStatCard
                                etapa={PDCAStep.DO}
                                total={pdcaStats[PDCAStep.DO]}
                                totalBase={totalPdca}
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.DO, pdcaOnly: true, onlyMine: tab === 'minhas' })}
                            />
                            <PDCAStatCard
                                etapa={PDCAStep.CHECK}
                                total={pdcaStats[PDCAStep.CHECK]}
                                totalBase={totalPdca}
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.CHECK, pdcaOnly: true, onlyMine: tab === 'minhas' })}
                            />
                            <PDCAStatCard
                                etapa={PDCAStep.ACT}
                                total={pdcaStats[PDCAStep.ACT]}
                                totalBase={totalPdca}
                                onClick={() => navigateToOrders({ filterPdca: PDCAStep.ACT, pdcaOnly: true, onlyMine: tab === 'minhas' })}
                            />
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* OS Recentes com filtros */}
                        <div className="lg:col-span-2 h-[560px] bg-white/95 border border-hotel-gray/40 rounded-2xl shadow-sm p-6 flex flex-col animate-fadeIn">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-4">
                                <div>
                                    <h3 className="font-heading font-bold text-hotel-blue text-base">
                                        Solicitações Internas
                                    </h3>
                                    <p className="text-[11px] text-hotel-gray-md font-body mt-0.5">
                                        Acompanhe e filtre as ordens de serviço ativas.
                                    </p>
                                </div>

                                {/* Abas Capsule */}
                                <div className="bg-slate-100/80 p-0.5 rounded-xl flex gap-0.5 self-start sm:self-center">
                                    <button
                                        onClick={() => { setTab('todas'); setFilterLider(''); setFilterStatus(''); }}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                                            tab === 'todas' 
                                                ? 'bg-white text-hotel-blue shadow-sm' 
                                                : 'text-hotel-gray-md hover:text-hotel-blue'
                                        }`}
                                    >
                                        Todas
                                    </button>
                                    <button
                                        onClick={() => { setTab('minhas'); setFilterLider(''); setFilterStatus(''); }}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                                            tab === 'minhas' 
                                                ? 'bg-white text-hotel-blue shadow-sm' 
                                                : 'text-hotel-gray-md hover:text-hotel-blue'
                                        }`}
                                    >
                                        Minhas SIs ({minhasSIs.length})
                                    </button>
                                </div>
                            </div>

                            {/* Filtros */}
                            <div className="flex flex-wrap gap-3 mb-4">
                                {tab === 'todas' && (
                                    <CustomSelect
                                        value={filterLider}
                                        onChange={setFilterLider}
                                        options={lideres.map(l => ({ value: l.id, label: l.nome }))}
                                        placeholder="Todos os líderes"
                                    />
                                )}
                                <CustomSelect
                                    value={filterStatus}
                                    onChange={setFilterStatus}
                                    options={Object.entries(StatusLabel).map(([k, v]) => ({ value: k, label: v }))}
                                    placeholder="Todos os status"
                                />
                                {((tab === 'todas' && filterLider) || filterStatus) && (
                                    <button
                                        onClick={() => { setFilterLider(''); setFilterStatus(''); }}
                                        className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors px-2"
                                    >
                                        Limpar Filtros
                                    </button>
                                )}
                            </div>

                            {/* Lista */}
                            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0">
                                {ordensFiltradas.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-hotel-gray/60 rounded-2xl bg-slate-50/50">
                                        <Info size={24} className="text-hotel-gray-md mb-2" />
                                        <p className="text-center text-hotel-gray-md text-sm font-body">
                                            Nenhuma SI encontrada com os filtros selecionados.
                                        </p>
                                    </div>
                                ) : (
                                    ordensFiltradas.map((os) => {
                                        const atrasada = isSIOverdue(os);
                                        const prazoEstimadoCard = getLeaderEstimatedDeadlineValue(os);
                                        
                                        const statusColors = {
                                            [StatusOS.ABERTO]: 'border-l-blue-500',
                                            [StatusOS.EM_ANDAMENTO]: 'border-l-amber-500',
                                            [StatusOS.CONCLUIDO]: 'border-l-emerald-500',
                                        };
                                        const leftBorderColor = atrasada ? 'border-l-red-500' : (statusColors[os.status] || 'border-l-hotel-blue');

                                        return (
                                            <div
                                                key={os.id}
                                                className={`p-4 rounded-xl border border-hotel-gray/40 border-l-4 ${leftBorderColor} transition-all duration-200 cursor-pointer bg-white hover:bg-slate-50/30 hover:shadow-sm hover:translate-x-0.5`}
                                                onClick={() => navigate('/ordens', { state: { expandOsId: os.id } })}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                            <StatusBadge status={os.status} />
                                                            <PDCABadge etapa={os.etapa_pdca} status={os.status} compact />
                                                            <span className="text-[10px] text-hotel-gray-md font-bold uppercase tracking-wider bg-hotel-gray/50 px-2.5 py-0.5 rounded-md">
                                                                {os.departamento}
                                                            </span>
                                                            {atrasada && (
                                                                <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50/80 px-2 py-0.5 text-[10px] font-bold text-red-600 animate-pulse">
                                                                    ⚠ Atrasada
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="font-semibold font-body text-hotel-blue text-sm hover:text-hotel-gold transition-colors truncate">
                                                            {os.titulo}
                                                        </p>

                                                        {/* Deadlines row below title */}
                                                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] font-body text-hotel-gray-md">
                                                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                                                                <span>Prazo oficial:</span>
                                                                <strong className={atrasada ? 'text-red-500' : 'text-hotel-blue'}>
                                                                    {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                                                </strong>
                                                            </div>
                                                            {prazoEstimadoCard && (
                                                                <div className="flex items-center gap-1 bg-hotel-light border border-hotel-gray/30 px-2 py-0.5 rounded-md">
                                                                    <span>Prazo do líder:</span>
                                                                    <strong className="text-hotel-gold">{format(parseISO(prazoEstimadoCard), 'dd/MM/yyyy')}</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <ChevronRight size={16} className="text-hotel-gray-md/40 group-hover:text-hotel-blue transition-colors flex-shrink-0" />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {ordens.length > 8 && (
                                <button
                                    onClick={() => navigate('/ordens', { state: { viewMode: 'todos' } })}
                                    className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-hotel-gray/50 bg-white hover:bg-slate-50 py-2.5 text-xs font-bold text-hotel-blue shadow-sm hover:shadow-md hover:border-hotel-gold/50 transition-all duration-200"
                                >
                                    Ver todas <ArrowRight size={14} />
                                </button>
                            )}
                        </div>

                        {/* Resumo por líder */}
                        <div className="h-[560px] bg-white/95 border border-hotel-gray/40 rounded-2xl shadow-sm p-6 flex flex-col animate-fadeIn">
                            <div className="border-b border-slate-100 pb-4 mb-4">
                                <h3 className="font-heading font-bold text-hotel-blue text-base flex items-center gap-2">
                                    <Users size={18} /> Resumo por Líder
                                </h3>
                                <p className="text-[11px] text-hotel-gray-md font-body mt-0.5">
                                    Taxa de conclusão de SIs por responsável.
                                </p>
                            </div>
                            
                            <div className="space-y-4 flex-1 overflow-y-auto pr-1 min-h-0">
                                {lideres.map((lider, index) => {
                                    const total = ordensSemTeste.filter((o) => belongsToLeader(o, lider)).length;
                                    const concl = ordensSemTeste.filter((o) => belongsToLeader(o, lider) && o.status === StatusOS.CONCLUIDO).length;
                                    const pct = total > 0 ? Math.round((concl / total) * 100) : 0;
                                    const initials = getInitials(lider.nome);
                                    const grad = gradients[index % gradients.length];
                                    
                                    return (
                                        <div key={lider.id} className="flex items-start gap-3 py-1.5 group">
                                            {/* Avatar */}
                                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-sm shadow-hotel-blue/10 group-hover:scale-105 transition-transform duration-200`}>
                                                {initials}
                                            </div>
                                            
                                            {/* Info */}
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center justify-between text-xs font-body">
                                                    <span className="font-semibold text-hotel-blue group-hover:text-hotel-gold transition-colors truncate">
                                                        {lider.nome}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-hotel-gray-md bg-hotel-gray/30 px-1.5 py-0.5 rounded-full">
                                                        {concl}/{total}
                                                    </span>
                                                </div>
                                                
                                                {/* Progress Bar */}
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 rounded-full bg-slate-100 flex-1 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-hotel-blue to-hotel-gold transition-all duration-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-hotel-blue font-heading w-7 text-right">
                                                        {pct}%
                                                    </span>
                                                </div>
                                                
                                                <p className="text-[10px] text-hotel-gray-md font-body truncate">
                                                    {lider.departamentos.join(', ')}
                                                </p>
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
