import { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, MoveRight, ClipboardCheck, Clock3, UserRound, Building2, X,
    Eye, AlertTriangle, MessageSquare, RefreshCw, GitBranch, Paperclip, Download
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import AppLayout from '../../components/Layout/AppLayout';
import StatusBadge from '../../components/Badge/StatusBadge';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { ApprovalStage, ApprovalStageLabel, StatusOS, PDCALabel, PDCAStep } from '../../models/OrdemDeServico';
import { hasPermission, PERMISSIONS } from '../../services/permissions';

const COLUMNS = [ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE, ApprovalStage.FINALIZADA];

const COLUMN_STYLE = {
    [ApprovalStage.SOLICITADA]: {
        border: 'border-amber-200',
        header: 'bg-amber-50 text-amber-700',
    },
    [ApprovalStage.EM_ANALISE]: {
        border: 'border-blue-200',
        header: 'bg-blue-50 text-blue-700',
    },
    [ApprovalStage.FINALIZADA]: {
        border: 'border-emerald-200',
        header: 'bg-emerald-50 text-emerald-700',
    },
};

const parseTimelineDescription = (descricao, isEtapa, isStatus) => {
    if (!descricao) return { contentElement: null, adjustments: [] };

    // 1. Separate adjustments
    const parts = descricao.split('\n\n[Ajuste em ');
    const mainDesc = parts[0];
    const adjustments = parts.slice(1).map(part => {
        const closingBraceIndex = part.indexOf(']:');
        if (closingBraceIndex === -1) return { meta: '', detail: part };
        const meta = part.substring(0, closingBraceIndex); // "15/07/2026 às 14:13 por Sarah"
        const detail = part.substring(closingBraceIndex + 2).trim(); // "Foto removida. Motivo: teste de remoção"
        return { meta, detail };
    });

    // 2. Format the main description
    let contentElement = null;

    if (isEtapa) {
        const regexEtapa = /Etapa PDCA alterada de \[(.*?)\] para \[(.*?)\]/i;
        const match = mainDesc.replace(/🔄/g, '').match(regexEtapa);
        if (match) {
            const deStage = match[1];
            const paraStage = match[2];
            
            // Extract optional observação
            let obsText = '';
            const obsIdx = mainDesc.indexOf('Observação:');
            if (obsIdx !== -1) {
                obsText = mainDesc.substring(obsIdx + 11).trim();
            }

            contentElement = (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                        <span className="text-hotel-gray-md font-normal font-body">Etapa PDCA:</span>
                        <span className="px-2 py-0.5 rounded-full bg-hotel-light text-hotel-blue border border-hotel-gray/30 text-[11px]">
                            {deStage}
                        </span>
                        <span className="text-hotel-gray-md">→</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 font-bold text-[11px] shadow-sm animate-pulse-slow">
                            {paraStage}
                        </span>
                    </div>
                    {obsText && (
                        <p className="mt-1 text-sm text-slate-800 leading-6 border-l-2 border-amber-300 pl-3 italic font-body">
                            "{obsText}"
                        </p>
                    )}
                </div>
            );
        }
    } else if (isStatus) {
        const regexStatus = /Status alterado de \[(.*?)\] para \[(.*?)\]/i;
        const match = mainDesc.replace(/🚀/g, '').match(regexStatus);
        if (match) {
            const deStatus = match[1];
            const paraStatus = match[2];
            
            // Extract optional observação
            let obsText = '';
            const obsIdx = mainDesc.indexOf('Observação:');
            if (obsIdx !== -1) {
                obsText = mainDesc.substring(obsIdx + 11).trim();
            }

            contentElement = (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                        <span className="text-hotel-gray-md font-normal font-body">Status da SI:</span>
                        <span className="px-2 py-0.5 rounded-full bg-hotel-light text-hotel-blue border border-hotel-gray/30 text-[11px]">
                            {deStatus}
                        </span>
                        <span className="text-hotel-gray-md">→</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-hotel-blue/5 text-hotel-blue border border-hotel-blue/30 font-bold text-[11px] shadow-sm">
                            {paraStatus}
                        </span>
                    </div>
                    {obsText && (
                        <p className="mt-1 text-sm text-slate-800 leading-6 border-l-2 border-hotel-blue pl-3 italic font-body">
                            "{obsText}"
                        </p>
                    )}
                </div>
            );
        }
    }

    if (!contentElement) {
        const stageMatch = mainDesc.match(/^Progresso\s*\[([PDCAD])\]:(.*)/is);
        if (stageMatch) {
            const stepChar = stageMatch[1];
            const cleanText = stageMatch[2].trim();
            contentElement = (
                <div className="space-y-1.5">
                    <div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            stepChar === 'P' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                            stepChar === 'D' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            stepChar === 'C' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                            Etapa {stepChar} - {PDCALabel[stepChar]}
                        </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-6 font-body whitespace-pre-line">{cleanText}</p>
                </div>
            );
        } else {
            contentElement = (
                <p className="text-sm text-slate-700 leading-6 font-body whitespace-pre-line">{mainDesc}</p>
            );
        }
    }

    return { contentElement, adjustments };
};

function HistoricoOSModal({ isOpen, onClose, os }) {
    if (!isOpen || !os) return null;

    const historico = (os.historico || []).filter((h) => {
        const desc = h.descricao || '';
        return (
            desc.includes('Fluxo de aprovação') || 
            desc.includes('finalização recusada') || 
            desc.includes('finalização enviada')
        );
    });

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between border-b border-hotel-gray/20 px-5 py-4 sm:px-6 shrink-0">
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold text-hotel-gold uppercase tracking-wider">Histórico de Alterações</span>
                        <h3 className="font-heading text-base font-bold text-hotel-blue truncate mt-0.5">{os.titulo}</h3>
                    </div>
                    <button onClick={onClose} className="text-hotel-gray-md transition-colors hover:text-hotel-blue p-1.5 rounded-xl hover:bg-hotel-light">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 min-h-0">
                    {historico.length === 0 ? (
                        <p className="text-sm text-hotel-gray-md text-center py-6">Nenhum log de movimentação de aprovação registrado para esta SI.</p>
                    ) : (
                        [...historico].reverse().map((h, index) => {
                            const isEtapa = h.tipo === 'etapa' || h.descricao.includes('Etapa PDCA alterada') || h.descricao.includes('alteração de etapa');
                            const isStatus = h.tipo === 'status' || h.descricao.includes('Status alterado');
                            
                            let cardClass = 'border-hotel-gray/30 bg-hotel-light/20';
                            let iconClass = 'bg-hotel-blue/10 text-hotel-blue';
                            let IconComponent = MessageSquare;
                            
                            if (isEtapa) {
                                cardClass = 'border-amber-300 bg-amber-50/30';
                                iconClass = 'bg-amber-100 text-amber-600 border border-amber-200';
                                IconComponent = RefreshCw;
                            } else if (isStatus) {
                                cardClass = 'border-hotel-blue/20 bg-hotel-blue/5';
                                iconClass = 'bg-hotel-blue/15 text-hotel-blue border border-hotel-blue/10';
                                IconComponent = GitBranch;
                            }

                            const { contentElement, adjustments } = parseTimelineDescription(h.descricao, isEtapa, isStatus);

                            return (
                                <div key={`${h.data}-${index}`} className={`flex gap-3 rounded-2xl border px-4 py-4 transition-all ${cardClass} animate-fadeIn`}>
                                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                                        <IconComponent size={14} className={isEtapa ? "animate-spin-slow" : ""} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-hotel-blue flex flex-wrap items-center gap-1.5 font-heading">
                                            <span>{h.usuario_nome}</span>
                                            <span className="text-[11px] font-normal text-hotel-gray-md font-sans">
                                                • {format(parseISO(h.data), "dd/MM/yyyy 'às' HH:mm")}
                                            </span>
                                            {h.prazo_estimado && (
                                                <span className="text-[11px] font-normal text-hotel-gold font-sans">
                                                    · Prazo: {format(parseISO(h.prazo_estimado), 'dd/MM/yyyy')}
                                                </span>
                                            )}
                                        </p>
                                        <div className="mt-2">
                                            {contentElement}
                                        </div>
                                        {h.anexo_pdf_url && (
                                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-hotel-blue/10 px-2.5 py-1 text-[11px] font-semibold text-hotel-blue font-body">
                                                    <Paperclip size={11} /> PDF anexado
                                                </span>
                                                <a
                                                    href={h.anexo_pdf_url}
                                                    download={h.anexo_pdf_nome || 'anexo.pdf'}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-blue hover:text-hotel-gold mr-3 font-body"
                                                    target="_blank" rel="noreferrer"
                                                >
                                                    <Download size={11} /> {h.anexo_pdf_nome || 'Abrir anexo'}
                                                </a>
                                            </div>
                                        )}
                                        {h.anexo_foto_url && (
                                            <div className="mt-3">
                                                <a
                                                    href={h.anexo_foto_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-block relative group rounded-xl overflow-hidden border border-hotel-gray/30 hover:border-hotel-gold transition-all"
                                                >
                                                    <img
                                                        src={h.anexo_foto_url}
                                                        alt={h.anexo_foto_nome || 'Foto do progresso'}
                                                        className="max-h-40 object-cover rounded-xl group-hover:scale-[1.03] transition-transform duration-200"
                                                    />
                                                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                                        Ver Foto Ampliada
                                                    </div>
                                                </a>
                                            </div>
                                        )}
                                        {adjustments.length > 0 && (
                                            <div className="mt-3 space-y-2 border-t border-dashed border-hotel-gray/30 pt-3">
                                                {adjustments.map((adj, i) => (
                                                    <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/10 p-3 text-xs font-body text-slate-600 shadow-sm animate-fadeIn">
                                                        <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                                                            <AlertTriangle size={13} className="shrink-0" />
                                                            <span>Ajuste de Registro</span>
                                                            <span className="text-[10px] text-hotel-gray-md font-normal font-sans">({adj.meta})</span>
                                                        </div>
                                                        <p className="mt-1 text-hotel-gray-dark leading-relaxed">
                                                            {adj.detail}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex justify-end border-t border-hotel-gray/20 px-5 py-4 sm:px-6 shrink-0">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-hotel-gray/50 bg-white px-5 py-2.5 text-sm font-semibold text-hotel-gray-md hover:bg-hotel-light transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

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

function ModalRecusaFinalizacao({ isOpen, onClose, onConfirm }) {
    const [motivo, setMotivo] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-hotel-gray/20 px-5 py-4 sm:px-6">
                    <h3 className="font-heading text-lg font-bold text-hotel-blue">Motivo da Recusa</h3>
                    <button onClick={() => { setMotivo(''); onClose(); }} className="text-hotel-gray-md transition-colors hover:text-hotel-blue">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 sm:p-6">
                    <p className="text-sm text-hotel-gray-md">Por favor, informe o motivo de estar recusando a finalização desta SI:</p>
                    <textarea
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="input mt-3 min-h-[100px] w-full resize-none"
                        placeholder="Ex: Faltou anexar a foto, Serviço incompleto..."
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

export default function Aprovacoes() {
    const navigate = useNavigate();
    const { ordens, getOSPorLider, moverAprovacaoFinalizacao, recusarFinalizacao } = useOS();
    const { user } = useAuth();
    const { currentUserProfile } = useUsers();
    const { addNotification } = useNotification();

    const actor = currentUserProfile || user;
    const isAdmin = actor?.role === UserRole.ADMIN || actor?.role === 'admin';
    const canMove = isAdmin || hasPermission(actor, PERMISSIONS.SI_APPROVALS_MOVE);
    const canViewAll = isAdmin || hasPermission(actor, PERMISSIONS.SI_APPROVALS_VIEW_ALL);
    const actorDepartments = actor?.departamentos || [];
    const [draggingId, setDraggingId] = useState(null);
    const [modalRecusaAberto, setModalRecusaAberto] = useState(false);
    const [osParaRecusar, setOsParaRecusar] = useState(null);
    const [osParaHistorico, setOsParaHistorico] = useState(null);

    const podeMoverCard = useCallback((order) => {
        if (!order || !actor) return false;
        if (isAdmin || canMove) return true;
        return matchesOrderActor(order, actor, 'criado_por');
    }, [actor, canMove, isAdmin]);

    const visibleOrders = useMemo(() => {
        if (isAdmin || canViewAll) {
            return ordens;
        }

        return getOSPorLider(actorDepartments, actor);
    }, [actor, actorDepartments, canViewAll, isAdmin, getOSPorLider, ordens]);

    const approvalOrders = useMemo(() => {
        return visibleOrders
            .filter((order) => [ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE, ApprovalStage.FINALIZADA].includes(order.aprovacao_finalizacao_status))
            .filter((order) => {
                // Usuário ADMIN visualiza todas as SIs do módulo de aprovação independentemente de hierarquia ou participação
                if (isAdmin) return true;
                // SIs criadas pelo usuário logado (actor) ou que ele participe (como responsável ou co-responsável)
                return (
                    matchesOrderActor(order, actor, 'criado_por') ||
                    matchesOrderActor(order, actor, 'responsavel')
                );
            })
            .sort((left, right) => new Date(right.aprovacao_finalizacao_solicitada_em || right.criado_em) - new Date(left.aprovacao_finalizacao_solicitada_em || left.criado_em));
    }, [visibleOrders, actor, isAdmin]);

    const grouped = useMemo(() => {
        return COLUMNS.reduce((acc, column) => {
            acc[column] = approvalOrders.filter((order) => order.aprovacao_finalizacao_status === column);
            return acc;
        }, {});
    }, [approvalOrders]);

    const handleDrop = async (event, destination) => {
        event.preventDefault();
        const orderId = event.dataTransfer.getData('text/plain') || draggingId;
        setDraggingId(null);

        if (!orderId) {
            return;
        }

        const order = ordens.find((o) => o.id === orderId);
        if (!order || !podeMoverCard(order)) {
            return;
        }

        try {
            await moverAprovacaoFinalizacao(orderId, destination, actor);
            addNotification(`SI movida para "${ApprovalStageLabel[destination]}".`, destination === ApprovalStage.FINALIZADA ? 'success' : 'info');
        } catch (error) {
            addNotification(error.message || 'Nao foi possivel mover a SI no kanban.', 'error');
        }
    };

    const moveWithButton = async (order, destination) => {
        if (!podeMoverCard(order)) {
            return;
        }

        try {
            await moverAprovacaoFinalizacao(order.id, destination, actor);
            addNotification(`SI movida para "${ApprovalStageLabel[destination]}".`, destination === ApprovalStage.FINALIZADA ? 'success' : 'info');
        } catch (error) {
            addNotification(error.message || 'Nao foi possivel mover a SI no kanban.', 'error');
        }
    };

    const handleAbrirRecusa = (order) => {
        setOsParaRecusar(order);
        setModalRecusaAberto(true);
    };

    const handleConfirmarRecusa = async (motivo) => {
        if (!osParaRecusar || !podeMoverCard(osParaRecusar)) return;
        
        try {
            await recusarFinalizacao(osParaRecusar.id, actor, motivo);
            addNotification(`Solicitação de finalização da SI "${osParaRecusar.titulo}" recusada.`, 'warning');
        } catch (error) {
            addNotification(error.message || 'Não foi possível recusar a solicitação de finalização.', 'error');
        } finally {
            setModalRecusaAberto(false);
            setOsParaRecusar(null);
        }
    };


    const getNextStages = (currentStage) => {
        if (currentStage === ApprovalStage.SOLICITADA) {
            return [ApprovalStage.EM_ANALISE, ApprovalStage.FINALIZADA];
        }

        if (currentStage === ApprovalStage.EM_ANALISE) {
            return [ApprovalStage.SOLICITADA, ApprovalStage.FINALIZADA];
        }

        return [];
    };

    return (
        <AppLayout pageTitle="Aprovações de SI">
            <div className="animate-fadeIn space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="group flex items-center gap-1.5 rounded-xl border border-hotel-gray/50 bg-white px-3.5 py-1.5 text-xs font-semibold text-hotel-blue shadow-sm hover:border-hotel-gold/60 hover:bg-slate-50 transition-all duration-200"
                    >
                        <ArrowLeft size={14} className="text-hotel-blue/70 group-hover:text-hotel-gold group-hover:-translate-x-0.5 transition-transform" />
                        <span className="group-hover:text-hotel-gold transition-colors">Voltar</span>
                    </button>
                    <div>
                        <h1 className="font-heading text-xl font-bold text-hotel-blue">Aprovações</h1>
                        <p className="text-xs text-hotel-gray-md">Esteira de aprovação para finalização das SI solicitadas pelos líderes.</p>
                    </div>
                </div>


                <div className="grid gap-4 lg:grid-cols-3">
                    {COLUMNS.map((column) => {
                        const items = grouped[column] || [];
                        const style = COLUMN_STYLE[column];

                        return (
                            <section
                                key={column}
                                onDragOver={(event) => {
                                    if (canMove) {
                                        event.preventDefault();
                                    }
                                }}
                                onDrop={(event) => handleDrop(event, column)}
                                className={`flex h-[34rem] flex-col rounded-2xl border bg-white p-3 ${style.border}`}
                            >
                                <header className={`mb-3 flex items-center justify-between rounded-xl px-3 py-2 ${style.header}`}>
                                    <div className="flex items-center gap-2">
                                        <ClipboardCheck size={14} />
                                        <span className="text-sm font-semibold">{ApprovalStageLabel[column]}</span>
                                    </div>
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">
                                        {items.length}
                                    </span>
                                </header>

                                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                                    {items.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-hotel-gray/60 bg-hotel-light px-3 py-6 text-center text-xs text-hotel-gray-md">
                                            Nenhuma SI nesta coluna.
                                        </div>
                                    )}

                                    {items.map((order) => {
                                        const nextStages = getNextStages(order.aprovacao_finalizacao_status);
                                        const cardPodeMover = podeMoverCard(order);

                                        return (
                                            <article
                                                key={order.id}
                                                draggable={cardPodeMover}
                                                onDragStart={(event) => {
                                                    if (!cardPodeMover) return;
                                                    setDraggingId(order.id);
                                                    event.dataTransfer.setData('text/plain', order.id);
                                                }}
                                                onDragEnd={() => {
                                                    setDraggingId(null);
                                                    // Optionally, if the drag was successful, you might want to clear the state here
                                                }}
                                                onClick={() => navigate('/ordens', { state: { expandOsId: order.id } })}
                                                className={`rounded-xl border border-hotel-gray/60 bg-white p-3 shadow-sm transition-all hover:border-hotel-blue/50 hover:shadow-md cursor-pointer ${cardPodeMover ? 'cursor-grab active:cursor-grabbing hover:bg-hotel-light/40' : ''}`}
                                            >
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <StatusBadge status={order.status} />
                                                    <span className="rounded-full bg-hotel-light px-2 py-0.5 text-[11px] font-semibold text-hotel-blue">
                                                        {order.departamento}
                                                    </span>
                                                </div>

                                                <h3 className="line-clamp-2 text-sm font-semibold text-hotel-blue">{order.titulo}</h3>

                                                <div className="mt-2 space-y-1.5 text-xs text-hotel-gray-md">
                                                    <p className="flex items-center gap-1.5">
                                                        <UserRound size={12} /> {order.responsavel_nome}
                                                    </p>
                                                    <p className="flex items-center gap-1.5">
                                                        <Building2 size={12} /> {order.criado_por_nome}
                                                    </p>
                                                    <p className="flex items-center gap-1.5">
                                                        <Clock3 size={12} />
                                                        Solicitada em {new Date(order.aprovacao_finalizacao_solicitada_em || order.criado_em).toLocaleString('pt-BR')}
                                                    </p>
                                                </div>

                                                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-hotel-gray/10 pt-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOsParaHistorico(order);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-hotel-gray/30 bg-white text-hotel-blue font-semibold text-[11px] px-2.5 py-1 hover:bg-hotel-light transition-all shadow-sm"
                                                        title="Visualizar histórico de alterações"
                                                    >
                                                        <Eye size={13} />
                                                        <span>Ver logs</span>
                                                    </button>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {cardPodeMover && (order.aprovacao_finalizacao_status === ApprovalStage.SOLICITADA || order.aprovacao_finalizacao_status === ApprovalStage.EM_ANALISE) && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAbrirRecusa(order);
                                                                }}
                                                                className="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition-colors hover:border-red-500 hover:bg-red-100"
                                                            >
                                                                Recusar
                                                            </button>
                                                        )}

                                                        {cardPodeMover && nextStages.length > 0 && order.status !== StatusOS.CONCLUIDO && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {nextStages.map((stage) => (
                                                                    <button
                                                                        key={stage}
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            moveWithButton(order, stage);
                                                                        }}
                                                                        className="inline-flex items-center gap-1 rounded-full border border-hotel-gray/70 bg-hotel-light px-2.5 py-1 text-[11px] font-semibold text-hotel-blue transition-colors hover:border-hotel-blue/40 hover:bg-white"
                                                                    >
                                                                        <MoveRight size={11} /> {ApprovalStageLabel[stage]}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            <ModalRecusaFinalizacao
                isOpen={modalRecusaAberto}
                onClose={() => { setModalRecusaAberto(false); setOsParaRecusar(null); }}
                onConfirm={handleConfirmarRecusa}
            />

            <HistoricoOSModal
                isOpen={!!osParaHistorico}
                onClose={() => setOsParaHistorico(null)}
                os={osParaHistorico}
            />
        </AppLayout>
    );
}
