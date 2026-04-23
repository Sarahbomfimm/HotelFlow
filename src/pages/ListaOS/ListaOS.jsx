import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, Filter, ChevronDown, ChevronUp, Trash2,
    Edit3, Clock3, Plus, ArrowLeft, CalendarRange, Image as ImageIcon,
    Download,
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
import { StatusOS, StatusLabel, DEPARTAMENTOS, PDCAStep, PDCALabel } from '../../models/OrdemDeServico';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const nextStatus = {
    [StatusOS.ABERTO]: StatusOS.EM_ANDAMENTO,
    [StatusOS.EM_ANDAMENTO]: StatusOS.CONCLUIDO,
};
const nextLabel = {
    [StatusOS.ABERTO]: 'Iniciar',
    [StatusOS.EM_ANDAMENTO]: 'Concluir',
};

export default function ListaOS() {
    const { ordens, getOSPorLider, atualizarStatus, excluirOS, adicionarObservacao, error: ordensError } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { lideres } = useUsers();
    const navigate = useNavigate();
    const location = useLocation();
    const isDiretora = user?.role === UserRole.DIRETORA;

    // Inicializa filtros a partir de state passado pelo dashboard
    const locState = location.state || {};

    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState(locState.filterStatus || '');
    const [filterPdca, setFilterPdca] = useState(locState.filterPdca || '');
    const [filterLider, setFilterLider] = useState(locState.filterLider || '');
    const [filterDept, setFilterDept] = useState('');
    const [prazoInicio, setPrazoInicio] = useState('');
    const [prazoFim, setPrazoFim] = useState('');
    const [expanded, setExpanded] = useState(locState.expandOsId || null);
    const [toDelete, setToDelete] = useState(null);
    const [toEdit, setToEdit] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    // Modal de observação ao mudar status
    const [obsModal, setObsModal] = useState({ open: false, os: null, novoStatus: null });
    const [adicionarObsModal, setAdicionarObsModal] = useState({ open: false, os: null });

    const base = useMemo(() =>
        isDiretora ? ordens : getOSPorLider(user?.departamentos || [], user),
        [isDiretora, ordens, getOSPorLider, user],
    );

    const filtered = useMemo(() => {
        return base
            .filter((o) => !filterStatus || o.status === filterStatus)
            .filter((o) => !filterPdca || o.etapa_pdca === filterPdca)
            .filter((o) => !filterLider || o.responsavel_id === filterLider)
            .filter((o) => !filterDept || o.departamento === filterDept)
            .filter((o) => {
                if (!locState.onlyMine) return true;
                return o.responsavel_id === user?.id || o.responsavel_uid === user?.firebaseUid;
            })
            .filter((o) => {
                if (!prazoInicio) return true;
                return new Date(o.prazo) >= new Date(prazoInicio);
            })
            .filter((o) => {
                if (!prazoFim) return true;
                // Inclui o dia inteiro do fim
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
                    o.departamento.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                const diff = new Date(a.prazo) - new Date(b.prazo);
                return sortDir === 'asc' ? diff : -diff;
            });
    }, [base, filterStatus, filterPdca, filterLider, filterDept, prazoInicio, prazoFim, search, sortDir, locState.onlyMine, user]);

    // Abre modal de observação antes de confirmar mudança de status
    const solicitarStatusChange = async (os, status) => {
        // Líder iniciando: não pede observação imediatamente
        if (!isDiretora && status === StatusOS.EM_ANDAMENTO) {
            await atualizarStatus(os.id, status, user, '');
            addNotification(`SI "${os.titulo}" iniciada.`, 'info');
            return;
        }
        setObsModal({ open: true, os, novoStatus: status });
    };

    const confirmarStatusChange = async (observacao) => {
        const { os, novoStatus } = obsModal;
        setObsModal({ open: false, os: null, novoStatus: null });
        await atualizarStatus(os.id, novoStatus, user, observacao);
        addNotification(
            `SI "${os.titulo}" atualizada para ${StatusLabel[novoStatus]}.`,
            novoStatus === StatusOS.CONCLUIDO ? 'success' : 'info',
        );
    };

    const handleAdicionarObs = async (texto, etapaPdca) => {
        const { os } = adicionarObsModal;
        await adicionarObservacao(os.id, texto, user, etapaPdca);
        addNotification(`Progresso registrado na SI “${os.titulo}”.`, 'info');
        setAdicionarObsModal({ open: false, os: null });
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        await excluirOS(toDelete.id);
        addNotification(`SI "${toDelete.titulo}" excluída.`, 'warning');
        setToDelete(null);
    };

    const clearFilters = () => {
        setSearch(''); setFilterStatus(''); setFilterPdca(''); setFilterLider('');
        setFilterDept(''); setPrazoInicio(''); setPrazoFim('');
    };
    const hasFilters = search || filterStatus || filterPdca || filterLider || filterDept || prazoInicio || prazoFim;

    return (
        <AppLayout pageTitle={isDiretora ? 'Todas as Solicitações Internas' : 'Minhas Solicitações Internas'}>
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
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="input w-full py-2 text-sm sm:w-auto"
                    >
                        <option value="">Todos os status</option>
                        {Object.entries(StatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>

                    <select
                        value={filterPdca}
                        onChange={(e) => setFilterPdca(e.target.value)}
                        className="input w-full py-2 text-sm sm:w-auto"
                    >
                        <option value="">Todas as etapas PDCA</option>
                        {Object.entries(PDCALabel).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
                    </select>

                    {isDiretora && (
                        <select
                            value={filterLider}
                            onChange={(e) => setFilterLider(e.target.value)}
                            className="input w-full py-2 text-sm sm:w-auto"
                        >
                            <option value="">Todos os líderes</option>
                            {lideres.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                        </select>
                    )}

                    <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="input w-full py-2 text-sm sm:w-auto"
                    >
                        <option value="">Todos os depto.</option>
                        {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>

                    <button
                        onClick={() => setSortDir((v) => v === 'asc' ? 'desc' : 'asc')}
                        className="btn-secondary flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm sm:w-auto"
                        title="Ordenar por prazo"
                    >
                        <Clock3 size={15} />
                        {sortDir === 'asc' ? 'Prazo ↑' : 'Prazo ↓'}
                    </button>

                    {hasFilters && (
                        <button onClick={clearFilters} className="text-left text-sm text-hotel-gray-md transition-colors hover:text-red-500 sm:text-center">
                            Limpar filtros
                        </button>
                    )}

                    {isDiretora && (
                        <button onClick={() => navigate('/nova-os')} className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-2 text-sm sm:w-auto">
                            <Plus size={16} /> Nova SI
                        </button>
                    )}
                </div>

                {/* Filtro por período de prazo */}
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-hotel-gray/50 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-hotel-blue font-body">
                        <CalendarRange size={14} /> Período do Prazo:
                    </span>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-hotel-gray-md font-body">De</label>
                        <input
                            type="date"
                            className="input w-full py-1.5 text-xs sm:w-auto"
                            value={prazoInicio}
                            onChange={(e) => setPrazoInicio(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-hotel-gray-md font-body">Até</label>
                        <input
                            type="date"
                            className="input w-full py-1.5 text-xs sm:w-auto"
                            min={prazoInicio || undefined}
                            value={prazoFim}
                            onChange={(e) => setPrazoFim(e.target.value)}
                        />
                    </div>
                    {(prazoInicio || prazoFim) && (
                        <button
                            onClick={() => { setPrazoInicio(''); setPrazoFim(''); }}
                            className="text-xs text-hotel-gray-md hover:text-red-500 transition-colors"
                        >
                            Limpar período
                        </button>
                    )}
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
                        filtered.map((os) => {
                            const atrasada = os.status !== StatusOS.CONCLUIDO && isPast(parseISO(os.prazo));
                            const isExpanded = expanded === os.id;
                            const isResponsavel = user?.id === os.responsavel_id || user?.firebaseUid === os.responsavel_uid;
                            const podeAtualizar = os.status !== StatusOS.CONCLUIDO && isResponsavel;

                            return (
                                <div
                                    key={os.id}
                                    className={`card transition-all duration-200 ${atrasada ? 'border-red-200' : ''}`}
                                >
                                    {/* Linha principal */}
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
                                                {isDiretora ? `${os.responsavel_nome} · ` : ''}
                                                Prazo: <strong className={atrasada ? 'text-red-500' : ''}>
                                                    {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                                </strong>
                                            </p>
                                        </div>

                                        {/* Ações */}
                                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0 sm:justify-end">
                                            {podeAtualizar && nextStatus[os.status] === StatusOS.CONCLUIDO && (
                                                <PDCABadge etapa={os.etapa_pdca} status={os.status} />
                                            )}
                                            {podeAtualizar && (
                                                <button
                                                    onClick={() => solicitarStatusChange(os, nextStatus[os.status])}
                                                    className="btn-gold flex-1 px-3 py-1.5 text-xs sm:flex-none"
                                                >
                                                    {nextLabel[os.status]}
                                                </button>
                                            )}
                                            {isDiretora && (
                                                <button
                                                    onClick={() => setToEdit(os)}
                                                    className="p-1.5 rounded-lg text-hotel-gray-md hover:text-hotel-blue hover:bg-hotel-light transition-colors"
                                                    aria-label="Editar SI"
                                                >
                                                    <Edit3 size={15} />
                                                </button>
                                            )}
                                            {isDiretora && (
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
                                                className="p-1.5 rounded-lg text-hotel-gray-md hover:text-hotel-blue transition-colors"
                                                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                                            >
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Detalhe expandido */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-hotel-gray/50 animate-fadeIn space-y-3">
                                            <p className="text-sm font-body text-gray-700 leading-relaxed">{os.descricao}</p>

                                            {/* Imagem anexada */}
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
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-hotel-blue">Etapa PDCA:</span>{' '}
                                                    {os.etapa_pdca || PDCAStep.PLAN}
                                                </div>
                                            </div>

                                            {/* Registrar progresso — disponível enquanto em andamento */}
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
                                            {/* Histórico de atualizações */}
                                            {os.historico?.length > 0 && (
                                                <div className="pt-1">
                                                    <p className="text-xs font-semibold text-hotel-blue font-body mb-2 flex items-center gap-1.5">
                                                        <Clock3 size={12} /> Histórico de atualizações
                                                    </p>
                                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                        {[...os.historico].reverse().map((h, i) => (
                                                            <div key={i} className="flex flex-col text-xs font-body border-l-2 border-hotel-gold/50 pl-2.5 py-0.5">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-semibold text-hotel-blue">{h.usuario_nome}</span>
                                                                    <span className="text-hotel-gray-md">· {format(parseISO(h.data), 'dd/MM/yyyy HH:mm')}</span>
                                                                </div>
                                                                <p className="text-gray-700 mt-0.5">{h.descricao}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    )}
                                </div>
                            );
                        })
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
