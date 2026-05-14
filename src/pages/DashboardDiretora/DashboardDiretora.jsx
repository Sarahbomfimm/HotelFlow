import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle,
    Users, TrendingUp, ArrowRight, Send,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusOS, StatusLabel, PDCAStep } from '../../models/OrdemDeServico';
import { format, isPast, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DEPARTAMENTO_TESTE = 'Teste';

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
    const { lideres, currentUserProfile, updateTelegramChatId } = useUsers();
    const navigate = useNavigate();
    const displayName = currentUserProfile?.nome || user?.nome;

    const [filterLider, setFilterLider] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [tab, setTab] = useState('todas'); // 'todas' ou 'minhas'
    const [telegramInput, setTelegramInput] = useState('');
    const [telegramSaving, setTelegramSaving] = useState(false);
    const [showTelegramForm, setShowTelegramForm] = useState(false);

    const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'HotelFloww_Bot';
    const telegramBotLink = `https://t.me/${telegramBotUsername}`;

    const { addNotification } = useNotification();

    const hoje = new Date();
    const ordensSemTeste = useMemo(
        () => ordens.filter((o) => o.departamento !== DEPARTAMENTO_TESTE),
        [ordens],
    );

    // Apenas SIs criadas no mês atual
    const ordensMes = useMemo(
        () => ordensSemTeste.filter((o) => o.criado_em && isSameMonth(parseISO(o.criado_em), hoje)),
        [ordensSemTeste],
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
        return ordensMes.filter((os) =>
            os.responsavel_id === user?.id
            || os.responsavel_uid === user?.firebaseUid
            || (user?.email && os.responsavel_email?.toLowerCase() === user.email.toLowerCase())
        );
    }, [ordensMes, user]);

    const pdcaBase = tab === 'minhas' ? minhasSIs : ordensMes;

    const pdcaStats = useMemo(() => ({
        [PDCAStep.PLAN]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.PLAN).length,
        [PDCAStep.DO]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.DO).length,
        [PDCAStep.CHECK]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.CHECK).length,
        [PDCAStep.ACT]: pdcaBase.filter((o) => o.etapa_pdca === PDCAStep.ACT).length,
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
                    Olá, {displayName}! 👋
                </h1>
                <p className="text-hotel-gray-md font-body text-sm mt-1">
                    {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
            </div>

            {/* Banner Conectar Telegram */}
            {!currentUserProfile?.telegram_chat_id && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <Send size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold font-body text-blue-800 text-sm">Receba notificações pelo Telegram</p>
                                <p className="text-blue-600 font-body text-xs mt-0.5">
                                    Conecte seu Telegram para receber alertas instantaneamente.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowTelegramForm((v) => !v)}
                            className="flex-shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold font-body text-white hover:bg-blue-700 transition-colors"
                        >
                            {showTelegramForm ? 'Cancelar' : 'Conectar Telegram'}
                        </button>
                    </div>
                    {showTelegramForm && (
                        <div className="mt-4 border-t border-blue-200 pt-4 space-y-3">
                            <p className="text-blue-700 font-body text-xs font-semibold">Siga os passos:</p>
                            <ol className="list-decimal list-inside text-blue-700 font-body text-xs space-y-1">
                                <li>
                                    Abra o bot:{' '}
                                    <a href={telegramBotLink} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                                        @{telegramBotUsername}
                                    </a>
                                </li>
                                <li>Envie <strong>/start</strong> para o bot</li>
                                <li>Copie o número que ele responder</li>
                                <li>Cole abaixo e clique em Salvar</li>
                            </ol>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={telegramInput}
                                    onChange={(e) => setTelegramInput(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Cole seu ID aqui (ex: 123456789)"
                                    className="flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-body text-hotel-blue focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                                <button
                                    onClick={async () => {
                                        const chatId = telegramInput.trim();
                                        if (!chatId || !/^\d+$/.test(chatId)) {
                                            addNotification('ID inválido. Cole apenas os números que o bot enviou.', 'error');
                                            return;
                                        }
                                        setTelegramSaving(true);
                                        try {
                                            await updateTelegramChatId(chatId);
                                            addNotification('Telegram conectado com sucesso! 🎉', 'success');
                                            setShowTelegramForm(false);
                                            setTelegramInput('');
                                        } catch {
                                            addNotification('Erro ao salvar ID do Telegram. Tente novamente.', 'error');
                                        } finally {
                                            setTelegramSaving(false);
                                        }
                                    }}
                                    disabled={telegramSaving || !telegramInput}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold font-body text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {telegramSaving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {currentUserProfile?.telegram_chat_id && (
                <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <Send size={16} className="text-emerald-500" />
                    <p className="text-emerald-700 font-body text-xs font-semibold">
                        Telegram conectado — você receberá notificações de novas SIs ✓
                    </p>
                </div>
            )}

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
                    <div className="mb-4">
                        <h3 className="font-heading font-semibold text-hotel-blue text-base">
                            Solicitações Internas
                        </h3>
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
                                        className={`p-4 rounded-xl border transition-colors cursor-pointer
                                ${atrasada ? 'border-red-200 bg-red-50/40 hover:bg-red-100/50' : 'border-hotel-gray/50 hover:bg-hotel-light'}`}
                                        onClick={() => navigate('/ordens', { state: { expandOsId: os.id } })}
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <StatusBadge status={os.status} />
                                                    <PDCABadge etapa={os.etapa_pdca} status={os.status} compact />
                                                    <span className="text-xs text-hotel-gray-md font-body bg-hotel-gray px-2 py-0.5 rounded-full">
                                                        {os.departamento}
                                                    </span>
                                                    {atrasada && (
                                                        <span className="text-xs text-red-600 font-semibold">⚠ Atrasada</span>
                                                    )}
                                                </div>

                                                <p className="font-semibold font-body text-hotel-blue text-sm mt-1">{os.titulo}</p>
                                                <p className="text-xs text-hotel-gray-md font-body mt-2">
                                                    Prazo: <strong className={atrasada ? 'text-red-500' : 'text-hotel-blue'}>
                                                        {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                                    </strong>
                                                </p>
                                            </div>
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
                <div className="card animate-fadeIn flex h-full min-h-0 flex-col">
                    <h3 className="font-heading font-semibold text-hotel-blue text-base mb-4 flex items-center gap-2">
                        <Users size={18} /> Resumo por Líder
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-0">
                        {lideres.map((lider) => {
                            const total = ordensSemTeste.filter((o) => o.responsavel_id === lider.id).length;
                            const concl = ordensSemTeste.filter((o) => o.responsavel_id === lider.id && o.status === StatusOS.CONCLUIDO).length;
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
