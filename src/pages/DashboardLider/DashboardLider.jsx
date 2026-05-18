import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle, Send,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import PDCABadge from '../../components/Badge/PDCABadge';
import StatusBadge from '../../components/Badge/StatusBadge';
import StatusObservacaoModal from '../../components/Modal/StatusObservacaoModal';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusOS, StatusLabel, PDCAStep } from '../../models/OrdemDeServico';
import { format, isPast, parseISO, differenceInDays, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DEPARTAMENTO_TESTE = 'Teste';

function normalizeIdentityValue(value) {
    return String(value || '').trim().toLowerCase();
}

function matchesOrderActor(order, actor, prefix) {
    if (!order || !actor) {
        return false;
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

    const actorName = normalizeIdentityValue(actor.nome);
    const orderName = normalizeIdentityValue(order[`${prefix}_nome`]);
    if (actorName && orderName && actorName === orderName) {
        return true;
    }

    return false;
}

function StatCard({ icon: Icon, label, value, colorClass, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`card flex items-center gap-3 text-left transition-shadow sm:gap-4
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

export default function DashboardLider() {
    const { getOSPorLider, atualizarStatus, error: ordensError } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { currentUserProfile, updateTelegramChatId } = useUsers();
    const navigate = useNavigate();
    const displayName = currentUserProfile?.nome || user?.nome;

    const [obsModal, setObsModal] = useState({ open: false, os: null, novoStatus: null });
    const [tab, setTab] = useState('minhas');
    const [telegramInput, setTelegramInput] = useState('');
    const [telegramSaving, setTelegramSaving] = useState(false);
    const [showTelegramForm, setShowTelegramForm] = useState(false);

    const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'HotelFloww_Bot';
    const telegramBotLink = `https://t.me/${telegramBotUsername}`;

    const hoje = new Date();

    const ordens = useMemo(
        () => getOSPorLider(user?.departamentos || [], user),
        [getOSPorLider, user],
    );
    const ordensSemTeste = useMemo(
        () => ordens.filter((o) => o.departamento !== DEPARTAMENTO_TESTE),
        [ordens],
    );

    // Apenas SIs criadas no mês atual
    const ordensMes = useMemo(
        () => ordensSemTeste.filter((o) => o.criado_em && isSameMonth(parseISO(o.criado_em), hoje)),
        [ordensSemTeste],
    );

    const minhasSIs = useMemo(
        () => ordensMes.filter((o) =>
            matchesOrderActor(o, user, 'responsavel')
        ),
        [ordensMes, user],
    );

    const abertosPorMim = useMemo(
        () => ordensMes.filter(
            (o) => matchesOrderActor(o, user, 'criado_por')
                && !matchesOrderActor(o, user, 'responsavel'),
        ),
        [ordensMes, user],
    );

    const stats = useMemo(() => ({
        total: minhasSIs.length,
        abertas: minhasSIs.filter((o) => o.status === StatusOS.ABERTO).length,
        em_andamento: minhasSIs.filter((o) => o.status === StatusOS.EM_ANDAMENTO).length,
        concluidas: minhasSIs.filter((o) => o.status === StatusOS.CONCLUIDO).length,
    }), [minhasSIs]);

    const pdcaStats = useMemo(() => ({
        [PDCAStep.PLAN]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.PLAN).length,
        [PDCAStep.DO]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.DO).length,
        [PDCAStep.CHECK]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.CHECK).length,
        [PDCAStep.ACT]: minhasSIs.filter((o) => o.etapa_pdca === PDCAStep.ACT).length,
    }), [minhasSIs]);

    // OS urgentes (prazo em até 2 dias, não concluídas)
    const urgentes = useMemo(() =>
        minhasSIs
            .filter((o) => o.status !== StatusOS.CONCLUIDO)
            .filter((o) => differenceInDays(parseISO(o.prazo), new Date()) <= 2)
            .sort((a, b) => new Date(a.prazo) - new Date(b.prazo)),
        [minhasSIs],
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
        setObsModal({ open: false, os: null, novoStatus: null });
        await atualizarStatus(os.id, novoStatus, user, observacao);
        addNotification(
            `SI "${os.titulo}" atualizada para ${StatusLabel[novoStatus]}.`,
            novoStatus === StatusOS.CONCLUIDO ? 'success' : 'info',
        );
    };

    const handleSaveTelegram = async () => {
        const chatId = telegramInput.trim();
        if (!chatId || !/^\d+$/.test(chatId)) {
            addNotification('ID inválido. Cole apenas os números que o bot enviou.', 'error');
            return;
        }
        setTelegramSaving(true);
        try {
            await updateTelegramChatId(chatId);
            addNotification('Telegram conectado com sucesso! 🎉 Você receberá notificações de novas SIs.', 'success');
            setShowTelegramForm(false);
            setTelegramInput('');
        } catch {
            addNotification('Erro ao salvar ID do Telegram. Tente novamente.', 'error');
        } finally {
            setTelegramSaving(false);
        }
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
                    <h1 className="font-heading text-xl font-bold text-hotel-blue sm:text-2xl">Olá, {displayName}! 👋</h1>
                    <p className="text-hotel-gray-md font-body text-sm mt-1">
                        {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        {' · '}
                        <span className="font-semibold">{user?.departamentos?.join(', ')}</span>
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
                                        Conecte seu Telegram para receber alertas de novas SIs instantaneamente, sem depender de WhatsApp.
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
                                        <a
                                            href={telegramBotLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline font-semibold"
                                        >
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
                                        onClick={handleSaveTelegram}
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

                {/* Stats */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        icon={ClipboardList}
                        label="Total este mês"
                        value={stats.total}
                        colorClass="bg-hotel-blue"
                        onClick={() => navigate('/ordens', { state: { onlyMine: true, onlyCurrentMonth: true } })}
                    />
                    <StatCard
                        icon={AlertCircle}
                        label="Abertas este mês"
                        value={stats.abertas}
                        colorClass="bg-blue-500"
                        onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.ABERTO, onlyMine: true, onlyCurrentMonth: true } })}
                    />
                    <StatCard
                        icon={Clock}
                        label="Em Andamento"
                        value={stats.em_andamento}
                        colorClass="bg-amber-500"
                        onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.EM_ANDAMENTO, onlyMine: true, onlyCurrentMonth: true } })}
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="Concluídas este mês"
                        value={stats.concluidas}
                        colorClass="bg-emerald-500"
                        onClick={() => navigate('/ordens', { state: { filterStatus: StatusOS.CONCLUIDO, onlyMine: true, onlyCurrentMonth: true } })}
                    />
                </div>

                <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <PDCAStatCard etapa={PDCAStep.PLAN} total={pdcaStats[PDCAStep.PLAN]} onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.PLAN, pdcaOnly: true, onlyMine: true, onlyCurrentMonth: true } })} />
                    <PDCAStatCard etapa={PDCAStep.DO} total={pdcaStats[PDCAStep.DO]} onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.DO, pdcaOnly: true, onlyMine: true, onlyCurrentMonth: true } })} />
                    <PDCAStatCard etapa={PDCAStep.CHECK} total={pdcaStats[PDCAStep.CHECK]} onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.CHECK, pdcaOnly: true, onlyMine: true, onlyCurrentMonth: true } })} />
                    <PDCAStatCard etapa={PDCAStep.ACT} total={pdcaStats[PDCAStep.ACT]} onClick={() => navigate('/ordens', { state: { filterPdca: PDCAStep.ACT, pdcaOnly: true, onlyMine: true, onlyCurrentMonth: true } })} />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Todas as OS */}
                    <div className="lg:col-span-2 card animate-fadeIn">
                        {/* Abas */}
                        <div className="flex gap-1 mb-4 border-b border-hotel-gray">
                            <button
                                onClick={() => setTab('minhas')}
                                className={`px-4 py-2 text-sm font-semibold font-body rounded-t-lg transition-colors ${
                                    tab === 'minhas'
                                        ? 'bg-hotel-blue text-white'
                                        : 'text-hotel-gray-md hover:text-hotel-blue'
                                }`}
                            >
                                Minhas SIs ({minhasSIs.length})
                            </button>
                            <button
                                onClick={() => setTab('abertas')}
                                className={`px-4 py-2 text-sm font-semibold font-body rounded-t-lg transition-colors ${
                                    tab === 'abertas'
                                        ? 'bg-hotel-blue text-white'
                                        : 'text-hotel-gray-md hover:text-hotel-blue'
                                }`}
                            >
                                SIs abertas por mim ({abertosPorMim.length})
                            </button>
                        </div>

                        {/* Lista da aba ativa */}
                        {(() => {
                            const lista = tab === 'minhas' ? minhasSIs : abertosPorMim;
                            const msgVazia = tab === 'minhas'
                                ? 'Nenhuma SI atribuída a você no momento.'
                                : 'Você não abriu nenhuma SI para outro departamento.';
                            return (
                                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                    {lista.length === 0 ? (
                                        <p className="text-center text-hotel-gray-md text-sm py-10">{msgVazia}</p>
                                    ) : (
                                        lista.map((os) => {
                                            const atrasada = os.status !== StatusOS.CONCLUIDO && isPast(parseISO(os.prazo));
                                            const isResponsavel = user?.id === os.responsavel_id || user?.firebaseUid === os.responsavel_uid;
                                            const podeAtualizar = os.status !== StatusOS.CONCLUIDO && isResponsavel;
                                            return (
                                                <div
                                                    key={os.id}
                                                    onClick={() => navigate(
                                                        tab === 'minhas' ? '/ordens' : '/ordens/abertas-por-mim',
                                                        { state: { expandOsId: os.id, onlyMine: tab === 'minhas', onlyCreatedByMe: tab === 'abertas' } },
                                                    )}
                                                    className={`p-4 rounded-xl border transition-colors cursor-pointer
                                        ${atrasada ? 'border-red-200 bg-red-50/40 hover:bg-red-100/50' : 'border-hotel-gray/50 hover:bg-hotel-light'}`}
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
                                                        {podeAtualizar && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); solicitarStatus(os, nextStatus[os.status]); }}
                                                                className="btn-gold w-full flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-center text-xs sm:w-24"
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
                            );
                        })()}
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
                                    Nenhuma SI urgente. Ótimo trabalho!
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
                                            onClick={() => navigate('/ordens', { state: { expandOsId: os.id, onlyMine: true } })}
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
