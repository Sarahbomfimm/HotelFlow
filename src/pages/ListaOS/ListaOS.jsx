import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, Filter, ChevronDown, ChevronUp, Trash2, X,
    Edit3, Clock3, ArrowLeft, CalendarRange, Image as ImageIcon,
    Download, Paperclip, Play, Check, FileCheck, Eye, ListTodo, Plus, Trash, CheckSquare, Square,
    CalendarDays, ChevronLeft, ChevronRight, Calendar, Tag, User, Hash, Activity, CheckCircle2,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import EditarOSModal from '../../components/Modal/EditarOSModal';
import StatusObservacaoModal from '../../components/Modal/StatusObservacaoModal';
import AdicionarObservacaoModal from '../../components/Modal/AdicionarObservacaoModal';
import EditarAnexoHistoricoModal from '../../components/Modal/EditarAnexoHistoricoModal';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { hasPermission, PERMISSIONS } from '../../services/permissions';
import { StatusOS, StatusLabel, PDCAStep, PDCALabel, ApprovalStage } from '../../models/OrdemDeServico';
import { format, parseISO, isSameMonth, isSameDay } from 'date-fns';
import { getLeaderEstimatedDeadlineValue, isSIOverdue } from '../../utils/osDeadlineRules';
import { isOrderInSelectedDashboardMonth } from '../../utils/osMonthRules';
import { ptBR } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function normalizeIdentityValue(value) {
    return String(value || '').trim().toLowerCase();
}

function matchesOrderActor(order, actor, prefix) {
    if (!order || !actor) {
        return false;
    }

    if (prefix === 'responsavel' && Array.isArray(order.co_responsaveis)) {
        const actorIds = [actor.id, actor.firebaseUid]
            .map(normalizeIdentityValue)
            .filter(Boolean);
        const actorEmail = normalizeIdentityValue(actor.email);

        const isCoResponsavel = order.co_responsaveis.some((responsavel) => {
            const responsavelIds = [responsavel.id, responsavel.uid]
                .map(normalizeIdentityValue)
                .filter(Boolean);

            if (actorIds.some((id) => responsavelIds.includes(id))) {
                return true;
            }

            const responsavelEmail = normalizeIdentityValue(responsavel.email);
            if (actorEmail && responsavelEmail && actorEmail === responsavelEmail) {
                return true;
            }

            return false;
        });

        if (isCoResponsavel) {
            return true;
        }
    }

    const actorIds = [actor.id, actor.firebaseUid]
        .map(normalizeIdentityValue)
        .filter(Boolean);
    const orderIds = [order[`${prefix}_id`], order[`${prefix}_uid`]]
        .map(normalizeIdentityValue)
        .filter(Boolean);

    if (actorIds.some((id) => orderIds.includes(id))) {
        return true;
    }

    const actorEmail = normalizeIdentityValue(actor.email);
    const orderEmail = normalizeIdentityValue(order[`${prefix}_email`]);
    if (actorEmail && orderEmail && actorEmail === orderEmail) {
        return true;
    }

    const actorNome = normalizeIdentityValue(actor.nome);
    const orderNome = normalizeIdentityValue(order[`${prefix}_nome`]);
    if (actorNome && orderNome && actorNome === orderNome) {
        return true;
    }

    return false;
}

