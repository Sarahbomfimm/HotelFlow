import { useMemo, useState } from 'react';
import { ArrowLeft, MoveRight, ClipboardCheck, Clock3, UserRound, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/Layout/AppLayout';
import StatusBadge from '../../components/Badge/StatusBadge';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { ApprovalStage, ApprovalStageLabel, StatusOS } from '../../models/OrdemDeServico';
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

export default function Aprovacoes() {
    const navigate = useNavigate();
    const { ordens, getOSPorLider, moverAprovacaoFinalizacao } = useOS();
    const { user } = useAuth();
    const { currentUserProfile } = useUsers();
    const { addNotification } = useNotification();

    const actor = currentUserProfile || user;
    const canMove = hasPermission(actor, PERMISSIONS.SI_APPROVALS_MOVE);
    const canViewAll = hasPermission(actor, PERMISSIONS.SI_APPROVALS_VIEW_ALL);
    const actorDepartments = actor?.departamentos || [];
    const [draggingId, setDraggingId] = useState(null);

    const visibleOrders = useMemo(() => {
        if (canViewAll) {
            return ordens;
        }

        return getOSPorLider(actorDepartments, actor);
    }, [actor, actorDepartments, canViewAll, getOSPorLider, ordens]);

    const approvalOrders = useMemo(() => {
        return visibleOrders
            .filter((order) => [ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE, ApprovalStage.FINALIZADA].includes(order.aprovacao_finalizacao_status))
            .filter((order) => {
                if (canViewAll) {
                    return true;
                }

                return (
                    matchesOrderActor(order, actor, 'responsavel')
                    || matchesOrderActor(order, actor, 'criado_por')
                );
            })
            .sort((left, right) => new Date(right.aprovacao_finalizacao_solicitada_em || right.criado_em) - new Date(left.aprovacao_finalizacao_solicitada_em || left.criado_em));
    }, [visibleOrders, canViewAll, actor]);

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

        if (!orderId || !canMove) {
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
        if (!canMove) {
            return;
        }

        try {
            await moverAprovacaoFinalizacao(order.id, destination, actor);
            addNotification(`SI movida para "${ApprovalStageLabel[destination]}".`, destination === ApprovalStage.FINALIZADA ? 'success' : 'info');
        } catch (error) {
            addNotification(error.message || 'Nao foi possivel mover a SI no kanban.', 'error');
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
                        className="flex items-center gap-2 rounded-xl bg-hotel-blue px-4 py-2 text-sm font-semibold font-body text-white shadow-sm transition-all hover:bg-hotel-blue/90"
                    >
                        <ArrowLeft size={16} /> Voltar
                    </button>
                    <div>
                        <h1 className="font-heading text-xl font-bold text-hotel-blue">Aprovações</h1>
                        <p className="text-xs text-hotel-gray-md">Esteira de aprovação para finalização das SI solicitadas pelos líderes.</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-hotel-gray/50 bg-white p-4 text-xs text-hotel-gray-md">
                    {canMove
                        ? 'Arraste os cards entre as colunas para conduzir a aprovação. Ao mover para "Finalizadas", a SI será concluída automaticamente.'
                        : 'Você possui acesso de visualização. Somente usuários autorizados no Gerenciamento podem mover os cards.'}
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
                                className={`flex min-h-[26rem] flex-col rounded-2xl border bg-white p-3 ${style.border}`}
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

                                        return (
                                            <article
                                                key={order.id}
                                                draggable={canMove}
                                                onDragStart={(event) => {
                                                    if (!canMove) return;
                                                    setDraggingId(order.id);
                                                    event.dataTransfer.setData('text/plain', order.id);
                                                }}
                                                onDragEnd={() => setDraggingId(null)}
                                                onClick={() => navigate('/ordens', { state: { expandOsId: order.id } })}
                                                className={`rounded-xl border border-hotel-gray/60 bg-white p-3 shadow-sm transition-all hover:border-hotel-blue/50 hover:shadow-md cursor-pointer ${canMove ? 'cursor-grab active:cursor-grabbing hover:bg-hotel-light/40' : ''}`}
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

                                                {canMove && nextStages.length > 0 && order.status !== StatusOS.CONCLUIDO && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
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
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </AppLayout>
    );
}
