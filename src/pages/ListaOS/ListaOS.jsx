import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, Filter, ChevronDown, ChevronUp, Trash2, X,
    Edit3, Clock3, ArrowLeft, CalendarRange, Image as ImageIcon,
    Download, Paperclip,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import EditarOSModal from '../../components/Modal/EditarOSModal';
import StatusObservacaoModal from '../../components/Modal/StatusObservacaoModal';
import AdicionarObservacaoModal from '../../components/Modal/AdicionarObservacaoModal';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { hasPermission, PERMISSIONS } from '../../services/permissions';
import { StatusOS, StatusLabel, PDCAStep, PDCALabel } from '../../models/OrdemDeServico';
import { format, parseISO, isSameMonth } from 'date-fns';
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

export default function ListaOS() {
    const { ordens, getOSPorLider, atualizarStatus, excluirOS, adicionarObservacao, error: ordensError } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { lideres, availableDepartments, currentUserProfile } = useUsers();
    const navigate = useNavigate();
    const location = useLocation();
    const actor = currentUserProfile || user;
    const actorDepartments = actor?.departamentos || [];
    const isDiretora = actor?.role === UserRole.DIRETORA || actor?.role === UserRole.ADMIN;
    const canFinalizeSI = hasPermission(actor, PERMISSIONS.SI_FINALIZE);
    const canEditSI = hasPermission(actor, PERMISSIONS.SI_EDIT);
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
    // Modal de observação ao mudar status
    const [obsModal, setObsModal] = useState({ open: false, os: null, novoStatus: null });
    const [adicionarObsModal, setAdicionarObsModal] = useState({ open: false, os: null });

    useEffect(() => {
        if (!locState.expandOsId) {
            return;
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
    }, [locState.expandOsId]);

    const base = useMemo(() =>
        isDiretora ? ordens : getOSPorLider(actorDepartments, actor),
        [isDiretora, ordens, getOSPorLider, actorDepartments, actor],
    );

    const filtered = useMemo(() => {
        return base
            .filter((o) => isPdcaOnlyNavigation || filterStatus.length === 0 || filterStatus.includes(o.status))
            .filter((o) => filterPdca.length === 0 || filterPdca.includes(o.etapa_pdca))
            .filter((o) => {
                if (filterLider.length === 0) return true;

                return filterLider.some((leaderId) => {
                    const leader = lideres.find((item) => item.id === leaderId);
                    if (!leader) {
                        return normalizeIdentityValue(o.responsavel_id) === normalizeIdentityValue(leaderId);
                    }

                    return matchesOrderActor(o, leader, 'responsavel');
                });
            })
            .filter((o) => filterDept.length === 0 || filterDept.includes(o.departamento))
            .filter((o) => {
                if (!locState.onlyMine) return true;
                return matchesOrderActor(o, actor, 'responsavel');
            })
            .filter((o) => {
                if (!shouldShowOnlyCreatedByMe) return true;
                return matchesOrderActor(o, actor, 'criado_por');
            })
            .filter((o) => {
                if (!shouldFilterByNavigationMonth) return true;
                return isOrderInSelectedDashboardMonth(o, navigationMonthDate);
            })
            .filter((o) => {
                if (!shouldShowOnlyOverdue) return true;
                return isSIOverdue(o);
            })
            .filter((o) => {
                if (!prazoInicio) return true;
                return new Date(o.prazo) >= prazoInicio;
            })
            .filter((o) => {
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
        } catch (error) {
            addNotification(error?.message || 'Nao foi possivel registrar o progresso.', 'error');
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
        const canManagementFinalize = canFinalizeSI && isDiretora && os.status !== StatusOS.CONCLUIDO && !isResponsavel;
        const hasDownloadables = Boolean(
            os.imagem || (Array.isArray(os.historico) && os.historico.some((h) => h.anexo_pdf_url)),
        );
        const podeAtualizar = os.status !== StatusOS.CONCLUIDO
            && isResponsavel
            && (os.status !== StatusOS.EM_ANDAMENTO || canFinalizeSI);
        const podeRegistrarProgressoSemFinalizar = os.status === StatusOS.EM_ANDAMENTO
            && isResponsavel
            && !canFinalizeSI;
        const isCriador = matchesOrderActor(os, actor, 'criado_por');
        const podeEditar = canEditSI && (isDiretora || isCriador);
        const podeExcluir = isCriador;

        return (
            <div
                key={os.id}
                ref={(element) => {
                    if (element) {
                        cardRefs.current[os.id] = element;
                    }
                }}
                className={`card transition-all duration-200 ${atrasada ? 'border-red-200' : ''}`}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <StatusBadge status={os.status} />
                            <PDCABadge etapa={os.etapa_pdca} status={os.status} compact />
                            <span className="text-xs font-body bg-hotel-gray text-hotel-blue px-2 py-0.5 rounded-full font-medium">
                                {os.departamento}
                            </span>
                            {atrasada && (
                                <span className="text-xs text-red-600 font-semibold">⚠ Atrasada</span>
                            )}
                        </div>
                        <h4 className="font-semibold font-body text-hotel-blue text-sm">{os.titulo}</h4>
                        <p className="text-xs text-hotel-gray-md font-body mt-0.5">
                            {isDiretora ? os.responsavel_nome : 'Responsável da SI'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-body">
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

                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0 sm:justify-end">
                        {podeAtualizar && (
                            <button
                                onClick={() => solicitarStatusChange(os, nextStatus[os.status])}
                                className="btn-gold flex-1 px-3 py-1.5 text-xs sm:flex-none"
                            >
                                {nextLabel[os.status]}
                            </button>
                        )}
                        {canManagementFinalize && (
                            <button
                                onClick={() => solicitarStatusChange(os, StatusOS.CONCLUIDO)}
                                className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 sm:flex-none"
                            >
                                Finalizar
                            </button>
                        )}
                        {!podeAtualizar && !canManagementFinalize && podeRegistrarProgressoSemFinalizar && (
                            <button
                                onClick={() => setAdicionarObsModal({ open: true, os })}
                                className="group relative flex-1 overflow-hidden rounded-lg border border-sky-300/70 bg-gradient-to-r from-sky-50 via-white to-cyan-50 px-3 py-1.5 text-xs font-semibold text-sky-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md hover:shadow-sky-200/50 focus:outline-none focus:ring-2 focus:ring-sky-300/60 sm:flex-none"
                            >
                                <span className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-r from-sky-500/0 via-sky-500/10 to-cyan-500/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                Registrar progresso
                            </button>
                        )}
                        {podeEditar && (
                            <button
                                onClick={() => setToEdit(os)}
                                className="p-1.5 rounded-lg text-hotel-gray-md hover:text-hotel-blue hover:bg-hotel-light transition-colors"
                                aria-label="Editar SI"
                            >
                                <Edit3 size={15} />
                            </button>
                        )}
                        {podeExcluir && (
                            <button
                                onClick={() => setToDelete(os)}
                                className="p-1.5 rounded-lg text-hotel-gray-md hover:text-red-500 hover:bg-red-50 transition-colors"
                                aria-label="Excluir SI"
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                        <button
                            onClick={() => setExpanded(isExpanded ? null : os.id)}
                            className={`group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-hotel-gold/40 ${
                                hasDownloadables
                                    ? 'border-hotel-gold/70 bg-gradient-to-r from-amber-50 to-yellow-50 text-hotel-blue hover:border-hotel-gold hover:from-amber-100 hover:to-yellow-100'
                                    : 'border-hotel-gray/70 bg-gradient-to-r from-white to-slate-50 text-hotel-gray-md hover:border-hotel-blue/40 hover:text-hotel-blue'
                            }`}
                            aria-label={isExpanded ? 'Recolher detalhes da SI' : 'Expandir detalhes da SI para visualizar e baixar anexos'}
                            title={isExpanded ? 'Recolher detalhes' : (hasDownloadables ? 'Clique para ver e baixar anexos' : 'Clique para ver detalhes')}
                        >
                            {!isExpanded && hasDownloadables && <Download size={13} className="transition-transform duration-200 group-hover:scale-110" />}
                            <span className="hidden sm:inline">{isExpanded ? 'Recolher' : (hasDownloadables ? 'Ver anexos' : 'Detalhes')}</span>
                            {isExpanded ? <ChevronUp size={17} className="transition-transform duration-200 group-hover:-translate-y-0.5" /> : <ChevronDown size={17} className={`transition-transform duration-200 group-hover:translate-y-0.5 ${!isExpanded && hasDownloadables ? 'animate-bounce' : ''}`} />}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-hotel-gray/50 animate-fadeIn space-y-3">
                        <p className="text-sm font-body text-gray-700 leading-relaxed">{os.descricao}</p>

                        {os.imagem && (
                            <div className="rounded-xl overflow-hidden border border-hotel-gray">
                                <div className="flex items-center gap-2 px-3 py-2 bg-hotel-light border-b border-hotel-gray">
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

                        <div className="grid sm:grid-cols-2 gap-3 text-xs font-body text-hotel-gray-md">
                            <div>
                                <span className="font-semibold text-hotel-blue">Criado por:</span>{' '}
                                {os.criado_por_nome} em {format(parseISO(os.criado_em), 'dd/MM/yyyy HH:mm')}
                            </div>
                            <div>
                                <span className="font-semibold text-hotel-blue">Responsável:</span>{' '}
                                {os.responsavel_nome}
                                {Array.isArray(os.co_responsaveis) && os.co_responsaveis.length > 0 && (
                                    <span className="text-hotel-gray-md"> + {os.co_responsaveis.map((c) => c.nome).join(', ')}</span>
                                )}
                            </div>
                        </div>

                        {os.status === StatusOS.EM_ANDAMENTO && (
                            <div className="pt-1">
                                <button
                                    onClick={() => setAdicionarObsModal({ open: true, os })}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-hotel-blue/30 px-3 py-2 text-sm text-hotel-blue font-semibold font-body transition-colors hover:bg-hotel-light sm:w-auto"
                                >
                                    <PDCABadge etapa={os.etapa_pdca} status={os.status} compact /> Registrar Progresso
                                </button>
                            </div>
                        )}

                        {os.historico?.length > 0 && (
                            <div className="pt-1">
                                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-hotel-blue font-body">
                                    <Clock3 size={12} /> Histórico de atualizações
                                </p>
                                <div className="max-h-56 overflow-y-auto pr-1">
                                    <ol className="relative ml-3 space-y-5 border-l-2 border-hotel-gray">
                                        {[...os.historico].reverse().map((h, i) => (
                                            <li key={i} className="ml-5 relative">
                                                {/* Ponto da timeline */}
                                                <span className="absolute -left-[29px] top-0.5 w-4 h-4 rounded-full bg-hotel-gold border-2 border-white shadow-sm" />
                                                <p className="text-xs text-hotel-gray-md font-body">
                                                    {format(parseISO(h.data), "dd/MM/yyyy 'às' HH:mm")}
                                                    {' · '}
                                                    <strong className="text-hotel-blue">{h.usuario_nome}</strong>
                                                    {h.prazo_estimado && (
                                                        <>
                                                            {' · Prazo estimado: '}
                                                            <span className="text-hotel-gold font-semibold">{format(parseISO(h.prazo_estimado), 'dd/MM/yyyy')}</span>
                                                        </>
                                                    )}
                                                </p>
                                                <div className="mt-1.5 rounded-xl border border-hotel-gray/40 bg-hotel-light/30 px-3 py-2.5">
                                                    <p className="text-sm font-body text-gray-700">{h.descricao}</p>
                                                    {h.anexo_pdf_url && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-hotel-blue/10 px-2.5 py-1 text-[11px] font-semibold text-hotel-blue">
                                                                <Paperclip size={11} /> PDF anexado
                                                            </span>
                                                            <a
                                                                href={h.anexo_pdf_url}
                                                                download={h.anexo_pdf_nome || 'anexo.pdf'}
                                                                className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-blue hover:text-hotel-gold"
                                                            >
                                                                <Download size={11} /> {h.anexo_pdf_nome || 'Abrir anexo'}
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        )}
                    </div>
                )}
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

                {/* Barra de ações */}
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                    {/* Busca */}
                    <div className="relative min-w-0 flex-1 lg:min-w-[220px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-gray-md" />
                        <input
                            type="search"
                            className="input pl-9 py-2 text-sm"
                            placeholder="Buscar SI..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Filtros — somente diretora vê filtro por líder */}
                    <MultiSelectFilter
                        title="Todos os status"
                        selectedValues={filterStatus}
                        options={Object.entries(StatusLabel).map(([k, v]) => ({ value: k, label: v }))}
                        onToggle={(value) => toggleInFilter(setFilterStatus, filterStatus, value)}
                        onClear={() => setFilterStatus([])}
                    />

                    <MultiSelectFilter
                        title="Todas as etapas PDCA"
                        selectedValues={filterPdca}
                        options={Object.entries(PDCALabel).map(([k, v]) => ({ value: k, label: `${k} - ${v}` }))}
                        onToggle={(value) => toggleInFilter(setFilterPdca, filterPdca, value)}
                        onClear={() => setFilterPdca([])}
                    />

                    {isDiretora && (
                        <MultiSelectFilter
                            title="Todos os líderes"
                            selectedValues={filterLider}
                            options={lideres.map((lider) => ({ value: lider.id, label: lider.nome }))}
                            onToggle={(value) => toggleInFilter(setFilterLider, filterLider, value)}
                            onClear={() => setFilterLider([])}
                        />
                    )}

                    <MultiSelectFilter
                        title="Todos os depto."
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
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-hotel-gray/50 bg-white p-3 sm:flex-row sm:flex-nowrap sm:items-center">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-hotel-blue font-body">
                        <CalendarRange size={14} /> Período do Prazo:
                    </span>
                    <DatePicker
                        selectsRange
                        startDate={prazoInicio}
                        endDate={prazoFim}
                        onChange={(update) => setPrazoRange(update)}
                        isClearable
                        dateFormat="dd/MM/yyyy"
                        locale={ptBR}
                        className="input w-full py-1.5 text-xs sm:w-[220px]"
                        placeholderText="Selecione o período do prazo"
                    />
                    {(prazoInicio || prazoFim) && (
                        <button
                            onClick={() => setPrazoRange([null, null])}
                            className="inline-flex items-center justify-center rounded-full border border-hotel-gray/70 bg-hotel-light px-3 py-1.5 text-xs font-semibold text-hotel-blue transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        >
                            Limpar período
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={exportarCsv}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                </div>

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
                                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2">
                                        <p className="text-xs font-semibold text-hotel-blue">SIs ativas</p>
                                    </div>
                                    {activeOrders.map(renderOrderCard)}
                                </div>
                            )}
                            {completedOrders.length > 0 && (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2">
                                        <p className="text-xs font-semibold text-emerald-700">SIs concluídas</p>
                                    </div>
                                    {completedOrders.map(renderOrderCard)}
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
        </AppLayout>
    );
}
