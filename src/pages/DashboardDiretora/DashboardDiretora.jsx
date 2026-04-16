import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle,
    Users, TrendingUp, Plus, ArrowRight,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import StatusBadge from '../../components/Badge/StatusBadge';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { StatusOS, StatusLabel } from '../../models/OrdemDeServico';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatCard({ icon: Icon, label, value, colorClass, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`card flex items-center gap-4 hover:shadow-card-hover transition-shadow text-left
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

export default function DashboardDiretora() {
    const { ordens, error: ordensError } = useOS();
    const { user } = useAuth();
    const { lideres } = useUsers();
    const navigate = useNavigate();

    const [filterLider, setFilterLider] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const stats = useMemo(() => ({
        total: ordens.length,
        abertas: ordens.filter((o) => o.status === StatusOS.ABERTO).length,
        em_andamento: ordens.filter((o) => o.status === StatusOS.EM_ANDAMENTO).length,
        concluidas: ordens.filter((o) => o.status === StatusOS.CONCLUIDO).length,
        atrasadas: ordens.filter(
            (o) => o.status !== StatusOS.CONCLUIDO && isPast(parseISO(o.prazo)),
        ).length,
    }), [ordens]);

    const ordensFiltradas = useMemo(() => {
        return ordens
            .filter((o) => !filterLider || o.responsavel_id === filterLider)
            .filter((o) => !filterStatus || o.status === filterStatus)
            .slice(0, 8);
    }, [ordens, filterLider, filterStatus]);

    return (
        <AppLayout pageTitle="Dashboard — Diretora">
            {ordensError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700">
                    {ordensError}
                </div>
            )}
            {/* Saudação */}
            <div className="mb-6">
                <h1 className="font-heading font-bold text-hotel-blue text-2xl">
                    Olá, {user?.nome}! 👋
                </h1>
                <p className="text-hotel-gray-md font-body text-sm mt-1">
                    {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
            </div>

            {/* Cards de estatísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
                <StatCard icon={ClipboardList} label="Total de SI" value={stats.total} colorClass="bg-hotel-blue" onClick={() => navigate('/ordens', { state: {} })} />
                <StatCard icon={AlertCircle} label="Abertas" value={stats.abertas} colorClass="bg-blue-500" onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.ABERTO } })} />
                <StatCard icon={Clock} label="Em Andamento" value={stats.em_andamento} colorClass="bg-amber-500" onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.EM_ANDAMENTO } })} />
                <StatCard icon={CheckCircle2} label="Concluídas" value={stats.concluidas} colorClass="bg-emerald-500" onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.CONCLUIDO } })} />
                <StatCard icon={TrendingUp} label="Atrasadas" value={stats.atrasadas} colorClass="bg-red-500" onClick={() => navigate('/ordens', { state: { filterStatus: '' } })} />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* OS Recentes com filtros */}
                <div className="lg:col-span-2 card animate-fadeIn">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading font-semibold text-hotel-blue text-base">
                            Solicitações Internas
                        </h3>
                        <button
                            onClick={() => navigate('/nova-os')}
                            className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
                        >
                            <Plus size={14} /> Nova SI
                        </button>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3 mb-4">
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
                        {(filterLider || filterStatus) && (
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
                                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-hotel-light cursor-pointer
                                ${atrasada ? 'border-red-200 bg-red-50/30' : 'border-hotel-gray/50'}`}
                                        onClick={() => navigate('/ordens', { state: { expandOsId: os.id } })}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold font-body text-hotel-blue truncate">{os.titulo}</p>
                                            <p className="text-xs text-hotel-gray-md font-body mt-0.5">
                                                {os.departamento} · {os.responsavel_nome}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                            <StatusBadge status={os.status} />
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
