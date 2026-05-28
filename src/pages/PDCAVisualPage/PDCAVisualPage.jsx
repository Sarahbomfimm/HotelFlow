import { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, Clock3, Building2, CalendarRange } from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { PDCALabel, PDCAStep, StatusLabel, StatusOS } from '../../models/OrdemDeServico';
import { UserRole } from '../../models/User';
import { format, parseISO } from 'date-fns';
import { isSIOverdue } from '../../utils/osDeadlineRules';
import { ptBR } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const STAGES = [PDCAStep.PLAN, PDCAStep.DO, PDCAStep.CHECK, PDCAStep.ACT];

const STAGE_STYLE = {
    [PDCAStep.PLAN]: {
        badge: 'bg-red-100 text-red-700',
        border: 'border-red-200',
        chip: 'bg-red-500',
    },
    [PDCAStep.DO]: {
        badge: 'bg-blue-100 text-blue-700',
        border: 'border-blue-200',
        chip: 'bg-blue-500',
    },
    [PDCAStep.CHECK]: {
        badge: 'bg-amber-100 text-amber-700',
        border: 'border-amber-200',
        chip: 'bg-amber-500',
    },
    [PDCAStep.ACT]: {
        badge: 'bg-emerald-100 text-emerald-700',
        border: 'border-emerald-200',
        chip: 'bg-emerald-500',
    },
};

function progressPercent(step) {
    const index = STAGES.indexOf(step);
    if (index < 0) {
        return 25;
    }
    return ((index + 1) / STAGES.length) * 100;
}