function MultiSelectFilter({
    title,
    selectedValues,
    options,
    onToggle,
    onClear,
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [open]);

    const selectedLabels = options
        .filter((option) => selectedValues.includes(option.value))
        .map((option) => option.label);

    const buttonLabel = selectedLabels.length === 0
        ? title
        : selectedLabels.length === 1
            ? selectedLabels[0]
            : `${selectedLabels.length} selecionados`;

    return (
        <div ref={containerRef} className="relative w-full sm:w-auto">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="input w-full cursor-pointer py-2 text-sm sm:w-auto min-w-[190px] text-left"
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{buttonLabel}</span>
                    <ChevronDown size={14} className={`flex-shrink-0 text-hotel-gray-md transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="absolute z-30 mt-1 max-h-64 w-full min-w-[230px] overflow-auto rounded-xl border border-hotel-gray/60 bg-white p-2 shadow-card">
                    <div className="mb-1 flex items-center justify-between px-1">
                        <span className="text-[11px] font-semibold text-hotel-blue font-body">Marque uma ou mais opções</span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-hotel-gray-md transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Fechar filtro"
                        >
                            <X size={12} />
                        </button>
                    </div>
                    <div className="mb-1 px-1">
                        {selectedValues.length > 0 && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="text-[11px] text-hotel-gray-md transition-colors hover:text-red-500"
                            >
                                Limpar seleção
                            </button>
                        )}
                    </div>
                    <div className="space-y-1">
                        {options.map((option) => (
                            <label
                                key={option.value}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-body text-hotel-blue hover:bg-hotel-light"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedValues.includes(option.value)}
                                    onChange={() => onToggle(option.value)}
                                    className="h-3.5 w-3.5 rounded border-hotel-gray"
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const nextStatus = {
    [StatusOS.ABERTO]: StatusOS.EM_ANDAMENTO,
    [StatusOS.EM_ANDAMENTO]: StatusOS.CONCLUIDO,
};
const nextLabel = {
    [StatusOS.ABERTO]: 'Iniciar',
    [StatusOS.EM_ANDAMENTO]: 'Concluir',
};

function compareOrdersByCompletion(left, right) {
    const leftCompleted = left.status === StatusOS.CONCLUIDO;
    const rightCompleted = right.status === StatusOS.CONCLUIDO;

    if (leftCompleted !== rightCompleted) {
        return leftCompleted ? 1 : -1;
    }

    return new Date(left.prazo) - new Date(right.prazo);
}

function escapeCsvValue(value) {
    const text = String(value ?? '');
    if (/["\n\r;]/.test(text) || text.includes(',')) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

function HistoricoOSModal({ isOpen, onClose, os, actor, isDiretora, onEditarAnexo }) {
    if (!isOpen || !os) return null;

    const historico = os.historico || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-hotel-gray/20 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="font-heading text-xl font-bold text-hotel-blue">Log de alterações</h2>
                        <p className="mt-1 text-sm text-hotel-gray-md">Veja o histórico da SI "{os.titulo}".</p>
                    </div>
                    <button onClick={onClose} className="text-hotel-gray-md transition-colors hover:text-hotel-blue" aria-label="Fechar histórico">
                        <X size={22} />
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 sm:p-6">
                    {historico.length === 0 ? (
                        <p className="text-sm text-hotel-gray-md">Nenhum histórico registrado.</p>
                    ) : (
                        [...historico].reverse().map((h, index) => (
                            <div key={`${h.data}-${index}`} className="flex gap-3 rounded-2xl border border-hotel-gray/40 bg-hotel-light/20 px-4 py-4">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hotel-blue/10 text-hotel-blue">
                                    <Clock3 size={14} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-hotel-blue">
                                        {h.usuario_nome}
                                        {h.prazo_estimado && (
                                            <span className="ml-2 text-xs font-normal text-hotel-gold">
                                                {' · '}Prazo estimado: {format(parseISO(h.prazo_estimado), 'dd/MM/yyyy')}
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-xs text-hotel-gray-md">
                                        {format(parseISO(h.data), "dd/MM/yyyy 'às' HH:mm")}
                                    </p>
                                    <p className="mt-1.5 text-sm leading-6 text-hotel-gray-md whitespace-pre-line">{h.descricao}</p>
                                    {h.anexo_pdf_url && (
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-hotel-blue/10 px-2.5 py-1 text-[11px] font-semibold text-hotel-blue">
                                                <Paperclip size={11} /> PDF anexado
                                            </span>
                                            <a
                                                href={h.anexo_pdf_url}
                                                download={h.anexo_pdf_nome || 'anexo.pdf'}
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-blue hover:text-hotel-gold mr-3"
                                                target="_blank" rel="noreferrer"
                                            >
                                                <Download size={11} /> {h.anexo_pdf_nome || 'Abrir anexo'}
                                            </a>
                                            {(isDiretora || h.usuario_nome === actor?.nome) && (
                                                <button
                                                    type="button"
                                                    onClick={() => onEditarAnexo(h)}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-gray-md hover:text-hotel-blue transition-colors border-l border-hotel-gray-md/30 pl-3"
                                                    title="Editar ou remover documento anexado"
                                                >
                                                    <Edit3 size={11} /> Editar anexo
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
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

const CustomDateInput = forwardRef(({ value, onClick, weekday, dayAndMonth }, ref) => (
    <button
        type="button"
        onClick={onClick}
        ref={ref}
        className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border border-hotel-gray/30 hover:border-hotel-blue/50 bg-white transition-all shadow-sm cursor-pointer text-left w-full focus:outline-none focus:ring-2 focus:ring-hotel-blue/20"
    >
        <div className="min-w-0 flex-1">
            <div className="font-extrabold text-hotel-blue leading-tight text-xs sm:text-sm truncate">
                {weekday}
            </div>
            <div className="text-[10px] text-hotel-gray-md font-bold uppercase tracking-wider">
                {dayAndMonth}
            </div>
        </div>
        <CalendarDays className="h-4 w-4 text-hotel-blue shrink-0" />
    </button>
));

CustomDateInput.displayName = 'CustomDateInput';

export default function ListaOS() {
    const {
        ordens,
        getOSPorLider,
        atualizarStatus,
        solicitarFinalizacao,
        excluirOS,
        adicionarObservacao,
        atualizarChecklist,
        editarAnexoHistorico,
        error: ordensError,
    } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { lideres, availableDepartments, currentUserProfile, users } = useUsers();
    const navigate = useNavigate();

    const sofiaIds = useMemo(() => {
        if (!users) return [];
        return users
            .filter((u) => u.nome?.toLowerCase() === 'sofia' || u.email?.toLowerCase() === 'sofia@hotelflow.com')
            .flatMap((u) => [u.id, u.firebaseUid])
            .filter(Boolean);
    }, [users]);

    const liderFilterOptions = useMemo(() => {
        const options = lideres.map((lider) => ({ value: lider.id, label: lider.nome }));
        const hasSofiaUser = users?.some((u) => u.nome?.toLowerCase() === 'sofia' || u.email?.toLowerCase() === 'sofia@hotelflow.com');
        if (hasSofiaUser && !options.some(o => o.label?.toLowerCase() === 'sofia')) {
            options.push({ value: 'sofia_filter_val', label: 'Sofia' });
        }
        return options;
    }, [lideres, users]);
    const location = useLocation();
    const actor = currentUserProfile || user;
    const actorDepartments = actor?.departamentos || [];
    const isDiretora = actor?.role === UserRole.DIRETORA || actor?.role === UserRole.ADMIN;
    const canFinalizeSI = hasPermission(actor, PERMISSIONS.SI_FINALIZE);
    const canMoveApprovals = hasPermission(actor, PERMISSIONS.SI_APPROVALS_MOVE);
    const isAbertasPorMimRoute = location.pathname === '/ordens/abertas-por-mim';

    // Inicializa filtros a partir de state passado pelo dashboard
    const locState = location.state || {};
    const isPdcaOnlyNavigation = Boolean(locState.pdcaOnly && locState.filterPdca);
    const shouldShowOnlyOverdue = Boolean(locState.onlyOverdue);
    const shouldShowOnlyCurrentMonth = Boolean(locState.onlyCurrentMonth);
    const shouldShowOnlyCreatedByMe = Boolean(locState.onlyCreatedByMe || isAbertasPorMimRoute);
    const selectedMonthFromNavigation = typeof locState.selectedMonth === 'string' ? locState.selectedMonth : null;
    const navigationMonthDate = useMemo(() => {
        if (selectedMonthFromNavigation) {
            return parseISO(`${selectedMonthFromNavigation}-01`);
        }

        if (shouldShowOnlyCurrentMonth) {
            return new Date();
        }

        return null;
    }, [selectedMonthFromNavigation, shouldShowOnlyCurrentMonth]);
    const shouldFilterByNavigationMonth = Boolean(navigationMonthDate);

        const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState(isPdcaOnlyNavigation ? [] : (locState.filterStatus ? [locState.filterStatus] : []));
    const [filterPdca, setFilterPdca] = useState(locState.filterPdca ? [locState.filterPdca] : []);
    const [novoItemChecklist, setNovoItemChecklist] = useState('');
    const [filterLider, setFilterLider] = useState(
        Array.isArray(locState.filterLider)
            ? locState.filterLider
            : (locState.filterLider ? [locState.filterLider] : []),
    );
    const [filterDept, setFilterDept] = useState([]);
    const [prazoRange, setPrazoRange] = useState([null, null]);
    const [prazoInicio, prazoFim] = prazoRange;
    const [expanded, setExpanded] = useState(locState.expandOsId || null);
    const [toDelete, setToDelete] = useState(null);
    const [toEdit, setToEdit] = useState(null);
    const cardRefs = useRef({});
    const [editingChecklist, setEditingChecklist] = useState({ osId: null, itemId: null, text: '' });
    // Modal de observação ao mudar status
    const [obsModal, setObsModal] = useState({ open: false, os: null, novoStatus: null });
    const [adicionarObsModal, setAdicionarObsModal] = useState({ open: false, os: null });
    const [historicoModal, setHistoricoModal] = useState({ open: false, os: null });
    const [editarAnexoModalState, setEditarAnexoModalState] = useState({ open: false, os: null, item: null });

    const [viewMode, setViewMode] = useState(locState.viewMode || 'diario');
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });

    const [modalActiveTab, setModalActiveTab] = useState('detalhes');

    useEffect(() => {
        if (expanded) {
            setModalActiveTab('detalhes');
        }
    }, [expanded]);

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return new Date();
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const formatDateString = (date) => {
        if (!date) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const adjustDate = (days) => {
        const currentDate = parseLocalDate(selectedDate);
        currentDate.setDate(currentDate.getDate() + days);
        setSelectedDate(formatDateString(currentDate));
    };

    const isTodaySelected = selectedDate === formatDateString(new Date());

    const getSelectedDateDisplay = (selectedDateStr) => {
        const date = parseLocalDate(selectedDateStr);
        const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        const dayAndMonth = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        return {
            weekday: capitalizedWeekday,
            dayAndMonth: dayAndMonth,
        };
    };

    const getWeeklyStrip = (selectedDateStr, baseOrders) => {
        const centerDate = parseLocalDate(selectedDateStr);
        const currentDayOfWeek = centerDate.getDay();
        const startOfWeek = new Date(centerDate);
        startOfWeek.setDate(centerDate.getDate() - currentDayOfWeek);
        
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dateStr = formatDateString(d);
            const dayNum = d.getDate();
            const weekdayShort = d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3).replace('.', '');
            const capitalizedShort = weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1);
            
            const taskCount = baseOrders.filter(o => {
                if (o.status === StatusOS.CONCLUIDO) return false;
                if (!o.prazo) return false;
                if (locState.onlyMine && !matchesOrderActor(o, actor, 'responsavel')) return false;
                if (shouldShowOnlyCreatedByMe && !matchesOrderActor(o, actor, 'criado_por')) return false;
                try {
                    const osDate = parseISO(o.prazo);
                    return isSameDay(osDate, d);
                } catch (err) {
                    return false;
                }
            }).length;
            
            days.push({
                dateStr,
                dayNum,
                weekdayShort: capitalizedShort,
                isActive: dateStr === selectedDateStr,
                taskCount
            });
        }
        return days;
    };

    useEffect(() => {
        if (!locState.expandOsId) {
            return;
        }

        const targetOs = ordens.find(o => o.id === locState.expandOsId);
        if (targetOs && targetOs.prazo) {
            try {
                const parsed = parseISO(targetOs.prazo);
                setSelectedDate(formatDateString(parsed));
                setViewMode('diario');
            } catch (err) {
                console.error("Erro ao definir data do redirect:", err);
            }
        }

        // Ao abrir uma SI específica vinda de cards, limpa filtros antigos
        // para garantir que o item clicado fique visível e expandido.
        setSearch('');
        setFilterStatus([]);
        setFilterPdca([]);
        setFilterLider([]);
        setFilterDept([]);
        setPrazoRange([null, null]);
        setExpanded(locState.expandOsId);
        setNovoItemChecklist('');
        setEditingChecklist({ osId: null, itemId: null, text: '' });
    }, [locState.expandOsId, ordens]);

    const base = useMemo(() =>
        isDiretora ? ordens : getOSPorLider(actorDepartments, actor),
        [isDiretora, ordens, getOSPorLider, actorDepartments, actor],
    );

        const filtered = useMemo(() => {
        return base
            .filter((o) => {
                if (viewMode === 'diario') {
                    if (!o.prazo) return false;
                    try {
                        const osDate = parseISO(o.prazo);
                        const agendaDate = parseLocalDate(selectedDate);
                        return isSameDay(osDate, agendaDate);
                    } catch (e) {
                        return false;
                    }
                }
                if (isPdcaOnlyNavigation) return true;
                if (filterStatus.length === 0) return true;
                if (filterStatus.includes(o.status)) return true;
                if (filterStatus.includes('atrasada') && isSIOverdue(o)) return true;
                return false;
            })
            .filter((o) => {
                if (viewMode === 'diario') return true;
                return filterPdca.length === 0 || filterPdca.includes(o.etapa_pdca);
            })
            .filter((o) => {
                if (viewMode === 'diario') return true;
                if (filterLider.length === 0) return true;

                return filterLider.some((leaderId) => {
                    const isSofiaFilter = leaderId === 'sofia_filter_val' || sofiaIds.includes(leaderId);
                    if (isSofiaFilter) {
                        return (
                            o.responsavel_nome?.toLowerCase() === 'sofia' ||
                            sofiaIds.includes(o.responsavel_id) ||
                            sofiaIds.includes(o.responsavel_uid)
                        );
                    }

                    const leader = lideres.find((item) => item.id === leaderId);
                    if (!leader) {
                        return normalizeIdentityValue(o.responsavel_id) === normalizeIdentityValue(leaderId);
                    }

                    return matchesOrderActor(o, leader, 'responsavel');
                });
            })
            .filter((o) => {
                if (viewMode === 'diario') return true;
                return filterDept.length === 0 || filterDept.includes(o.departamento);
            })
            .filter((o) => {
                if (!locState.onlyMine) return true;
                return matchesOrderActor(o, actor, 'responsavel');
            })
            .filter((o) => {
                if (!shouldShowOnlyCreatedByMe) return true;
                return matchesOrderActor(o, actor, 'criado_por');
            })
            .filter((o) => {
                if (viewMode === 'diario') return true;
                if (!shouldFilterByNavigationMonth) return true;
                return isOrderInSelectedDashboardMonth(o, navigationMonthDate);
            })
            .filter((o) => {
                if (viewMode === 'diario') return true;
                if (!shouldShowOnlyOverdue) return true;
                return isSIOverdue(o);
            })
            .filter((o) => {
                if (viewMode === 'diario') return true;
                if (!prazoInicio) return true;
                return new Date(o.prazo) >= prazoInicio;
            })
            .filter((o) => {
                if (viewMode === 'diario') return true;
                if (!prazoFim) return true;
                const fim = new Date(prazoFim);
                fim.setHours(23, 59, 59, 999);
                return new Date(o.prazo) <= fim;
            })
            .filter((o) => {
                if (!search) return true;
                const q = search.toLowerCase();
                return (
                    o.titulo.toLowerCase().includes(q) ||
                    o.descricao.toLowerCase().includes(q) ||
                    o.responsavel_nome.toLowerCase().includes(q) ||
                    o.departamento.toLowerCase().includes(q) ||
                    (Array.isArray(o.co_responsaveis) && o.co_responsaveis.some((c) => c.nome?.toLowerCase().includes(q)))
                );
            })
            .sort(compareOrdersByCompletion);
    }, [
        base,
        viewMode,
        selectedDate,
        filterStatus,
        filterPdca,
        filterLider,
        filterDept,
        prazoInicio,
        prazoFim,
        search,
        locState.onlyMine,
        isPdcaOnlyNavigation,
        shouldFilterByNavigationMonth,
        navigationMonthDate,
        shouldShowOnlyCreatedByMe,
        shouldShowOnlyOverdue,
        lideres,
        actor,
        sofiaIds,
    ]);

    const activeOrders = useMemo(
        () => filtered.filter((os) => os.status !== StatusOS.CONCLUIDO),
        [filtered],
    );

    const completedOrders = useMemo(
        () => filtered.filter((os) => os.status === StatusOS.CONCLUIDO),
        [filtered],
    );

    const exportarCsv = () => {
        if (filtered.length === 0) {
            addNotification('Não há SI para exportar.', 'info');
            return;
        }

        const header = [
            'Título',
            'Descrição',
            'Departamento',
            'Responsável',
            'Prazo',
            'Status',
            'PDCA',
            'Criado em',
            'Criado por',
        ];

        const rows = filtered.map((os) => [
            os.titulo,
            os.descricao,
            os.departamento,
            os.responsavel_nome,
            os.prazo ? format(parseISO(os.prazo), 'dd/MM/yyyy', { locale: ptBR }) : '',
            StatusLabel[os.status] || os.status || '',
            PDCALabel[os.etapa_pdca] || os.etapa_pdca || '',
            os.criado_em ? format(parseISO(os.criado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
            os.criado_por_nome || '',
        ]);

        const csvContent = [header, ...rows]
            .map((row) => row.map(escapeCsvValue).join(';'))
            .join('\r\n');

        const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `si_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
        link.click();

        URL.revokeObjectURL(url);
        addNotification('CSV exportado com sucesso.', 'success');
    };

    useEffect(() => {
        if (!expanded) {
            return;
        }

        const target = cardRefs.current[expanded];
        if (!target) {
            return;
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [expanded, filtered]);

    const toggleInFilter = (setter, currentValues, value) => {
        if (currentValues.includes(value)) {
            setter(currentValues.filter((item) => item !== value));
            return;
        }

        setter([...currentValues, value]);
    };

    useEffect(() => {
        setNovoItemChecklist('');
    }, [expanded]);

    const handleAdicionarItemChecklist = async (os) => {
        if (!novoItemChecklist.trim()) return;
        const novoChecklist = [...(os.checklist || []), { id: `item-${Date.now()}`, texto: novoItemChecklist.trim(), concluido: false }];
        try {
            await atualizarChecklist(os.id, novoChecklist, actor);
            setNovoItemChecklist('');
        } catch (error) {
            addNotification('Erro ao atualizar checklist.', 'error');
        }
    };

    const handleToggleChecklistItem = async (os, itemId) => {
        const novoChecklist = (os.checklist || []).map(item =>
            item.id === itemId ? { ...item, concluido: !item.concluido } : item
        );
        try {
            await atualizarChecklist(os.id, novoChecklist, actor);
        } catch (error) {
            addNotification('Erro ao atualizar checklist.', 'error');
        }
    };

    const handleRemoverItemChecklist = async (os, itemId) => {
        const novoChecklist = (os.checklist || []).filter(item => item.id !== itemId);
        try {
            await atualizarChecklist(os.id, novoChecklist, actor);
        } catch (error) {
            addNotification('Erro ao remover item do checklist.', 'error');
        }
    };

    const handleSalvarEdicaoChecklist = async (os, itemId) => {
        if (!editingChecklist.text.trim()) return;
        const novoChecklist = (os.checklist || []).map(item =>
            item.id === itemId ? { ...item, texto: editingChecklist.text.trim() } : item
        );
        try {
            await atualizarChecklist(os.id, novoChecklist, actor);
            setEditingChecklist({ osId: null, itemId: null, text: '' });
        } catch (error) {
            addNotification('Erro ao editar item do checklist.', 'error');
        }
    };

    // Abre modal de observação antes de confirmar mudança de status
    const solicitarStatusChange = async (os, status) => {
        // Líder iniciando: não pede observação imediatamente
        if (!isDiretora && status === StatusOS.EM_ANDAMENTO) {
            await atualizarStatus(os.id, status, actor, '');
            addNotification(`SI "${os.titulo}" iniciada.`, 'info');
            return;
        }
        setObsModal({ open: true, os, novoStatus: status });
    };

    const confirmarStatusChange = async (observacao) => {
        const { os, novoStatus } = obsModal;
        setObsModal({ open: false, os: null, novoStatus: null });
        await atualizarStatus(os.id, novoStatus, actor, observacao);
        addNotification(
            `SI "${os.titulo}" atualizada para ${StatusLabel[novoStatus]}.`,
            novoStatus === StatusOS.CONCLUIDO ? 'success' : 'info',
        );
    };

    const handleAdicionarObs = async (texto, etapaPdca, prazoEstimado, anexoPdfFile, coResponsaveis) => {
        const { os } = adicionarObsModal;
        try {
            const result = await adicionarObservacao(os.id, texto, actor, etapaPdca, prazoEstimado, anexoPdfFile, coResponsaveis);
            addNotification(`Progresso registrado na SI “${os.titulo}”.`, 'info');
            if (result?.anexoErro) {
                addNotification(result.anexoErro, 'warning');
            }
            setAdicionarObsModal({ open: false, os: null });
            setModalActiveTab('progresso');
        } catch (error) {
            addNotification(error?.message || 'Nao foi possivel registrar o progresso.', 'error');
        }
    };

    const handleConfirmEditarAnexo = async (osId, dataItem, novoPdfFile, removerAnexo, motivo) => {
        try {
            await editarAnexoHistorico(osId, dataItem, novoPdfFile, removerAnexo, motivo, actor);
            addNotification(
                removerAnexo ? 'Anexo do histórico removido com sucesso.' : 'Anexo do histórico substituído com sucesso.',
                'success'
            );
            setEditarAnexoModalState({ open: false, os: null, item: null });
        } catch (error) {
            addNotification(error?.message || 'Erro ao ajustar anexo do histórico.', 'error');
        }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        try {
            await excluirOS(toDelete.id, actor);
            addNotification(`SI "${toDelete.titulo}" excluída.`, 'warning');
            setToDelete(null);
        } catch (error) {
            addNotification(error.message, 'error');
        }
    };

    const clearFilters = () => {
        setSearch(''); setFilterStatus([]); setFilterPdca([]); setFilterLider([]);
        setFilterDept([]); setPrazoRange([null, null]);
    };
    const hasFilters = search || filterStatus.length > 0 || filterPdca.length > 0 || filterLider.length > 0 || filterDept.length > 0 || prazoInicio || prazoFim;

    const pageTitle = isDiretora
        ? 'Todas as Solicitações Internas'
        : (shouldShowOnlyCreatedByMe ? 'SIs Abertas por Mim' : 'Minhas Solicitações Internas');

    const renderOrderCard = (os) => {
        const atrasada = isSIOverdue(os);
        const isExpanded = expanded === os.id;
        const prazoEstimadoCard = getLeaderEstimatedDeadlineValue(os);
        const isResponsavel = matchesOrderActor(os, actor, 'responsavel');
        const isCriador = matchesOrderActor(os, actor, 'criado_por');
        const isLider = actor?.role === UserRole.LIDER;
        const isInDept = actorDepartments && actorDepartments.includes(os.departamento);
        const isLiderOfDept = isLider && isInDept;

        const isActStage = os.etapa_pdca === PDCAStep.ACT;
        const canReopen = (os.status === StatusOS.CONCLUIDO || (isActStage && os.status !== StatusOS.EM_ANDAMENTO)) && (isDiretora || isCriador || isResponsavel);

        const canStart = os.status === StatusOS.ABERTO && (isResponsavel || isCriador || isLiderOfDept || isDiretora);
        const canConcludeDirectly = os.status === StatusOS.EM_ANDAMENTO && (
            isCriador || isDiretora || (isResponsavel && canFinalizeSI && canMoveApprovals)
        );
        const hasPendingApproval = [ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE].includes(os.aprovacao_finalizacao_status);
        const canRequestFinalization = os.status === StatusOS.EM_ANDAMENTO && isResponsavel && !canConcludeDirectly && !hasPendingApproval;
        const podeAtualizar = !canReopen && (canStart || canConcludeDirectly);
        const podeEditar = isDiretora || isCriador;
        const podeExcluir = isDiretora || isCriador;

        return (
            <div
                key={os.id}
                ref={(element) => {
                    if (element) {
                        cardRefs.current[os.id] = element;
                    }
                }}
                onClick={() => {
                    setExpanded(os.id);
                    setModalActiveTab('detalhes');
                }}
                className={`cursor-pointer border rounded-3xl p-6 shadow-sm transition-all duration-200 select-none flex flex-col justify-between ${
                    atrasada 
                        ? 'border-red-300 bg-red-50/30 shadow-md shadow-red-100/50 hover:border-red-400 hover:shadow-lg hover:shadow-red-100 bg-opacity-70' 
                        : isExpanded 
                            ? 'bg-white border-hotel-blue shadow-md' 
                            : 'bg-white border-hotel-gray/40 hover:border-hotel-blue/30 hover:shadow-md'
                }`}
            >
                <div>
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="font-extrabold text-base sm:text-lg text-hotel-blue leading-tight select-text">{os.titulo}</h3>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {atrasada && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-600 border border-red-200 uppercase tracking-wider">
                                    ⚠ Atrasada
                                </span>
                            )}
                            <PDCABadge etapa={os.etapa_pdca} status={os.status} compact />
                        </div>
                    </div>

                    {os.descricao && (
                        <p className="mt-2 text-xs sm:text-sm text-hotel-gray-md font-body select-text leading-relaxed line-clamp-2">
                            {os.descricao}
                        </p>
                    )}

                    <div className="border-t border-hotel-gray/20 my-4" />

                    <div className="space-y-2.5 text-xs sm:text-sm font-body text-hotel-gray-md">
                        <div className="flex items-center gap-2.5">
                            <Tag size={16} className="text-hotel-gold shrink-0" />
                            <div className="select-text">
                                <span className="font-extrabold text-hotel-blue">Departamento:</span>{' '}
                                <span className="font-bold text-gray-700">{os.departamento}</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <User size={16} className="text-hotel-gold shrink-0 mt-0.5" />
                            <div className="select-text">
                                <span className="font-extrabold text-hotel-blue">Responsável:</span>{' '}
                                <span className="font-semibold text-gray-700">
                                    {os.responsavel_nome}
                                    {Array.isArray(os.co_responsaveis) && os.co_responsaveis.length > 0 && (
                                        <span className="text-hotel-gray-md"> + {os.co_responsaveis.map((c) => c.nome).join(', ')}</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <Calendar size={16} className={`${atrasada ? 'text-red-500' : 'text-hotel-gold'} shrink-0`} />
                            <div className="select-text">
                                <span className="font-extrabold text-hotel-blue">Prazo oficial:</span>{' '}
                                <span className={`font-semibold ${atrasada ? 'text-red-500 font-bold' : 'text-gray-700'}`}>
                                    {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                </span>
                            </div>
                        </div>

                        {prazoEstimadoCard && (
                            <div className="flex items-center gap-2.5">
                                <Clock3 size={16} className="text-hotel-gold shrink-0" />
                                <div className="select-text">
                                    <span className="font-extrabold text-hotel-blue">Prazo do líder:</span>{' '}
                                    <span className="font-semibold text-hotel-gold font-bold">
                                        {format(parseISO(prazoEstimadoCard), 'dd/MM/yyyy')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-hotel-gray/20">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] font-extrabold text-hotel-blue tracking-wider uppercase font-body">STATUS</span>
                            <StatusBadge status={os.status} />
                            {podeAtualizar && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); solicitarStatusChange(os, nextStatus[os.status]); }}
                                    className="inline-flex items-center justify-center gap-1 bg-hotel-gold text-white font-bold text-[10px] px-2.5 py-1 rounded-lg hover:bg-hotel-gold/90 transition-all shadow-sm"
                                    title={nextLabel[os.status]}
                                >
                                    {os.status === StatusOS.ABERTO ? <Play size={10} /> : <Check size={10} />}
                                    <span>{nextLabel[os.status]}</span>
                                </button>
                            )}
                            {canReopen && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); solicitarStatusChange(os, StatusOS.EM_ANDAMENTO); }}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-hotel-blue bg-hotel-blue/5 text-hotel-blue font-bold text-[10px] px-2.5 py-1 hover:bg-hotel-blue hover:text-white transition-all shadow-sm"
                                    title="Reativar SI"
                                >
                                    <Play size={10} />
                                    <span>Reativar</span>
                                </button>
                            )}
                            {canRequestFinalization && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                            await solicitarFinalizacao(os.id, actor);
                                            addNotification(`Solicitação de finalização enviada para a SI "${os.titulo}".`, 'info');
                                        } catch (error) {
                                            addNotification(error?.message || 'Não foi possível solicitar finalização.', 'error');
                                        }
                                    }}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-500 bg-amber-50/50 text-amber-700 font-extrabold text-[10px] px-2.5 py-1 hover:bg-amber-500 hover:text-white transition-all shadow-sm cursor-pointer"
                                    title="Solicitar finalização"
                                >
                                    <FileCheck size={10} />
                                    <span>Solicitar Finalização</span>
                                </button>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderOSDetailsModal = () => {
        if (!expanded) return null;
        if (adicionarObsModal.open || obsModal.open || editarAnexoModalState.open) return null;
        const os = ordens.find((o) => o.id === expanded) || base.find((o) => o.id === expanded);
        if (!os) return null;

        const atrasada = isSIOverdue(os);
        const prazoEstimadoCard = getLeaderEstimatedDeadlineValue(os);
        const isResponsavel = matchesOrderActor(os, actor, 'responsavel');
        const isCriador = matchesOrderActor(os, actor, 'criado_por');
        const isLider = actor?.role === UserRole.LIDER;
        const isInDept = actorDepartments && actorDepartments.includes(os.departamento);
        const isLiderOfDept = isLider && isInDept;

        const isActStage = os.etapa_pdca === PDCAStep.ACT;
        const canReopen = (os.status === StatusOS.CONCLUIDO || (isActStage && os.status !== StatusOS.EM_ANDAMENTO)) && (isDiretora || isCriador || isResponsavel);

        const canStart = os.status === StatusOS.ABERTO && (isResponsavel || isCriador || isLiderOfDept || isDiretora);
        const canConcludeDirectly = os.status === StatusOS.EM_ANDAMENTO && (
            isCriador || isDiretora || (isResponsavel && canFinalizeSI && canMoveApprovals)
        );
        const hasPendingApproval = [ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE].includes(os.aprovacao_finalizacao_status);
        const canRequestFinalization = os.status === StatusOS.EM_ANDAMENTO && isResponsavel && !canConcludeDirectly && !hasPendingApproval;
        const podeAtualizar = !canReopen && (canStart || canConcludeDirectly);
        const podeEditar = isDiretora || isCriador;
        const podeExcluir = isDiretora || isCriador;
        const podeEditarChecklist = isDiretora || isCriador || isResponsavel || isLiderOfDept;

        const historico = os.historico || [];

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn">
                <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white shadow-2xl flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="bg-hotel-blue text-white px-6 py-4 flex items-center justify-between rounded-t-3xl shadow-sm">
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] bg-hotel-gold text-hotel-blue font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Detalhes da SI
                            </span>
                            <h3 className="font-extrabold text-base sm:text-lg mt-1 truncate tracking-wide">{os.titulo}</h3>
                        </div>
                        <button 
                            onClick={() => setExpanded(null)} 
                            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-all"
                            aria-label="Fechar detalhes"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 bg-hotel-light p-1 rounded-xl w-fit border border-hotel-gray/30 mx-6 mt-4 shrink-0 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setModalActiveTab('detalhes')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                modalActiveTab === 'detalhes'
                                    ? 'bg-hotel-blue text-white shadow-sm'
                                    : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                            }`}
                        >
                            <Eye size={13} />
                            Detalhes
                        </button>
                        <button
                            type="button"
                            onClick={() => setModalActiveTab('checklist')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                modalActiveTab === 'checklist'
                                    ? 'bg-hotel-blue text-white shadow-sm'
                                    : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                            }`}
                        >
                            <ListTodo size={13} />
                            Checklist
                        </button>
                        <button
                            type="button"
                            onClick={() => setModalActiveTab('progresso')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                modalActiveTab === 'progresso'
                                    ? 'bg-hotel-blue text-white shadow-sm'
                                    : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                            }`}
                        >
                            <Clock3 size={13} />
                            Progresso
                        </button>
                    </div>

                    {/* Tab Content (Scrollable) */}
                    <div className="overflow-y-auto p-6 flex-1 min-h-0 space-y-4">
                        {modalActiveTab === 'detalhes' && (
                            <div className="space-y-4 animate-fadeIn">
                                {/* Descrição */}
                                <div>
                                    <h5 className="text-xs font-bold text-hotel-blue uppercase tracking-wider mb-1 font-body">Descrição da SI</h5>
                                    <p className="text-sm font-body text-gray-700 leading-relaxed whitespace-pre-line bg-hotel-light/30 border border-hotel-gray/20 rounded-xl p-3 select-text">
                                        {os.descricao || 'Nenhuma descrição fornecida.'}
                                    </p>
                                </div>

                                {/* Imagem Anexada */}
                                {os.imagem && (
                                    <div className="rounded-xl overflow-hidden border border-hotel-gray/30 shadow-sm bg-white">
                                        <div className="flex items-center gap-2 px-3 py-2 bg-hotel-light border-b border-hotel-gray/20">
                                            <ImageIcon size={14} className="text-hotel-gray-md" />
                                            <span className="text-xs font-semibold text-hotel-blue font-body flex-1">Imagem anexada</span>
                                            <a
                                                href={os.imagem}
                                                download={`SI-${os.id}.png`}
                                                className="flex items-center gap-1 text-hotel-blue text-xs font-semibold hover:text-hotel-gold transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Download size={13} /> Baixar
                                            </a>
                                        </div>
                                        <img
                                            src={os.imagem}
                                            alt="Imagem da SI"
                                            className="w-full max-h-64 object-cover cursor-pointer"
                                            onClick={() => window.open(os.imagem, '_blank')}
                                            title="Clique para abrir em tamanho completo"
                                        />
                                    </div>
                                )}

                                {/* Informações / Metadados */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-body">
                                    {/* Card 1: Departamento */}
                                    <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                        <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                            <Tag size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Departamento</span>
                                            <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">{os.departamento}</span>
                                        </div>
                                    </div>

                                    {/* Card 2: Responsável */}
                                    <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3 sm:col-span-2 lg:col-span-1">
                                        <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                            <User size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Responsável</span>
                                            <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">{os.responsavel_nome}</span>
                                            {Array.isArray(os.co_responsaveis) && os.co_responsaveis.length > 0 && (
                                                <span className="block text-[10px] text-hotel-gray-md mt-0.5 truncate" title={os.co_responsaveis.map((c) => c.nome).join(', ')}>
                                                    + {os.co_responsaveis.map((c) => c.nome).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card 3: Criado por */}
                                    <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                        <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                            <User size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Criado por</span>
                                            <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">{os.criado_por_nome}</span>
                                        </div>
                                    </div>

                                    {/* Card 4: Prazo Oficial */}
                                    <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                        <div className={`p-2 rounded-xl shrink-0 ${atrasada ? 'bg-red-50 text-red-500' : 'bg-hotel-blue/5 text-hotel-gold'}`}>
                                            <Calendar size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Prazo Oficial</span>
                                            <span className={`block text-sm font-bold mt-0.5 ${atrasada ? 'text-red-500 font-extrabold' : 'text-hotel-blue'}`}>
                                                {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Card 5: Prazo do Líder (se houver) */}
                                    {prazoEstimadoCard && (
                                        <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                                <Clock3 size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Prazo do Líder</span>
                                                <span className="block text-sm font-bold text-hotel-gold mt-0.5">
                                                    {format(parseISO(prazoEstimadoCard), 'dd/MM/yyyy')}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Card 6: Criado em */}
                                    <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                        <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                            <Clock3 size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Criado em</span>
                                            <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">
                                                {format(parseISO(os.criado_em), "dd/MM/yyyy 'às' HH:mm")}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status e Etapa PDCA */}
                                <div className="flex flex-wrap items-center gap-3 bg-hotel-light/20 border border-hotel-gray/25 rounded-2xl p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">STATUS:</span>
                                        <StatusBadge status={os.status} />
                                    </div>
                                    <div className="flex items-center gap-2 border-l border-hotel-gray/30 pl-3">
                                        <span className="text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">Etapa:</span>
                                        <PDCABadge etapa={os.etapa_pdca} status={os.status} />
                                    </div>
                                    {atrasada && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 border border-red-200 ml-auto">
                                            ⚠ Atrasada
                                        </span>
                                    )}
                                </div>

                                {/* Transições de Status */}
                                <div className="flex flex-wrap gap-2">
                                    {podeAtualizar && (
                                        <button
                                            onClick={() => solicitarStatusChange(os, nextStatus[os.status])}
                                            className="inline-flex items-center gap-1.5 bg-hotel-gold text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-hotel-gold/90 transition-all shadow-sm"
                                        >
                                            {os.status === StatusOS.ABERTO ? <Play size={14} /> : <Check size={14} />}
                                            <span>{os.status === StatusOS.ABERTO ? 'Iniciar SI' : 'Concluir SI'}</span>
                                        </button>
                                    )}
                                    {canReopen && (
                                        <button
                                            onClick={() => solicitarStatusChange(os, StatusOS.EM_ANDAMENTO)}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-hotel-blue bg-hotel-blue/5 text-hotel-blue font-bold text-xs px-4 py-2 hover:bg-hotel-blue hover:text-white transition-all shadow-sm"
                                        >
                                            <Play size={14} />
                                            <span>Reativar SI</span>
                                        </button>
                                    )}
                                    {canRequestFinalization && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await solicitarFinalizacao(os.id, actor);
                                                    addNotification(`Solicitação de finalização enviada para a SI "${os.titulo}".`, 'info');
                                                } catch (error) {
                                                    addNotification(error?.message || 'Não foi possível solicitar finalização.', 'error');
                                                }
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500 bg-amber-50/50 text-amber-700 font-extrabold text-xs px-4 py-2 hover:bg-amber-500 hover:text-white transition-all shadow-sm cursor-pointer"
                                        >
                                            <FileCheck size={14} />
                                            <span>Solicitar Finalização</span>
                                        </button>
                                    )}
                                    {os.status === StatusOS.EM_ANDAMENTO && (
                                        <button
                                            onClick={() => setAdicionarObsModal({ open: true, os })}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-hotel-blue/30 bg-hotel-blue/5 px-4 py-2 text-xs text-hotel-blue font-bold font-body transition-all hover:bg-hotel-blue hover:text-white shadow-sm"
                                        >
                                            <Plus size={14} />
                                            <span>Registrar Progresso</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {modalActiveTab === 'checklist' && (
                            <div className="space-y-3 animate-fadeIn">
                                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">
                                    <ListTodo size={14} /> Checklist de Etapas da SI
                                </p>
                                
                                <div className="space-y-2">
                                    {(!os.checklist || os.checklist.length === 0) && !podeEditarChecklist && (
                                        <p className="text-sm text-hotel-gray-md font-body">Nenhum item cadastrado no checklist.</p>
                                    )}

                                    {os.checklist?.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-hotel-gray/30 bg-white p-2.5 shadow-sm transition-colors hover:border-hotel-blue/30">
                                            {editingChecklist.osId === os.id && editingChecklist.itemId === item.id ? (
                                                <div className="flex flex-1 items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editingChecklist.text}
                                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, text: e.target.value })}
                                                        onKeyPress={(e) => e.key === 'Enter' && handleSalvarEdicaoChecklist(os, item.id)}
                                                        className="input py-1 px-2 text-sm flex-1 bg-white"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSalvarEdicaoChecklist(os, item.id)} className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors" title="Salvar">
                                                        <Check size={16} />
                                                    </button>
                                                    <button onClick={() => setEditingChecklist({ osId: null, itemId: null, text: '' })} className="p-1.5 text-hotel-gray-md hover:text-red-500 transition-colors" title="Cancelar">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => podeEditarChecklist && handleToggleChecklistItem(os, item.id)}
                                                        className={`flex flex-1 items-center gap-3 text-left ${item.concluido ? 'text-emerald-700' : 'text-hotel-blue'} ${!podeEditarChecklist ? 'cursor-default' : ''}`}
                                                    >
                                                        {item.concluido ? <CheckSquare size={16} className="shrink-0 text-emerald-500" /> : <Square size={16} className="shrink-0 text-hotel-gray-md" />}
                                                        <span className={`text-sm font-semibold font-body ${item.concluido ? 'line-through opacity-70' : ''}`}>{item.texto}</span>
                                                    </button>
                                                    {podeEditarChecklist && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button onClick={() => setEditingChecklist({ osId: os.id, itemId: item.id, text: item.texto })} className="p-1.5 text-hotel-gray-md hover:text-hotel-blue transition-colors" title="Editar etapa">
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoverItemChecklist(os, item.id)}
                                                                className="p-1.5 text-hotel-gray-md hover:text-red-500 transition-colors"
                                                                title="Remover etapa"
                                                            >
                                                                <Trash size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    {podeEditarChecklist && (
                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-hotel-gray/10">
                                            <input
                                                type="text"
                                                value={novoItemChecklist}
                                                onChange={(e) => setNovoItemChecklist(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdicionarItemChecklist(os))}
                                                placeholder="Adicionar nova etapa..."
                                                className="input py-1.5 text-sm flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAdicionarItemChecklist(os)}
                                                className="rounded-xl bg-hotel-blue p-2 text-white hover:bg-hotel-blue/90 transition-colors"
                                                title="Adicionar etapa"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {modalActiveTab === 'progresso' && (
                            <div className="space-y-3 animate-fadeIn">
                                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">
                                    <Clock3 size={14} /> Log de Alterações / Progresso
                                </p>
                                
                                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                                    {historico.length === 0 ? (
                                        <p className="text-sm text-hotel-gray-md">Nenhum progresso registrado.</p>
                                    ) : (
                                        [...historico].reverse().map((h, index) => (
                                            <div key={`${h.data}-${index}`} className="flex gap-3 rounded-2xl border border-hotel-gray/30 bg-hotel-light/20 px-4 py-4">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hotel-blue/10 text-hotel-blue">
                                                    <Clock3 size={14} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-hotel-blue">
                                                        {h.usuario_nome}
                                                        {h.prazo_estimado && (
                                                            <span className="ml-2 text-xs font-normal text-hotel-gold">
                                                                {' · '}Prazo estimado: {format(parseISO(h.prazo_estimado), 'dd/MM/yyyy')}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-hotel-gray-md">
                                                        {format(parseISO(h.data), "dd/MM/yyyy 'às' HH:mm")}
                                                    </p>
                                                    <p className="mt-1.5 text-sm leading-6 text-hotel-gray-md whitespace-pre-line">{h.descricao}</p>
                                                    {h.anexo_pdf_url && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-hotel-blue/10 px-2.5 py-1 text-[11px] font-semibold text-hotel-blue">
                                                                <Paperclip size={11} /> PDF anexado
                                                            </span>
                                                            <a
                                                                href={h.anexo_pdf_url}
                                                                download={h.anexo_pdf_nome || 'anexo.pdf'}
                                                                className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-blue hover:text-hotel-gold mr-3"
                                                                target="_blank" rel="noreferrer"
                                                            >
                                                                <Download size={11} /> {h.anexo_pdf_nome || 'Abrir anexo'}
                                                            </a>
                                                            {(isDiretora || h.usuario_nome === actor?.nome) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditarAnexoModalState({ open: true, os: os, item: h });
                                                                    }}
                                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-gray-md hover:text-hotel-blue transition-colors border-l border-hotel-gray-md/30 pl-3"
                                                                    title="Editar ou remover documento anexado"
                                                                >
                                                                    <Edit3 size={11} /> Editar anexo
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-hotel-gray/20 px-6 py-4 flex justify-between items-center rounded-b-3xl bg-hotel-light/20 shrink-0">
                        <div>
                            {podeEditar && (
                                <button
                                    onClick={() => {
                                        setExpanded(null);
                                        setToEdit(os);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-hotel-gray/30 bg-white text-hotel-blue font-bold text-xs px-4 py-2 hover:bg-hotel-light transition-all shadow-sm"
                                >
                                    <Edit3 size={14} />
                                    <span>Editar</span>
                                </button>
                            )}
                        </div>
                        {podeExcluir && (
                            <button
                                type="button"
                                onClick={() => {
                                    setExpanded(null);
                                    setToDelete(os);
                                }}
                                className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 p-2 hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-all shadow-sm"
                                title="Excluir SI"
                                aria-label="Excluir SI"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

        return (
        <AppLayout pageTitle={pageTitle}>
            <div className="animate-fadeIn">
                {ordensError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700">
                        {ordensError}
                    </div>
                )}
                {/* Botão voltar */}
                <div className="mb-4 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 rounded-xl bg-hotel-blue px-4 py-2 text-sm font-semibold font-body text-white shadow-sm transition-all hover:bg-hotel-blue/90"
                    >
                        <ArrowLeft size={16} /> Voltar
                    </button>
                </div>

                {/* Alternador de Abas */}
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-hotel-light p-1 rounded-xl w-fit border border-hotel-gray/30 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setViewMode('diario')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'diario'
                                    ? 'bg-hotel-blue text-white shadow-sm'
                                    : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                            }`}
                        >
                            <CalendarDays size={14} />
                            Agenda
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('todos')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'todos'
                                    ? 'bg-hotel-blue text-white shadow-sm'
                                    : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                            }`}
                        >
                            <ListTodo size={14} />
                            Todas as SIs
                        </button>
                    </div>
                </div>

                {/* Controles de Data e Busca para o Modo Agenda / Todas */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Busca */}
                    <div className="relative min-w-0 flex-1 sm:max-w-xs">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-gray-md" />
                        <input
                            type="search"
                            className="input pl-9 py-2 text-sm w-full"
                            placeholder="Buscar SI..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {viewMode === 'diario' && (
                        <div className="flex items-center justify-between sm:justify-end gap-3 flex-1 sm:max-w-md w-full sm:ml-auto">
                            {/* Botões Voltar/Avançar */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => adjustDate(-1)}
                                    className="h-9 w-9 rounded-xl hover:bg-hotel-light border border-hotel-gray/30 transition-all flex items-center justify-center bg-white shadow-sm"
                                    title="Dia anterior"
                                >
                                    <ChevronLeft size={18} className="text-hotel-gray-md" />
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => adjustDate(1)}
                                    className="h-9 w-9 rounded-xl hover:bg-hotel-light border border-hotel-gray/30 transition-all flex items-center justify-center bg-white shadow-sm"
                                    title="Próximo dia"
                                >
                                    <ChevronRight size={18} className="text-hotel-gray-md" />
                                </button>
                            </div>

                            {/* Seletor de data unificado clicável (Abre Popover com Calendário) */}
                            <div className="relative flex-1 sm:max-w-[200px] pdca-date-picker">
                                <DatePicker
                                    selected={parseLocalDate(selectedDate)}
                                    onChange={(date) => {
                                        if (date) {
                                            setSelectedDate(formatDateString(date));
                                        }
                                    }}
                                    locale={ptBR}
                                    dateFormat="dd/MM/yyyy"
                                    popperClassName="pdca-datepicker-popper"
                                    calendarClassName="pdca-datepicker-calendar"
                                    customInput={
                                        <CustomDateInput
                                            weekday={getSelectedDateDisplay(selectedDate).weekday}
                                            dayAndMonth={getSelectedDateDisplay(selectedDate).dayAndMonth}
                                        />
                                    }
                                />
                            </div>

                            {/* Botão Hoje */}
                            {!isTodaySelected && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(formatDateString(new Date()))}
                                    className="h-9 px-3 rounded-xl border border-hotel-gray/30 text-xs font-bold text-hotel-blue hover:bg-hotel-light transition-all cursor-pointer bg-white shrink-0 shadow-sm"
                                >
                                    Hoje
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Faixa Semanal (Weekly Strip) */}
                {viewMode === 'diario' && (
                    <div className="mb-4 bg-white/60 border border-hotel-gray/20 p-3 rounded-2xl shadow-sm backdrop-blur-md animate-fadeIn">
                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                            {getWeeklyStrip(selectedDate, base).map((day) => (
                                <button
                                    key={day.dateStr}
                                    type="button"
                                    onClick={() => setSelectedDate(day.dateStr)}
                                    className={`relative flex flex-col items-center justify-center py-2.5 rounded-xl transition-all cursor-pointer border ${
                                        day.isActive
                                            ? 'bg-hotel-blue text-white shadow-md font-black scale-[1.03] border-transparent ring-2 ring-hotel-blue/20'
                                            : 'hover:bg-hotel-light border-hotel-gray/30 text-hotel-gray-md hover:text-hotel-blue bg-white'
                                    }`}
                                >
                                    <span className={`text-[9px] sm:text-xs font-bold uppercase tracking-wider ${day.isActive ? 'text-white/80' : 'text-hotel-gray-md/75'}`}>
                                        {day.weekdayShort}
                                    </span>
                                    <span className="text-base sm:text-lg font-extrabold mt-0.5">
                                        {day.dayNum}
                                    </span>
                                    
                                    {/* Indicador de SIs ativas no dia */}
                                    {day.taskCount > 0 && (
                                        <span className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${day.isActive ? 'bg-white' : 'bg-hotel-blue animate-pulse'}`} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filtros Avançados - Apenas no modo 'todos' */}
                {viewMode === 'todos' && (
                    <>
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <MultiSelectFilter
                                title="Status"
                                selectedValues={filterStatus}
                                options={[
                                    ...Object.entries(StatusLabel).map(([k, v]) => ({ value: k, label: v })),
                                    { value: 'atrasada', label: 'Atrasada' },
                                ]}
                                onToggle={(value) => toggleInFilter(setFilterStatus, filterStatus, value)}
                                onClear={() => setFilterStatus([])}
                            />

                            <MultiSelectFilter
                                title="Etapa PDCA"
                                selectedValues={filterPdca}
                                options={Object.entries(PDCALabel).map(([k, v]) => ({ value: k, label: `${k} - ${v}` }))}
                                onToggle={(value) => toggleInFilter(setFilterPdca, filterPdca, value)}
                                onClear={() => setFilterPdca([])}
                            />

                            <MultiSelectFilter
                                title="Líder"
                                selectedValues={filterLider}
                                options={liderFilterOptions}
                                onToggle={(value) => toggleInFilter(setFilterLider, filterLider, value)}
                                onClear={() => setFilterLider([])}
                            />

                            <MultiSelectFilter
                                title="Departamento"
                                selectedValues={filterDept}
                                options={availableDepartments.map((departamento) => ({ value: departamento, label: departamento }))}
                                onToggle={(value) => toggleInFilter(setFilterDept, filterDept, value)}
                                onClear={() => setFilterDept([])}
                            />

                            {hasFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="inline-flex items-center justify-center rounded-full border border-hotel-gray/70 bg-hotel-light px-3 py-1.5 text-xs font-semibold text-hotel-blue transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                                >
                                    Limpar filtros
                                </button>
                            )}
                        </div>

                        {/* Filtro por período de prazo */}
                        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-hotel-gray/20 bg-white/40 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between animate-fadeIn">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-1">
                                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-hotel-blue font-heading">
                                    <CalendarRange size={15} className="text-hotel-blue/70" />
                                    Período do Prazo
                                </span>
                                <div className="relative flex items-center w-full sm:w-[240px]">
                                    <DatePicker
                                        selectsRange
                                        startDate={prazoInicio}
                                        endDate={prazoFim}
                                        onChange={(update) => setPrazoRange(update)}
                                        isClearable
                                        dateFormat="dd/MM/yyyy"
                                        locale={ptBR}
                                        popperClassName="pdca-datepicker-popper"
                                        calendarClassName="pdca-datepicker-calendar"
                                        className="w-full rounded-xl border border-hotel-gray/30 bg-white px-3.5 py-2 text-xs font-semibold text-hotel-blue placeholder-hotel-gray-md/70 hover:border-hotel-blue/30 focus:border-hotel-blue focus:outline-none transition-all shadow-sm cursor-pointer"
                                        placeholderText="Selecione o período"
                                    />
                                </div>
                                {(prazoInicio || prazoFim) && (
                                    <button
                                        type="button"
                                        onClick={() => setPrazoRange([null, null])}
                                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50/50 px-3 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 hover:text-red-700 shadow-sm"
                                    >
                                        <X size={13} /> Limpar
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={exportarCsv}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-50/70 hover:bg-emerald-50 hover:text-emerald-800 text-emerald-700 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            >
                                <Download size={14} /> Exportar CSV
                            </button>
                        </div>
                    </>
                )}

                {/* Contador */}
                <p className="text-xs text-hotel-gray-md font-body mb-3">
                    {filtered.length} solicita{filtered.length !== 1 ? 'ções' : 'ção'} interna{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
                </p>

                {/* Lista */}
                <div className="space-y-3">
                    {filtered.length === 0 ? (
                        <div className="card flex flex-col items-center justify-center py-16 gap-3">
                            <Filter size={32} className="text-hotel-gray-md" />
                            <p className="text-hotel-gray-md font-body text-sm">
                                Nenhuma SI encontrada. Tente ajustar os filtros.
                            </p>
                        </div>
                    ) : (
                        <>
                            {activeOrders.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-l-4 border-hotel-blue bg-gradient-to-r from-hotel-blue/10 via-hotel-blue/5 to-transparent px-4 py-3 rounded-r-2xl shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className="text-hotel-blue animate-pulse" />
                                            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-hotel-blue font-body">SIs ativas</span>
                                        </div>
                                        <span className="bg-hotel-blue text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
                                            {activeOrders.length}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fadeIn">
                                        {activeOrders.map(renderOrderCard)}
                                    </div>
                                </div>
                            )}
                            {completedOrders.length > 0 && (
                                <div className="space-y-3 pt-4">
                                    <div className="flex items-center justify-between border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-4 py-3 rounded-r-2xl shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-700 font-body">SIs concluídas</span>
                                        </div>
                                        <span className="bg-emerald-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
                                            {completedOrders.length}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fadeIn">
                                        {completedOrders.map(renderOrderCard)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!toDelete}
                title="Excluir Solicitação Interna"
                message={`Tem certeza que deseja excluir a SI "${toDelete?.titulo}"? Esta ação não pode ser desfeita.`}
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
                danger
            />

            <EditarOSModal
                os={toEdit}
                onClose={() => setToEdit(null)}
            />

            <StatusObservacaoModal
                isOpen={obsModal.open}
                os={obsModal.os}
                novoStatus={obsModal.novoStatus}
                onConfirm={confirmarStatusChange}
                onCancel={() => setObsModal({ open: false, os: null, novoStatus: null })}
            />
                        <AdicionarObservacaoModal
                            isOpen={adicionarObsModal.open}
                            os={adicionarObsModal.os}
                            onConfirm={handleAdicionarObs}
                            onCancel={() => setAdicionarObsModal({ open: false, os: null })}
                        />
            <HistoricoOSModal
                isOpen={historicoModal.open}
                os={ordens.find(o => o.id === historicoModal.os?.id) || historicoModal.os}
                actor={actor}
                isDiretora={isDiretora}
                onClose={() => setHistoricoModal({ open: false, os: null })}
                onEditarAnexo={(historicoItem) => {
                    setEditarAnexoModalState({ open: true, os: historicoModal.os, item: historicoItem });
                }}
            />

            <EditarAnexoHistoricoModal
                isOpen={editarAnexoModalState.open}
                os={editarAnexoModalState.os}
                historicoItem={editarAnexoModalState.item}
                onCancel={() => setEditarAnexoModalState({ open: false, os: null, item: null })}
                onConfirm={handleConfirmEditarAnexo}
            />

            {renderOSDetailsModal()}
        </AppLayout>
    );
}
