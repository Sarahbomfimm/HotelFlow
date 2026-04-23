import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle,
    Users, TrendingUp, Plus, ArrowRight,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { StatusOS, StatusLabel, PDCAStep } from '../../models/OrdemDeServico';
import { format, isPast, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatCard({ icon: Icon, label, value, colorClass, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`card flex items-center gap-3 text-left transition-shadow hover:shadow-card-hover sm:gap-4
                  ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon size={22} className="text-white" />
            </div>
            <div>
                <p className="text-2xl font-heading font-bold text-hotel-blue">{value}</p>
                <p className="text-xs text-hotel-gray-md font-body">{label}</p>
            </div>
        </button>
    );
}

function PDCAStatCard({ etapa, total, onClick }) {
    const config = {
        [PDCAStep.PLAN]: { label: 'Planejar', colorClass: 'bg-red-500' },
        [PDCAStep.DO]: { label: 'Executar', colorClass: 'bg-blue-500' },
        [PDCAStep.CHECK]: { label: 'Checar', colorClass: 'bg-amber-500' },
        [PDCAStep.ACT]: { label: 'Agir', colorClass: 'bg-emerald-500' },
    };
    const { label, colorClass } = config[etapa];

    return (
        <button
            onClick={onClick}
            className="card flex items-center gap-3 text-left transition-shadow hover:shadow-card-hover sm:gap-4"
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <span className="font-heading text-2xl font-bold text-white">{etapa}</span>
            </div>
            <div>
                <p className="text-2xl font-heading font-bold text-hotel-blue">{total}</p>
                <p className="text-xs text-hotel-gray-md font-body">{label}</p>
            </div>
        </button>
    );
}

export default function DashboardDiretora() {
    const { ordens, error: ordensError } = useOS();
    const { user } = useAuth();
    const { lideres } = useUsers();
    const navigate = useNavigate();

    const [filterLider, setFilterLider] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [tab, setTab] = useState('todas'); // 'todas' ou 'minhas'

    const hoje = new Date();

    // Apenas SIs criadas no mês atual
    const ordensMes = useMemo(
        () => ordens.filter((o) => o.criado_em && isSameMonth(parseISO(o.criado_em), hoje)),
        [ordens],
    );

    const stats = useMemo(() => ({
        total: ordensMes.length,
        abertas: ordensMes.filter((o) => o.status === StatusOS.ABERTO).length,
        em_andamento: ordensMes.filter((o) => o.status === StatusOS.EM_ANDAMENTO).length,
        concluidas: ordensMes.filter((o) => o.status === StatusOS.CONCLUIDO).length,
        atrasadas: ordensMes.filter(
            (o) => o.status !== StatusOS.CONCLUIDO && isPast(parseISO(o.prazo)),
        ).length,
    }), [ordensMes]);

    // SIs designadas para Sofia no mês atual
    const minhasSIs = useMemo(() => {
        return ordensMes.filter((os) => os.responsavel_id === user?.id || os.responsavel_uid === user?.firebaseUid);
    }, [ordensMes, user]);

    const pdcaBase = tab === 'minhas' ? minhasSIs : ordensMes;

    const pdcaStats = useMemo(() => ({
        [PDCAStep.PLAN]: pdcaBase.filter((o) => o.status !== StatusOS.ABERTO && o.etapa_pdca === PDCAStep.PLAN).length,
        [PDCAStep.DO]: pdcaBase.filter((o) => o.status !== StatusOS.ABERTO && o.etapa_pdca === PDCAStep.DO).length,
        [PDCAStep.CHECK]: pdcaBase.filter((o) => o.status !== StatusOS.ABERTO && o.etapa_pdca === PDCAStep.CHECK).length,
        [PDCAStep.ACT]: pdcaBase.filter((o) => o.status !== StatusOS.ABERTO && o.etapa_pdca === PDCAStep.ACT).length,
    }), [pdcaBase]);

    const base = tab === 'minhas' ? minhasSIs : ordensMes;

    const ordensFiltradas = useMemo(() => {
        return base
            .filter((o) => !filterLider || o.responsavel_id === filterLider)
            .filter((o) => !filterStatus || o.status === filterStatus)
            .slice(0, 8);
    }, [base, filterLider, filterStatus]);

    return (
        <AppLayout pageTitle="Dashboard — Diretora">
            {ordensError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700">
                    {ordensError}
                </div>
            )}
            {/* Saudação */}
            <div className="mb-6">
                <h1 className="font-heading text-xl font-bold text-hotel-blue sm:text-2xl">
                    Olá, {user?.nome}! 👋
                </h1>
                <p className="text-hotel-gray-md font-body text-sm mt-1">
                    {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
            </div>

            {/* Cards de estatísticas */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <StatCard
                    icon={ClipboardList}
                    label="Total este mês"
                    value={stats.total}
                    colorClass="bg-hotel-blue"
                    onClick={() => navigate('/ordens', { state: { onlyCurrentMonth: true } })}
                />
                <StatCard
                    icon={AlertCircle}
                    label="Abertas este mês"
                    value={stats.abertas}
                    colorClass="bg-blue-500"
                    onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.ABERTO, onlyCurrentMonth: true } })}
                />
                <StatCard
                    icon={Clock}
                    label="Em Andamento"
                    value={stats.em_andamento}
                    colorClass="bg-amber-500"
                    onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.EM_ANDAMENTO, onlyCurrentMonth: true } })}
                />
                <StatCard
                    icon={CheckCircle2}
                    label="Concluídas este mês"
                    value={stats.concluidas}
                    colorClass="bg-emerald-500"
                    onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.CONCLUIDO, onlyCurrentMonth: true } })}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Atrasadas este mês"
                    value={stats.atrasadas}
                    colorClass="bg-red-500"
                    onClick={() => navigate('/ordens', { state: { onlyOverdue: true, onlyCurrentMonth: true } })}
                />
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <PDCAStatCard
                    etapa={PDCAStep.PLAN}
                    total={pdcaStats[PDCAStep.PLAN]}
                    onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.PLAN, pdcaOnly: true, onlyCurrentMonth: true, onlyMine: tab === 'minhas' } })}
                />
                <PDCAStatCard
                    etapa={PDCAStep.DO}
                    total={pdcaStats[PDCAStep.DO]}
                    onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.DO, pdcaOnly: true, onlyCurrentMonth: true, onlyMine: tab === 'minhas' } })}
                />
                <PDCAStatCard
                    etapa={PDCAStep.CHECK}
                    total={pdcaStats[PDCAStep.CHECK]}
                    onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.CHECK, pdcaOnly: true, onlyCurrentMonth: true, onlyMine: tab === 'minhas' } })}
                />
                <PDCAStatCard
                    etapa={PDCAStep.ACT}
                    total={pdcaStats[PDCAStep.ACT]}
                    onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.ACT, pdcaOnly: true, onlyCurrentMonth: true, onlyMine: tab === 'minhas' } })}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* OS Recentes com filtros */}
                <div className="lg:col-span-2 card animate-fadeIn">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="font-heading font-semibold text-hotel-blue text-base">
                            Solicitações Internas
                        </h3>
                        <button
                            onClick={() => navigate('/nova-os')}
                            className="btn-primary flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs sm:w-auto"
                        >
                            <Plus size={14} /> Nova SI
                        </button>
                    </div>

                    {/* Abas */}
                    <div className="mb-4 flex gap-2 border-b border-hotel-gray">
                        <button
                            onClick={() => { setTab('todas'); setFilterLider(''); setFilterStatus(''); }}
                            className={`pb-2 px-2 text-sm font-semibold font-body transition-colors ${
                                tab === 'todas' 
                                    ? 'text-hotel-blue border-b-2 border-hotel-blue' 
                                    : 'text-hotel-gray-md hover:text-hotel-blue'
                            }`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => { setTab('minhas'); setFilterLider(''); setFilterStatus(''); }}
                            className={`pb-2 px-2 text-sm font-semibold font-body transition-colors ${
                                tab === 'minhas' 
                                    ? 'text-hotel-blue border-b-2 border-hotel-blue' 
                                    : 'text-hotel-gray-md hover:text-hotel-blue'
                            }`}
                        >
                            Minhas SIs ({minhasSIs.length})
                        </button>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        {tab === 'todas' && (
                            <select
                                value={filterLider}
                                onChange={(e) => setFilterLider(e.target.value)}
                                className="input py-1.5 text-xs w-auto flex-1 min-w-[140px]"
                            >
                                <option value="">Todos os líderes</option>
                                {lideres.map((l) => (
                                    <option key={l.id} value={l.id}>{l.nome}</option>
                                ))}
                            </select>
                        )}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="input py-1.5 text-xs w-auto flex-1 min-w-[130px]"
                        >
                            <option value="">Todos os status</option>
                            {Object.entries(StatusLabel).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                        {((tab === 'todas' && filterLider) || filterStatus) && (
                            <button
                                onClick={() => { setFilterLider(''); setFilterStatus(''); }}
                                className="text-xs text-hotel-gray-md hover:text-red-500 transition-colors px-2"
                            >
                                Limpar
                            </button>
                        )}
                    </div>

                    {/* Lista */}
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {ordensFiltradas.length === 0 ? (
                            <p className="text-center text-hotel-gray-md text-sm py-10">
                                Nenhuma SI encontrada com os filtros selecionados.
                            </p>
                        ) : (
                            ordensFiltradas.map((os) => {
                                const atrasada = os.status !== StatusOS.CONCLUIDO && isPast(parseISO(os.prazo));
                                return (
                                    <div
                                        key={os.id}
                                        className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-hotel-light cursor-pointer sm:flex-row sm:items-center
                                ${atrasada ? 'border-red-200 bg-red-50/30' : 'border-hotel-gray/50'}`}
                                        onClick={() => navigate('/ordens', { state: { expandOsId: os.id } })}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold font-body text-hotel-blue truncate">{os.titulo}</p>
                                            <p className="text-xs text-hotel-gray-md font-body mt-0.5">
                                                {os.departamento} · {os.responsavel_nome}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1.5 sm:items-end flex-shrink-0">
                                            <StatusBadge status={os.status} />
                                            <PDCABadge etapa={os.etapa_pdca} status={os.status} compact />
                                            <span className={`text-[11px] font-body ${atrasada ? 'text-red-500 font-semibold' : 'text-hotel-gray-md'}`}>
                                                {atrasada ? '⚠ Atrasada' : format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {ordens.length > 8 && (
                        <button
                            onClick={() => navigate('/ordens')}
                            className="mt-3 w-full text-xs text-hotel-blue hover:text-hotel-gold font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                            Ver todas <ArrowRight size={14} />
                        </button>
                    )}
                </div>

                {/* Resumo por líder */}
                <div className="card animate-fadeIn">
                    <h3 className="font-heading font-semibold text-hotel-blue text-base mb-4 flex items-center gap-2">
                        <Users size={18} /> Resumo por Líder
                    </h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {lideres.map((lider) => {
                            const total = ordens.filter((o) => o.responsavel_id === lider.id).length;
                            const concl = ordens.filter((o) => o.responsavel_id === lider.id && o.status === StatusOS.CONCLUIDO).length;
                            const pct = total > 0 ? Math.round((concl / total) * 100) : 0;
                            return (
                                <div key={lider.id} className="space-y-1">
                                    <div className="flex justify-between text-xs font-body">
                                        <span className="font-semibold text-hotel-blue">{lider.nome}</span>
                                        <span className="text-hotel-gray-md">{concl}/{total}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-hotel-gray overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-hotel-gold transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-hotel-gray-md font-body">
                                        {lider.departamentos.join(', ')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