export default function PDCAVisualPage() {
    const { ordens } = useOS();
    const { user } = useAuth();
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [periodRange, setPeriodRange] = useState([null, null]);

    const [periodStart, periodEnd] = periodRange;

    const availableDepartments = useMemo(
        () => Array.from(new Set(
            ordens
                .map((os) => os.departamento)
                .filter(Boolean),
        )).sort((left, right) => left.localeCompare(right, 'pt-BR')),
        [ordens],
    );

    const base = useMemo(() => {
        return ordens
            .filter((os) => os.departamento !== 'Teste')
            .filter((os) => {
                if (user?.role === UserRole.LIDER) {
                    return os.responsavel_id === user.id;
                }
                return true;
            })
            .filter((os) => {
                if (!selectedDepartment) {
                    return true;
                }

                return os.departamento === selectedDepartment;
            })
            .filter((os) => {
                if (!periodStart) {
                    return true;
                }

                return new Date(os.prazo) >= periodStart;
            })
            .filter((os) => {
                if (!periodEnd) {
                    return true;
                }

                const endDate = new Date(periodEnd);
                endDate.setHours(23, 59, 59, 999);

                return new Date(os.prazo) <= endDate;
            });
    }, [ordens, periodEnd, periodStart, selectedDepartment, user]);

    const stats = useMemo(() => {
        const abertas = base.filter((os) => os.status === StatusOS.ABERTO).length;
        const emAndamento = base.filter((os) => os.status === StatusOS.EM_ANDAMENTO).length;
        const concluidas = base.filter((os) => os.status === StatusOS.CONCLUIDO).length;
        const atrasadas = base.filter((os) => isSIOverdue(os)).length;

        return {
            total: base.length,
            abertas,
            emAndamento,
            concluidas,
            atrasadas,
        };
    }, [base]);

    const stages = useMemo(
        () => STAGES.map((step) => ({
            step,
            label: PDCALabel[step],
            items: base
                .filter((os) => (os.etapa_pdca || PDCAStep.PLAN) === step)
                .sort((a, b) => new Date(a.prazo) - new Date(b.prazo)),
        })),
        [base],
    );

    return (
        <AppLayout pageTitle="PDCA Visual">
            <div className="space-y-4 animate-fadeIn">
                <div className="relative overflow-visible rounded-3xl border border-hotel-gray/40 bg-white p-6 shadow-card sm:p-8">
                    <div className="absolute -top-20 right-0 h-60 w-60 rounded-full bg-hotel-gold/15 blur-3xl" />
                    <div className="absolute -bottom-20 left-2 h-60 w-60 rounded-full bg-hotel-blue/10 blur-3xl" />

                    <div className="relative flex flex-col gap-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <span className="inline-flex items-center rounded-full bg-hotel-blue/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-hotel-blue">
                                    PAINEL PDCA
                                </span>
                                <h1 className="mt-2 font-heading text-2xl font-bold text-hotel-blue sm:text-3xl">
                                    Painel PDCA Visual
                                </h1>
                                <p className="mt-1 text-sm text-hotel-gray-md">
                                    Visão administrativa por etapa, com foco em pendências e avanço operacional.
                                </p>
                            </div>

                            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[440px] sm:grid-cols-2">
                                <div>
                                    <label className="label mb-1 flex items-center gap-1.5" htmlFor="pdca-department">
                                        <Building2 size={14} /> Departamento
                                    </label>
                                    <select
                                        id="pdca-department"
                                        className="input py-2"
                                        value={selectedDepartment}
                                        onChange={(event) => setSelectedDepartment(event.target.value)}
                                    >
                                        <option value="">Todos os departamentos</option>
                                        {availableDepartments.map((department) => (
                                            <option key={department} value={department}>{department}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pdca-date-picker">
                                    <label className="label mb-1 flex items-center gap-1.5" htmlFor="pdca-period-start">
                                        <CalendarRange size={14} /> Período exibido
                                    </label>
                                    <div className="relative">
                                        <CalendarRange size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-hotel-blue" />
                                        <DatePicker
                                            id="pdca-period-start"
                                            selectsRange
                                            startDate={periodStart}
                                            endDate={periodEnd}
                                            onChange={(update) => setPeriodRange(update)}
                                            isClearable
                                            locale={ptBR}
                                            dateFormat="dd/MM/yyyy"
                                            showPopperArrow={false}
                                            popperClassName="pdca-datepicker-popper"
                                            calendarClassName="pdca-datepicker-calendar"
                                            className="input cursor-pointer py-2 pl-10 pr-10 font-semibold text-hotel-blue placeholder:text-hotel-gray-md"
                                            placeholderText="Selecione o intervalo"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <div className="rounded-2xl border border-hotel-gray/40 bg-hotel-light p-4">
                                <p className="text-xs font-semibold text-hotel-gray-md">Total no ciclo</p>
                                <p className="mt-1 text-2xl font-bold text-hotel-blue">{stats.total}</p>
                            </div>
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                <p className="text-xs font-semibold text-blue-700">Abertas</p>
                                <p className="mt-1 text-2xl font-bold text-blue-700">{stats.abertas}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-xs font-semibold text-amber-700">Em andamento</p>
                                <p className="mt-1 text-2xl font-bold text-amber-700">{stats.emAndamento}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <p className="text-xs font-semibold text-emerald-700">Concluídas</p>
                                <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.concluidas}</p>
                            </div>
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                                <p className="flex items-center gap-1 text-xs font-semibold text-red-700">
                                    <AlertTriangle size={13} /> Atrasadas
                                </p>
                                <p className="mt-1 text-2xl font-bold text-red-700">{stats.atrasadas}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-4">
                    {stages.map((stage) => {
                        const style = STAGE_STYLE[stage.step];

                        return (
                            <section key={stage.step} className={`flex min-h-[30rem] max-h-[72vh] flex-col rounded-2xl border bg-white p-4 shadow-card ${style.border}`}>
                                <header className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${style.chip}`}>
                                            {stage.step}
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-hotel-blue">{stage.label}</p>
                                            <p className="text-[11px] text-hotel-gray-md">{stage.items.length} {stage.items.length === 1 ? 'item' : 'itens'}</p>
                                        </div>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                                        {stage.step}
                                    </span>
                                </header>

                                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                                    {stage.items.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-hotel-gray/60 bg-hotel-light px-3 py-4 text-center text-xs text-hotel-gray-md">
                                            Sem tarefas nesta etapa.
                                        </div>
                                    )}

                                    {stage.items.map((os) => {
                                        const isLate = isSIOverdue(os);

                                        return (
                                            <article key={os.id} className="rounded-xl border border-hotel-gray/50 bg-white p-3 transition-colors hover:bg-hotel-light/60">
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <span className={`status-${os.status}`}>{StatusLabel[os.status]}</span>
                                                    <span className="text-[11px] font-semibold text-hotel-gray-md">{os.departamento}</span>
                                                </div>

                                                <h3 className="line-clamp-2 text-sm font-semibold text-hotel-blue">{os.titulo}</h3>

                                                <p className="mt-1 text-xs text-hotel-gray-md">{os.responsavel_nome}</p>

                                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-hotel-gray/50">
                                                    <div
                                                        className={`h-full rounded-full ${style.chip}`}
                                                        style={{ width: `${progressPercent(stage.step)}%` }}
                                                    />
                                                </div>

                                                <div className="mt-2 flex items-center justify-between text-[11px] text-hotel-gray-md">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock3 size={11} /> {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                                    </span>
                                                    {isLate && <span className="font-semibold text-red-600">Atrasada</span>}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>

                {base.length === 0 && (
                    <div className="card flex items-center justify-center gap-2 py-10 text-sm text-hotel-gray-md">
                        <ClipboardList size={16} /> Nenhuma SI encontrada para os filtros aplicados.
                    </div>
                )}
            </div>
        </AppLayout>
    );
}