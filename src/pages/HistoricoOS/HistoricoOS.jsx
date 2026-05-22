import { useMemo, useState } from 'react';
import { History, Search, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
            return actorEmail && responsavelEmail && actorEmail === responsavelEmail;
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
    return actorEmail && orderEmail && actorEmail === orderEmail;
}

function matchesLeader(os, leaderId) {
    if (!leaderId) return true;
    if (os.responsavel_id === leaderId) return true;
    return Array.isArray(os.co_responsaveis) && os.co_responsaveis.some((responsavel) => responsavel.id === leaderId);
}

export default function HistoricoOS() {
    const { ordens } = useOS();
    const { user } = useAuth();
    const { lideres, currentUserProfile } = useUsers();
    const [filterLider, setFilterLider] = useState('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);
    const actor = currentUserProfile || user;
    const isManagement = actor?.role === UserRole.DIRETORA || actor?.role === UserRole.ADMIN;
    const actorDepartments = actor?.departamentos || [];

    const ordensVisiveis = useMemo(() => {
        if (isManagement) {
            return ordens;
        }

        return ordens.filter((o) =>
            matchesOrderActor(o, actor, 'criado_por')
            || (matchesOrderActor(o, actor, 'responsavel') && actorDepartments.includes(o.departamento)));
    }, [isManagement, ordens, actor, actorDepartments]);

    // Apenas SI com histórico de alterações (>1 entrada)
    const comHistorico = useMemo(() =>
        ordensVisiveis
            .filter((o) => o.historico.length > 0)
            .filter((o) => matchesLeader(o, filterLider))
            .filter((o) => {
                if (!search) return true;
                const q = search.toLowerCase();
                return o.titulo.toLowerCase().includes(q) || o.departamento.toLowerCase().includes(q);
            })
            .sort((a, b) => {
                // Mais recentemente modificadas primeiro
                const lastA = a.historico[a.historico.length - 1]?.data ?? a.criado_em;
                const lastB = b.historico[b.historico.length - 1]?.data ?? b.criado_em;
                return new Date(lastB) - new Date(lastA);
            }),
        [ordensVisiveis, filterLider, search]);

    return (
        <AppLayout pageTitle="Histórico de Alterações">
            <div className="animate-fadeIn">
                <div className="mb-2">
                    <h1 className="flex items-center gap-2 font-heading text-xl font-bold text-hotel-blue">
                        <History size={22} /> Histórico de SI
                    </h1>
                    <p className="text-hotel-gray-md text-sm font-body mt-0.5">
                        Todas as alterações e eventos registrados nas solicitações internas.
                    </p>
                </div>

                {/* Filtros */}
                <div className="mb-5 mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-gray-md" />
                        <input
                            type="search"
                            className="input pl-9 py-2 text-sm"
                            placeholder="Buscar por título ou departamento..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {isManagement && (
                        <select
                            value={filterLider}
                            onChange={(e) => setFilterLider(e.target.value)}
                            className="input w-full py-2 text-sm sm:w-auto"
                        >
                            <option value="">Todos SI líderes</option>
                            {lideres.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                        </select>
                    )}
                    {(search || filterLider) && (
                        <button
                            onClick={() => { setSearch(''); setFilterLider(''); }}
                            className="text-sm text-hotel-gray-md hover:text-red-500 transition-colors"
                        >
                            Limpar
                        </button>
                    )}
                </div>

                <p className="text-xs text-hotel-gray-md font-body mb-3">
                    {comHistorico.length} SI com registro de histórico
                </p>

                {/* Lista */}
                <div className="space-y-4">
                    {comHistorico.length === 0 ? (
                        <div className="card flex flex-col items-center py-16 gap-3">
                            <History size={36} className="text-hotel-gray" />
                            <p className="text-hotel-gray-md font-body text-sm">Nenhum histórico encontrado.</p>
                        </div>
                    ) : (
                        comHistorico.map((os) => {
                            const isOpen = expanded === os.id;
                            return (
                                <div key={os.id} className="card">
                                    {/* Cabeçalho da SI */}
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : os.id)}
                                        className="flex w-full items-start gap-3 text-left"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <StatusBadge status={os.status} />
                                                <PDCABadge etapa={os.etapa_pdca} status={os.status} compact />
                                                <span className="text-xs bg-hotel-gray text-hotel-blue px-2 py-0.5 rounded-full font-body font-medium">
                                                    {os.departamento}
                                                </span>
                                            </div>
                                            <h4 className="font-semibold font-body text-hotel-blue text-sm">{os.titulo}</h4>
                                            <p className="text-xs text-hotel-gray-md font-body mt-0.5 flex items-center gap-1">
                                                <User size={11} /> {os.responsavel_nome}
                                                <span className="mx-1">·</span>
                                                <Clock size={11} />
                                                {os.historico.length} evento{os.historico.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        <div className="text-hotel-gray-md flex-shrink-0 mt-1">
                                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </button>

                                    {/* Timeline */}
                                    {isOpen && (
                                        <div className="mt-5 pt-4 border-t border-hotel-gray/50 animate-fadeIn">
                                            <ol className="relative ml-3 space-y-5 border-l-2 border-hotel-gray">
                                                {[...os.historico].reverse().map((h, i) => (
                                                    <li key={i} className="ml-5 relative">
                                                        {/* Ponto da timeline */}
                                                        <span className="absolute -left-[29px] top-0.5 w-4 h-4 rounded-full bg-hotel-gold border-2 border-white shadow-sm" />
                                                        <p className="text-xs text-hotel-gray-md font-body">
                                                            {format(parseISO(h.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                            {' · '}
                                                            <strong className="text-hotel-blue">{h.usuario_nome}</strong>
                                                        </p>
                                                        <p className="text-sm font-body text-gray-700 mt-0.5">{h.descricao}</p>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
