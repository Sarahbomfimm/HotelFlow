import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle, Layers,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import StatusBadge from '../../components/Badge/StatusBadge';
import StatusObservacaoModal from '../../components/Modal/StatusObservacaoModal';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusOS, StatusLabel } from '../../models/OrdemDeServico';
import { format, isPast, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatCard({ icon: Icon, label, value, colorClass, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`card flex items-center gap-4 text-left transition-shadow
                        ${onClick ? 'hover:shadow-card-hover cursor-pointer' : 'cursor-default'}`}
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

export default function DashboardLider() {
    const { getOSPorLider, atualizarStatus, error: ordensError } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const navigate = useNavigate();

    const [obsModal, setObsModal] = useState({ open: false, os: null, novoStatus: null });

    const ordens = useMemo(
        () => getOSPorLider(user?.departamentos || []),
        [getOSPorLider, user],
    );

    const stats = useMemo(() => ({
        total: ordens.length,
        abertas: ordens.filter((o) => o.status === StatusOS.ABERTO).length,
        em_andamento: ordens.filter((o) => o.status === StatusOS.EM_ANDAMENTO).length,
        concluidas: ordens.filter((o) => o.status === StatusOS.CONCLUIDO).length,
    }), [ordens]);

    // OS urgentes (prazo em até 2 dias, não concluídas)
    const urgentes = useMemo(() =>
        ordens
            .filter((o) => o.status !== StatusOS.CONCLUIDO)
            .filter((o) => differenceInDays(parseISO(o.prazo), new Date()) <= 2)
            .sort((a, b) => new Date(a.prazo) - new Date(b.prazo)),
        [ordens],
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
            await atualizarStatus(os.id, status, user, '');
            addNotification(`SI "${os.titulo}" iniciada.`, 'info');
            return;
        }
        setObsModal({ open: true, os, novoStatus: status });
    };

    const confirmarStatus = async (observacao) => {
        const { os, novoStatus } = obsModal;
        await atualizarStatus(os.id, novoStatus, user, observacao);
        addNotification(
            `SI "${os.titulo}" atualizada para ${StatusLabel[novoStatus]}.`,
            novoStatus === StatusOS.CONCLUIDO ? 'success' : 'info',
        );
        setObsModal({ open: false, os: null, novoStatus: null });
    };

    return (
        <>
            <AppLayout pageTitle={`Dashboard — ${user?.nome}`}>
                {ordensError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700">
                        {ordensError}
                    </div>
                )}
                {/* Saudação */}
                <div className="mb-6">
                    <h1 className="font-heading font-bold text-hotel-blue text-2xl">Olá, {user?.nome}! 👋</h1>
                    <p className="text-hotel-gray-md font-body text-sm mt-1">
                        {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        {' · '}
                        <span className="font-semibold">{user?.departamentos?.join(', ')}</span>
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard icon={ClipboardList} label="Total" value={stats.total} colorClass="bg-hotel-blue" onClick={() => navigate('/ordens', { state: {} })} />
                    <StatCard icon={AlertCircle} label="Abertas" value={stats.abertas} colorClass="bg-blue-500" onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.ABERTO } })} />
                    <StatCard icon={Clock} label="Em Andamento" value={stats.em_andamento} colorClass="bg-amber-500" onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.EM_ANDAMENTO } })} />
                    <StatCard icon={CheckCircle2} label="Concluídas" value={stats.concluidas} colorClass="bg-emerald-500" onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.CONCLUIDO } })} />
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Todas as OS */}
                    <div className="lg:col-span-2 card animate-fadeIn">
                        <h3 className="font-heading font-semibold text-hotel-blue text-base mb-4 flex items-center gap-2">
                            <Layers size={18} /> Minhas Solicitações Internas
                        </h3>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                            {ordens.length === 0 ? (
                                <p className="text-center text-hotel-gray-md text-sm py-10">
                                    Nenhuma OS atribuída a você no momento.
                                </p>
                            ) : (
                                ordens.map((os) => {
                                    const atrasada = os.status !== StatusOS.CONCLUIDO && isPast(parseISO(os.prazo));
                                    const podeAtualizar = os.status !== StatusOS.CONCLUIDO;
                                    return (
                                        <div
                                            key={os.id}
                                            onClick={() => navigate('/ordens', { state: { expandOsId: os.id } })}
                                            className={`p-4 rounded-xl border transition-colors cursor-pointer
                                ${atrasada ? 'border-red-200 bg-red-50/40 hover:bg-red-100/50' : 'border-hotel-gray/50 hover:bg-hotel-light'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <StatusBadge status={os.status} />
                                                        <span className="text-xs text-hotel-gray-md font-body bg-hotel-gray px-2 py-0.5 rounded-full">
                                                            {os.departamento}
                                                        </span>
                                                        {atrasada && (
                                                            <span className="text-xs text-red-600 font-semibold">⚠ Atrasada</span>
                                                        )}
                                                    </div>
                                                    <p className="font-semibold font-body text-hotel-blue text-sm mt-1">{os.titulo}</p>
                                                    <p className="text-xs text-hotel-gray-md font-body mt-1 line-clamp-2">{os.descricao}</p>
                                                    <p className="text-xs text-hotel-gray-md font-body mt-2">
                                                        Prazo: <strong className={atrasada ? 'text-red-500' : 'text-hotel-blue'}>
                                                            {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                                        </strong>
                                                    </p>
                                                </div>
                                                {podeAtualizar && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); solicitarStatus(os, nextStatus[os.status]); }}
                                                        className="btn-gold text-xs py-1.5 px-3 flex-shrink-0 whitespace-nowrap w-24 text-center"
                                                    >
                                                        {nextStatusLabel[os.status]}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Urgentes */}
                    <div className="card animate-fadeIn">
                        <h3 className="font-heading font-semibold text-hotel-blue text-base mb-4 flex items-center gap-2">
                            <AlertCircle size={18} className="text-amber-500" /> Urgentes / Próximas
                        </h3>
                        {urgentes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-3">
                                <CheckCircle2 size={36} className="text-emerald-400" />
                                <p className="text-sm text-hotel-gray-md font-body text-center">
                                    Nenhuma OS urgente. Ótimo trabalho!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {urgentes.map((os) => {
                                    const dias = differenceInDays(parseISO(os.prazo), new Date());
                                    const atrasada = isPast(parseISO(os.prazo));
                                    return (
                                        <button
                                            key={os.id}
                                            onClick={() => navigate('/ordens', { state: { expandOsId: os.id } })}
                                            className={`w-full text-left p-3 rounded-lg border-l-4 transition-all hover:shadow-card cursor-pointer
                                                    ${atrasada ? 'border-red-400 bg-red-50 hover:bg-red-100' : 'border-amber-400 bg-amber-50 hover:bg-amber-100'}`}
                                        >
                                            <p className="text-sm font-semibold font-body text-hotel-blue leading-snug">{os.titulo}</p>
                                            <p className="text-xs mt-1 font-body font-semibold">
                                                {atrasada
                                                    ? <span className="text-red-500">Atrasada {Math.abs(dias)}d — clique para ver</span>
                                                    : <span className="text-amber-600">Vence em {dias === 0 ? 'hoje' : `${dias}d`} — clique para ver</span>
                                                }
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
        </>
    );
}
