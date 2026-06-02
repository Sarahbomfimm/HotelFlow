import { useEffect, useMemo, useState } from 'react';
import {
    ClipboardCheck,
    Filter,
    ShieldCheck,
    Radar,
    CheckCircle2,
    Trophy,
    Plus,
    Save,
    Pencil,
    Trash2,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/Layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { DEPARTAMENTOS } from '../../models/OrdemDeServico';
import { hasPermission, PERMISSIONS } from '../../services/permissions';
import { createUserNotification } from '../../services/notifications';
import {
    deleteAudit,
    getAuditLinkByDepartment,
    saveAudit,
    subscribeAudits,
    subscribeAuditLinks,
} from '../../services/auditoriasStorage';

const SENSOS = [
    { key: 'triagem', label: 'Senso 1: Triagem' },
    { key: 'arrumacao', label: 'Senso 2: Arrumação' },
    { key: 'higiene_conforto', label: 'Senso 3: Higiene' },
    { key: 'normalizacao', label: 'Senso 4: Normalização' },
    { key: 'disciplina', label: 'Senso 5: Disciplina' },
];

const QUESTIONS_PER_SENSE = 5;
const MAX_PER_QUESTION = 4;
const MAX_PER_SENSE = QUESTIONS_PER_SENSE * MAX_PER_QUESTION;
const MAX_TOTAL = SENSOS.length * MAX_PER_SENSE;

const LEGACY_SENSE_MAP = {
    triagem: 'seiri',
    arrumacao: 'seiton',
    higiene_conforto: 'seiso',
    normalizacao: 'seiketsu',
    disciplina: 'shitsuke',
};

function getCurrentMonth() {
    return new Date().toISOString().slice(0, 7);
}

function scoreLabel(total) {
    if (total >= 91) return { text: 'Excelente', tone: 'text-emerald-700 bg-emerald-100', cardBorder: 'border-emerald-400/40', cardBg: 'bg-emerald-500/20', statusColor: 'text-emerald-300', dot: 'bg-emerald-400' };
    if (total >= 81) return { text: 'Bom', tone: 'text-green-700 bg-green-100', cardBorder: 'border-green-400/40', cardBg: 'bg-green-500/20', statusColor: 'text-green-300', dot: 'bg-green-400' };
    if (total >= 71) return { text: 'Médio', tone: 'text-yellow-700 bg-yellow-100', cardBorder: 'border-yellow-400/40', cardBg: 'bg-yellow-500/20', statusColor: 'text-yellow-300', dot: 'bg-yellow-400' };
    if (total >= 51) return { text: 'Mal', tone: 'text-orange-700 bg-orange-100', cardBorder: 'border-orange-400/40', cardBg: 'bg-orange-500/20', statusColor: 'text-orange-300', dot: 'bg-orange-400' };
    return { text: 'Péssimo', tone: 'text-red-700 bg-red-100', cardBorder: 'border-red-400/40', cardBg: 'bg-red-500/20', statusColor: 'text-red-300', dot: 'bg-red-400' };
}

function barColor(avg) {
    if (avg >= 16) return { from: '#10b981', to: '#059669' };
    if (avg >= 12) return { from: '#3b82f6', to: '#2563eb' };
    if (avg >= 8) return { from: '#f59e0b', to: '#d97706' };
    return { from: '#ef4444', to: '#dc2626' };
}

function scorePercent(total) {
    return Math.max(0, Math.min(100, (Number(total || 0) / MAX_TOTAL) * 100));
}

function buildInitialScores() {
    return SENSOS.reduce((acc, sense) => ({
        ...acc,
        [sense.key]: Array(QUESTIONS_PER_SENSE).fill(0),
    }), {});
}

function getSenseTotalFromAudit(audit, senseKey) {
    if (Array.isArray(audit?.scores?.[senseKey])) {
        return audit.scores[senseKey].reduce((sum, value) => sum + Number(value || 0), 0);
    }

    if (typeof audit?.senseTotals?.[senseKey] === 'number') {
        return Number(audit.senseTotals[senseKey]);
    }

    if (typeof audit?.[senseKey] === 'number') {
        return Number(audit[senseKey]);
    }

    const legacyKey = LEGACY_SENSE_MAP[senseKey];
    if (legacyKey && typeof audit?.[legacyKey] === 'number') {
        return Number(audit[legacyKey]) * 2;
    }

    return 0;
}

function getAuditTotal(audit) {
    if (typeof audit?.total === 'number' && Number(audit?.maxScore || MAX_TOTAL) === MAX_TOTAL) {
        return Number(audit.total);
    }

    const legacySum = SENSOS.reduce((sum, sense) => sum + getSenseTotalFromAudit(audit, sense.key), 0);
    return Math.max(0, Math.min(MAX_TOTAL, legacySum));
}

function openMonthPicker(event) {
    const input = event.currentTarget;

    if (typeof input?.showPicker === 'function') {
        try {
            input.showPicker();
            return;
        } catch {
            // Ignora navegadores que bloqueiam showPicker e segue com foco padrão.
        }
    }

    input?.focus?.();
}

function ScoreSelector({ value, onChange, compact = false }) {
    return (
        <div className={`grid grid-cols-5 rounded-lg border border-hotel-blue/10 bg-hotel-light/40 p-1.5 ${compact ? 'gap-1' : 'gap-1.5'}`}>
            {[0, 1, 2, 3, 4].map((option) => {
                const selected = Number(value) === option;
                return (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onChange(option)}
                        className={`rounded-md border px-1.5 py-1.5 text-xs font-semibold transition-all ${
                            selected
                                ? 'border-hotel-blue bg-hotel-blue text-white shadow-sm'
                                : 'border-hotel-gray/50 bg-white text-hotel-gray-md hover:border-hotel-blue/40 hover:text-hotel-blue'
                        }`}
                        aria-pressed={selected}
                    >
                        {option}
                    </button>
                );
            })}
        </div>
    );
}

export default function Auditorias({ mode }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addNotification, notifications, marcarLida } = useNotification();
    const { users, currentUserProfile } = useUsers();
    const profile = currentUserProfile || user;
    const canCreateAuditorias = hasPermission(profile, PERMISSIONS.AUDITORIAS_CREATE);
    const canManageAuditorias = hasPermission(profile, PERMISSIONS.AUDITORIAS_MANAGE);

    const allDepartments = useMemo(() => {
        const ordered = [...DEPARTAMENTOS].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (profile?.role === UserRole.ADMIN) {
            return ordered;
        }

        return ordered.filter((item) => item !== 'Teste');
    }, [profile?.role]);

    const isManagementRole = profile?.role === UserRole.ADMIN || profile?.role === UserRole.DIRETORA;
    const canViewAllAudits = isManagementRole || canManageAuditorias;
    const leaderDepartments = useMemo(() => profile?.departamentos || [], [profile]);

    const allowedDepartments = useMemo(() => {
        if (canViewAllAudits) {
            return allDepartments;
        }

        return allDepartments.filter((dep) => leaderDepartments.includes(dep));
    }, [allDepartments, canViewAllAudits, leaderDepartments]);

    const [audits, setAudits] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [editingAudit, setEditingAudit] = useState(null);
    const [editFormData, setEditFormData] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [auditLinksByDepartment, setAuditLinksByDepartment] = useState({});
    const [lastCreatedDepartment, setLastCreatedDepartment] = useState('');
    const [formData, setFormData] = useState({
        setor: '',
        mes: getCurrentMonth(),
        scores: buildInitialScores(),
        observacoes: '',
    });

    const showCreateSection = mode !== 'visualizar' && canCreateAuditorias;
    const showVisualizationSection = mode !== 'nova';

    useEffect(() => {
        const unsubscribeAudits = subscribeAudits(
            setAudits,
            () => addNotification('Não foi possível carregar as auditorias do Firestore. Usando cache local.', 'warning'),
        );
        const unsubscribe = subscribeAuditLinks(setAuditLinksByDepartment);
        return () => {
            unsubscribeAudits?.();
            unsubscribe?.();
        };
    }, [addNotification]);

    useEffect(() => {
        notifications
            .filter((item) => !item.lida && item.type === 'auditoria')
            .forEach((item) => {
                void marcarLida(item.id);
            });
    }, [marcarLida, notifications]);

    const visibleAudits = useMemo(() => {
        const byRole = audits.filter((audit) => {
            if (canViewAllAudits) {
                return true;
            }

            return leaderDepartments.includes(audit.setor);
        });

        return byRole
            .filter((audit) => !selectedMonth || audit.mes === selectedMonth)
            .filter((audit) => !selectedDepartment || audit.setor === selectedDepartment)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }, [audits, canViewAllAudits, leaderDepartments, selectedMonth, selectedDepartment]);

    const monthScopedAudits = useMemo(() => {
        const byRole = audits.filter((audit) => {
            if (canViewAllAudits) {
                return true;
            }

            return leaderDepartments.includes(audit.setor);
        });

        return byRole.filter((audit) => !selectedMonth || audit.mes === selectedMonth);
    }, [audits, canViewAllAudits, leaderDepartments, selectedMonth]);

    const monthlyAverage = useMemo(() => {
        if (visibleAudits.length === 0) {
            return 0;
        }

        const total = visibleAudits.reduce((sum, audit) => sum + getAuditTotal(audit), 0);
        return Math.round((total / visibleAudits.length) * 10) / 10;
    }, [visibleAudits]);

    // Exclui 'Teste' da contagem de cobertura independente do perfil
    const departmentsForCoverage = useMemo(
        () => allowedDepartments.filter((dep) => dep !== 'Teste'),
        [allowedDepartments],
    );

    const sectorsAuditedCount = useMemo(
        () => new Set(visibleAudits.filter((a) => a.setor !== 'Teste').map((a) => a.setor)).size,
        [visibleAudits],
    );

    const coveragePercent = useMemo(() => {
        if (!departmentsForCoverage.length) return 0;
        return Math.round((sectorsAuditedCount / departmentsForCoverage.length) * 100);
    }, [departmentsForCoverage.length, sectorsAuditedCount]);

    const monthlyConformity = useMemo(() => {
        const totalQuestions = monthScopedAudits.length * QUESTIONS_PER_SENSE * SENSOS.length;

        if (totalQuestions === 0) {
            return {
                totalQuestions: 0,
                nonConformingCount: 0,
                conformityPercent: 0,
                nonConformingPercent: 0,
            };
        }

        const nonConformingCount = monthScopedAudits.reduce((total, audit) => {
            const auditNonConforming = SENSOS.reduce((senseTotal, sense) => {
                const answers = Array.isArray(audit?.scores?.[sense.key]) ? audit.scores[sense.key] : [];
                return senseTotal + answers.filter((value) => Number(value) <= 2).length;
            }, 0);

            return total + auditNonConforming;
        }, 0);

        const conformityPercent = Math.round((((totalQuestions - nonConformingCount) / totalQuestions) * 100) * 10) / 10;
        const nonConformingPercent = Math.round(((nonConformingCount / totalQuestions) * 100) * 10) / 10;

        return {
            totalQuestions,
            nonConformingCount,
            conformityPercent,
            nonConformingPercent,
        };
    }, [monthScopedAudits]);

    // Média histórica do setor selecionado (ignora filtro de mês)
    const sectorHistoricalAverage = useMemo(() => {
        if (!selectedDepartment) return null;

        const sectorAudits = audits.filter(
            (a) => a.setor === selectedDepartment && a.setor !== 'Teste',
        );

        if (sectorAudits.length === 0) return null;

        const total = sectorAudits.reduce((sum, a) => sum + getAuditTotal(a), 0);
        return Math.round((total / sectorAudits.length) * 10) / 10;
    }, [audits, selectedDepartment]);

    const criticalCount = useMemo(
        () => visibleAudits.filter((audit) => getAuditTotal(audit) <= 50).length,
        [visibleAudits],
    );

    const sectorStatus = useMemo(() => {
        if (visibleAudits.length === 0) return null;
        return scoreLabel(Math.round(monthlyAverage));
    }, [monthlyAverage, visibleAudits]);

    const editSenseTotals = useMemo(() => {
        if (!editFormData) return {};
        return SENSOS.reduce((acc, sense) => ({
            ...acc,
            [sense.key]: (editFormData.scores?.[sense.key] || []).reduce((sum, v) => sum + Number(v || 0), 0),
        }), {});
    }, [editFormData]);

    const editFormTotal = useMemo(
        () => SENSOS.reduce((sum, sense) => sum + (editSenseTotals[sense.key] || 0), 0),
        [editSenseTotals],
    );

    const topSector = useMemo(() => {
        if (visibleAudits.length === 0) {
            return null;
        }

        const grouped = visibleAudits.reduce((acc, audit) => {
            const current = acc[audit.setor] || { total: 0, count: 0 };
            acc[audit.setor] = {
                total: current.total + getAuditTotal(audit),
                count: current.count + 1,
            };
            return acc;
        }, {});

        const ranked = Object.entries(grouped)
            .map(([setor, data]) => ({
                setor,
                media: Math.round((data.total / data.count) * 10) / 10,
            }))
            .sort((a, b) => b.media - a.media);

        return ranked[0] || null;
    }, [visibleAudits]);

    const senseTotals = useMemo(
        () => SENSOS.reduce((acc, sense) => ({
            ...acc,
            [sense.key]: (formData.scores[sense.key] || []).reduce((sum, value) => sum + Number(value || 0), 0),
        }), {}),
        [formData.scores],
    );

    const formTotal = useMemo(
        () => SENSOS.reduce((sum, sense) => sum + (senseTotals[sense.key] || 0), 0),
        [senseTotals],
    );

    const handleQuestionScoreChange = (senseKey, questionIndex, value) => {
        const score = Number(value);
        setFormData((prev) => {
            const currentSenseScores = [...(prev.scores[senseKey] || Array(QUESTIONS_PER_SENSE).fill(0))];
            currentSenseScores[questionIndex] = score;

            return {
                ...prev,
                scores: {
                    ...prev.scores,
                    [senseKey]: currentSenseScores,
                },
            };
        });
    };

    const fillSenseScores = (senseKey, score) => {
        setFormData((prev) => ({
            ...prev,
            scores: {
                ...prev.scores,
                [senseKey]: Array(QUESTIONS_PER_SENSE).fill(Number(score)),
            },
        }));
    };

    const handleCreate = async (event) => {
        event.preventDefault();

        if (!formData.setor || !formData.mes) {
            return;
        }

        const total = formTotal;

        const newAudit = {
            id: `${Date.now()}`,
            setor: formData.setor,
            mes: formData.mes,
            observacoes: formData.observacoes.trim(),
            criadoPorId: profile?.id || null,
            criadoPorNome: profile?.nome || 'Usuario',
            createdAt: new Date().toISOString(),
            maxScore: MAX_TOTAL,
            total,
            senseTotals,
            scores: formData.scores,
        };

        try {
            const savedAudit = await saveAudit(newAudit);
            setAudits((prev) => [savedAudit, ...prev.filter((item) => item.id !== savedAudit.id)]);

            const recipients = users.filter((item) => {
                if (item.id === profile?.id) {
                    return false;
                }

                return Array.isArray(item.departamentos) && item.departamentos.includes(formData.setor);
            });

            await Promise.allSettled(recipients.map((recipient) => createUserNotification(
                {
                    recipientUid: recipient.id,
                    recipientEmail: recipient.email,
                },
                {
                    message: `Nova auditoria lançada para o setor ${formData.setor} no mês ${formData.mes}.`,
                    type: 'auditoria',
                    relatedOrderId: savedAudit.id,
                },
            )));

            setLastCreatedDepartment(formData.setor);
            setFormData((prev) => ({
                ...prev,
                setor: '',
                mes: getCurrentMonth(),
                observacoes: '',
                scores: buildInitialScores(),
            }));
            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 3000);
        } catch (error) {
            addNotification(error?.message || 'Não foi possível salvar a auditoria.', 'error');
        }
    };

    const createdAuditLink = getAuditLinkByDepartment(auditLinksByDepartment, lastCreatedDepartment);

    const handleEditStart = (audit) => {
        const scores = {};
        SENSOS.forEach((sense) => {
            scores[sense.key] = Array.isArray(audit.scores?.[sense.key])
                ? [...audit.scores[sense.key]]
                : Array(QUESTIONS_PER_SENSE).fill(0);
        });
        setEditFormData({ setor: audit.setor, mes: audit.mes, observacoes: audit.observacoes || '', scores });
        setEditingAudit(audit);
    };

    const handleEditQuestionChange = (senseKey, questionIndex, value) => {
        const score = Number(value);
        setEditFormData((prev) => {
            const cur = [...(prev.scores[senseKey] || Array(QUESTIONS_PER_SENSE).fill(0))];
            cur[questionIndex] = score;
            return { ...prev, scores: { ...prev.scores, [senseKey]: cur } };
        });
    };

    const fillEditSenseScores = (senseKey, score) => {
        setEditFormData((prev) => ({
            ...prev,
            scores: {
                ...prev.scores,
                [senseKey]: Array(QUESTIONS_PER_SENSE).fill(Number(score)),
            },
        }));
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        try {
            const updatedAudit = await saveAudit({
                ...editingAudit,
                setor: editFormData.setor,
                mes: editFormData.mes,
                observacoes: editFormData.observacoes.trim(),
                total: editFormTotal,
                senseTotals: editSenseTotals,
                scores: editFormData.scores,
                updatedAt: new Date().toISOString(),
            });

            setAudits((prev) => prev.map((item) => (item.id === updatedAudit.id ? updatedAudit : item)));
            setEditingAudit(null);
            setEditFormData(null);
        } catch (error) {
            addNotification(error?.message || 'Não foi possível atualizar a auditoria.', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteAudit(id);
            setAudits((prev) => prev.filter((a) => a.id !== id));
            setConfirmDeleteId(null);
        } catch (error) {
            addNotification(error?.message || 'Não foi possível excluir a auditoria.', 'error');
        }
    };

    return (
        <AppLayout pageTitle="Auditorias 5S">
            <div className="animate-fadeIn space-y-6">
                {showVisualizationSection && (
                    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#07233a_0%,#0d4569_55%,#123b5d_100%)] text-white shadow-[0_24px_80px_rgba(4,21,35,0.22)]">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/[0.05]" />
                    <div className="pointer-events-none absolute -bottom-10 right-16 h-24 w-24 rounded-full bg-hotel-gold/15" />
                    <div className="grid gap-8 px-6 py-7 lg:px-8 lg:py-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                                    <ShieldCheck size={14} className="text-hotel-gold" /> Qualidade operacional
                                </div>
                                <h1 className="mt-4 max-w-xl font-heading text-3xl font-bold leading-tight lg:text-4xl">Auditorias por setor com score 5S</h1>
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 lg:text-base">
                                    Registre auditorias mês a mês, acompanhe a evolução por setor e priorize planos de ação com base na nota final.
                                </p>
                                {canCreateAuditorias && (
                                    <div className="mt-6">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (showCreateSection) {
                                                    document.getElementById('nova-auditoria-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    return;
                                                }

                                                navigate('/auditorias/nova');
                                            }}
                                            className="inline-flex items-center gap-2 rounded-xl bg-hotel-gold px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-hotel-gold/20 transition-transform hover:-translate-y-0.5"
                                        >
                                            <Plus size={16} /> Nova Auditoria
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm transition-transform hover:-translate-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/65">Cobertura de setores</p>
                                        <Radar size={14} className="text-hotel-gold" />
                                    </div>
                                    <p className="mt-1 text-2xl font-bold text-white">{coveragePercent}%</p>
                                    <p className="mt-1 text-xs text-white/70">{sectorsAuditedCount}/{departmentsForCoverage.length || 0} setores auditados no ciclo</p>
                                </div>
                                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm transition-transform hover:-translate-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/65">Performance 5S</p>
                                        <Trophy size={14} className="text-hotel-gold" />
                                    </div>
                                    {monthlyConformity.totalQuestions > 0 ? (
                                        <>
                                            <p className="mt-1 text-2xl font-bold text-white">{monthlyConformity.conformityPercent}%</p>
                                            <p className="mt-1 text-xs text-white/70">Não conformidade: {monthlyConformity.nonConformingPercent}%</p>
                                            <p className="mt-1 text-[11px] text-white/70">{monthlyConformity.nonConformingCount} perguntas não conformes (0 a 2) de {monthlyConformity.totalQuestions}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="mt-1 text-2xl font-bold text-white/40">-</p>
                                            <p className="mt-1 text-xs text-white/50">Sem auditorias no mês filtrado</p>
                                        </>
                                    )}
                                </div>
                                <div className={`rounded-2xl border px-4 py-3 backdrop-blur-sm transition-transform hover:-translate-y-0.5 ${sectorStatus ? `${sectorStatus.cardBg} ${sectorStatus.cardBorder}` : 'border-white/15 bg-white/10'}`}>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/65">Status do ciclo</p>
                                        <CheckCircle2 size={14} className="text-hotel-gold" />
                                    </div>
                                    {(() => {
                                        const displayAvg = sectorHistoricalAverage !== null ? sectorHistoricalAverage : monthlyAverage;
                                        const displayStatus = displayAvg > 0 ? scoreLabel(Math.round(displayAvg)) : null;
                                        const label = selectedDepartment
                                            ? `${selectedDepartment} - média histórica ${displayAvg}/100`
                                            : `Geral - média ${monthlyAverage}/100`;

                                        return displayStatus ? (
                                            <>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className={`h-2.5 w-2.5 rounded-full ${displayStatus.dot}`} />
                                                    <p className={`text-xl font-bold ${displayStatus.statusColor}`}>{displayStatus.text}</p>
                                                </div>
                                                <p className="mt-1 text-xs text-white/70">{label}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="mt-1 text-xl font-bold text-white/40">-</p>
                                                <p className="mt-1 text-xs text-white/50">Sem auditorias no filtro</p>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                    </section>
                )}

                <section className={`grid gap-6 ${showCreateSection && showVisualizationSection ? 'lg:grid-cols-[1fr_1.2fr]' : ''}`}>
                    {showCreateSection && (
                        <div id="nova-auditoria-form" className="overflow-hidden rounded-3xl border border-hotel-blue/15 bg-white shadow-[0_16px_40px_rgba(4,21,35,0.08)]">
                        <div className="border-b border-hotel-blue/10 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] px-5 py-4">
                            <h2 className="inline-flex items-center gap-2 font-heading text-xl font-bold text-hotel-blue">
                                <ClipboardCheck size={18} /> Nova Auditoria
                            </h2>
                            <p className="mt-1 text-xs text-hotel-gray-md">Preencha os 5 sensos e registre evidências do setor.</p>
                        </div>

                        <form className="space-y-4 p-5" onSubmit={handleCreate}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="label">Setor</label>
                                    <select
                                        value={formData.setor}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, setor: e.target.value }))}
                                        className="input"
                                        required
                                    >
                                        <option value="" disabled>Selecione um Setor</option>
                                        {allowedDepartments.map((dep) => (
                                            <option key={dep} value={dep}>{dep}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Mês da auditoria</label>
                                    <input
                                        type="month"
                                        value={formData.mes}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, mes: e.target.value }))}
                                        onClick={openMonthPicker}
                                        onFocus={openMonthPicker}
                                        className="input h-11 cursor-pointer"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 rounded-2xl border border-hotel-blue/10 bg-hotel-light/30 p-4">
                                {SENSOS.map((sense) => (
                                    <div key={sense.key} className="rounded-xl border border-hotel-blue/10 bg-white p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <label className="label m-0">{sense.label}</label>
                                            <span className="rounded-full bg-hotel-blue/10 px-2.5 py-1 text-xs font-semibold text-hotel-blue">
                                                {senseTotals[sense.key]}/{MAX_PER_SENSE}
                                            </span>
                                        </div>
                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            <span className="text-[11px] font-semibold text-hotel-gray-md">Preencher todo senso:</span>
                                            {[0, 1, 2, 3, 4].map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => fillSenseScores(sense.key, option)}
                                                    className="rounded-full border border-hotel-blue/20 px-2 py-0.5 text-[11px] font-semibold text-hotel-blue transition-colors hover:bg-hotel-blue/10"
                                                >
                                                    Tudo {option}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mb-1 text-[11px] font-medium text-hotel-gray-md">Clique na nota de cada pergunta:</div>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:gap-2.5">
                                            {Array.from({ length: QUESTIONS_PER_SENSE }).map((_, questionIndex) => (
                                                <label key={questionIndex} className="flex flex-col gap-1.5 rounded-lg border border-hotel-blue/10 bg-hotel-light/20 p-2 text-[11px] text-hotel-gray-md">
                                                    <span className="font-semibold text-hotel-blue/80">Q{questionIndex + 1}</span>
                                                    <ScoreSelector
                                                        value={formData.scores[sense.key][questionIndex]}
                                                        onChange={(value) => handleQuestionScoreChange(sense.key, questionIndex, value)}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between rounded-xl border border-hotel-blue/15 bg-white px-3 py-2.5">
                                <div className="overflow-hidden rounded-xl border border-hotel-blue/15 bg-[linear-gradient(135deg,#07233a_0%,#0d4569_100%)]">
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.15em] text-white/60">Pontuação total</p>
                                            <p className="mt-0.5 text-3xl font-extrabold text-white">{formTotal}<span className="ml-1 text-base font-normal text-white/50">/{MAX_TOTAL}</span></p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreLabel(formTotal).tone}`}>
                                                {scoreLabel(formTotal).text}
                                            </span>
                                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                                                <div
                                                    className="h-full rounded-full bg-hotel-gold transition-all duration-500"
                                                    style={{ width: `${scorePercent(formTotal)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </div>

                            <div>
                                <label className="label">Observações e plano de ação</label>
                                <textarea
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                                    className="input min-h-[110px] resize-none"
                                    placeholder="Ex: ajustar rotina de descarte, padronizar etiquetas e reforçar treinamento no turno da tarde."
                                />
                            </div>

                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-xl bg-hotel-gold px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-hotel-gold/20 transition-transform hover:-translate-y-0.5 hover:bg-hotel-gold/90"
                            >
                                <Save size={15} /> Salvar Auditoria
                            </button>

                            {savedSuccess && (
                                <div className="flex animate-fadeIn flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2 font-semibold">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <span>Auditoria salva com sucesso!</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {createdAuditLink ? (
                                            <a
                                                href={createdAuditLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                                            >
                                                Acessar Auditoria
                                            </a>
                                        ) : (
                                            <span className="text-xs text-emerald-700/80">
                                                Nenhum link configurado para {lastCreatedDepartment || 'este setor'} no Gerenciamento.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </form>
                        </div>
                    )}

                    {showVisualizationSection && (
                        <div className="space-y-4">

                        {/* Filter bar */}
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hotel-blue/10 bg-white px-4 py-3 shadow-sm">
                            <Filter size={13} className="flex-shrink-0 text-hotel-gray-md" />
                            <span className="hidden text-xs font-semibold text-hotel-gray-md sm:inline">Filtrar:</span>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                onClick={openMonthPicker}
                                onFocus={openMonthPicker}
                                className="h-9 cursor-pointer rounded-xl border border-hotel-blue/15 bg-hotel-light/60 px-3 text-sm font-medium text-hotel-blue focus:border-hotel-blue/40 focus:outline-none focus:ring-2 focus:ring-hotel-blue/10"
                            />
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="h-9 min-w-[150px] cursor-pointer rounded-xl border border-hotel-blue/15 bg-hotel-light/60 px-3 text-sm font-medium text-hotel-blue focus:border-hotel-blue/40 focus:outline-none focus:ring-2 focus:ring-hotel-blue/10"
                            >
                                <option value="">Todos os setores</option>
                                {allowedDepartments.map((dep) => (
                                    <option key={dep} value={dep}>{dep}</option>
                                ))}
                            </select>
                            {(selectedDepartment) && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDepartment('')}
                                    className="flex items-center gap-1 rounded-xl border border-hotel-gray/25 bg-white px-2.5 py-1.5 text-xs font-semibold text-hotel-gray-md transition-colors hover:border-red-200 hover:text-red-500"
                                >
                                    <X size={10} /> Limpar
                                </button>
                            )}
                            <span className="ml-auto text-[11px] font-semibold text-hotel-gray-md">
                                {visibleAudits.length} auditoria{visibleAudits.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Audit cards */}
                        {visibleAudits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hotel-blue/20 bg-white py-16 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-hotel-blue/5">
                                    <ClipboardCheck size={28} className="text-hotel-blue/30" />
                                </div>
                                <p className="text-sm font-semibold text-hotel-gray-md">Nenhuma auditoria encontrada</p>
                                <p className="text-xs text-hotel-gray-md/70">Ajuste os filtros ou registre a primeira auditoria do período.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {visibleAudits.map((audit) => {
                                    const SENSE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#a855f7', '#C49A6C'];
                                    const totalScore = getAuditTotal(audit);
                                    const label = scoreLabel(totalScore);
                                    const percent = scorePercent(totalScore);
                                    const auditLink = getAuditLinkByDepartment(auditLinksByDepartment, audit.setor);
                                    const accent = totalScore >= 91 ? '#10b981' : totalScore >= 81 ? '#22c55e' : totalScore >= 71 ? '#f59e0b' : totalScore >= 51 ? '#f97316' : '#ef4444';
                                    return (
                                        <div key={audit.id} className="group relative overflow-hidden rounded-2xl border border-hotel-blue/10 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(4,21,35,0.12)]">
                                            {/* score accent stripe */}
                                            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

                                            <div className="p-4">
                                                {/* header */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="truncate font-heading text-base font-bold text-hotel-blue">{audit.setor}</h4>
                                                        <p className="mt-0.5 text-[11px] text-hotel-gray-md">{audit.mes} - {audit.criadoPorNome}</p>
                                                    </div>
                                                    <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                                                        <span className={`rounded-xl px-2.5 py-1 text-sm font-bold ${label.tone}`}>
                                                            {totalScore}<span className="ml-0.5 text-[10px] font-normal opacity-60">/100</span>
                                                        </span>
                                                        <span className="text-[10px] font-bold" style={{ color: accent }}>{label.text}</span>
                                                    </div>
                                                </div>

                                                {/* main progress bar */}
                                                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-hotel-light">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${accent}, ${accent}cc)` }}
                                                    />
                                                </div>

                                                {/* per-senso mini bars */}
                                                <div className="mt-3 grid grid-cols-5 gap-1.5">
                                                    {SENSOS.map((sense, si) => {
                                                        const senseTotal = getSenseTotalFromAudit(audit, sense.key);
                                                        const sPct = Math.round((senseTotal / MAX_PER_SENSE) * 100);
                                                        const shortName = sense.label.split(':')[1]?.trim() || sense.label;
                                                        const col = SENSE_COLORS[si % SENSE_COLORS.length];
                                                        return (
                                                            <div key={sense.key} className="flex flex-col items-center gap-1">
                                                                <div className="relative h-10 w-full overflow-hidden rounded-lg bg-gray-300/50">
                                                                    <div className="absolute bottom-0 w-full rounded-lg transition-all duration-500" style={{ height: `${sPct}%`, backgroundColor: col }} />
                                                                </div>
                                                                <span className="w-full text-center text-[9px] leading-tight text-hotel-gray-md whitespace-normal break-words">{shortName}</span>
                                                                <span className="text-[9px] font-bold" style={{ color: col }}>{senseTotal}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* notes */}
                                                {audit.observacoes && (
                                                    <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-hotel-gray-md">{audit.observacoes}</p>
                                                )}

                                                {/* footer actions */}
                                                <div className="mt-3 flex items-center justify-between border-t border-hotel-blue/5 pt-3">
                                                    <div>
                                                        {auditLink && (
                                                            <a
                                                                href={auditLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 rounded-lg bg-hotel-blue/5 px-2.5 py-1.5 text-[11px] font-semibold text-hotel-blue transition-colors hover:bg-hotel-blue/10"
                                                            >
                                                                Acessar Auditoria
                                                            </a>
                                                        )}
                                                    </div>
                                                    {canManageAuditorias && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleEditStart(audit)}
                                                                className="rounded-lg p-1.5 text-hotel-gray-md transition-colors hover:bg-hotel-blue/10 hover:text-hotel-blue"
                                                                title="Editar"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            {confirmDeleteId === audit.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs font-semibold text-red-500">Excluir?</span>
                                                                    <button onClick={() => handleDelete(audit.id)} className="rounded px-2 py-0.5 text-xs font-bold text-red-600 hover:bg-red-50">Sim</button>
                                                                    <button onClick={() => setConfirmDeleteId(null)} className="rounded px-2 py-0.5 text-xs text-hotel-gray-md hover:bg-hotel-light">Não</button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setConfirmDeleteId(audit.id)}
                                                                    className="rounded-lg p-1.5 text-hotel-gray-md transition-colors hover:bg-red-50 hover:text-red-500"
                                                                    title="Excluir"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        </div>
                    )}
                </section>
            </div>
            {editingAudit && editFormData && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={() => { setEditingAudit(null); setEditFormData(null); }}
                >
                    <div
                        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(4,21,35,0.3)]"
                        style={{ maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-hotel-blue/10 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] px-6 py-4">
                            <h2 className="font-heading text-lg font-bold text-hotel-blue">Editar Auditoria</h2>
                            <button
                                onClick={() => { setEditingAudit(null); setEditFormData(null); }}
                                className="rounded-xl p-1.5 text-hotel-gray-md hover:bg-hotel-blue/10"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleEditSave} className="space-y-4 p-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="label">Setor</label>
                                    <select
                                        value={editFormData.setor}
                                        onChange={(e) => setEditFormData((prev) => ({ ...prev, setor: e.target.value }))}
                                        className="input"
                                        required
                                    >
                                        {allowedDepartments.map((dep) => (
                                            <option key={dep} value={dep}>{dep}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Mês da auditoria</label>
                                    <input
                                        type="month"
                                        value={editFormData.mes}
                                        onChange={(e) => setEditFormData((prev) => ({ ...prev, mes: e.target.value }))}
                                        onClick={openMonthPicker}
                                        onFocus={openMonthPicker}
                                        className="input h-11 cursor-pointer"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 rounded-2xl border border-hotel-blue/10 bg-hotel-light/30 p-4">
                                {SENSOS.map((sense) => (
                                    <div key={sense.key} className="rounded-xl border border-hotel-blue/10 bg-white p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <label className="label m-0">{sense.label}</label>
                                            <span className="rounded-full bg-hotel-blue/10 px-2.5 py-1 text-xs font-semibold text-hotel-blue">
                                                {editSenseTotals[sense.key] ?? 0}/{MAX_PER_SENSE}
                                            </span>
                                        </div>
                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            <span className="text-[11px] font-semibold text-hotel-gray-md">Preencher todo senso:</span>
                                            {[0, 1, 2, 3, 4].map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => fillEditSenseScores(sense.key, option)}
                                                    className="rounded-full border border-hotel-blue/20 px-2 py-0.5 text-[11px] font-semibold text-hotel-blue transition-colors hover:bg-hotel-blue/10"
                                                >
                                                    Tudo {option}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mb-1 text-[11px] font-medium text-hotel-gray-md">Clique na nota de cada pergunta:</div>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:gap-2.5">
                                            {Array.from({ length: QUESTIONS_PER_SENSE }).map((_, qi) => (
                                                <label key={qi} className="flex flex-col gap-1.5 rounded-lg border border-hotel-blue/10 bg-hotel-light/20 p-2 text-[11px] text-hotel-gray-md">
                                                    <span className="font-semibold text-hotel-blue/80">Q{qi + 1}</span>
                                                    <ScoreSelector
                                                        value={editFormData.scores[sense.key][qi]}
                                                        onChange={(value) => handleEditQuestionChange(sense.key, qi, value)}
                                                        compact
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between rounded-xl border border-hotel-blue/15 bg-white px-3 py-2.5">
                                    <p className="text-sm font-semibold text-hotel-gray-md">Pontuação total</p>
                                    <span className="rounded-full bg-hotel-gold/15 px-3 py-1 text-sm font-bold text-hotel-blue">
                                        {editFormTotal}/{MAX_TOTAL}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="label">Observações e plano de ação</label>
                                <textarea
                                    value={editFormData.observacoes}
                                    onChange={(e) => setEditFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                                    className="input min-h-[90px] resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setEditingAudit(null); setEditFormData(null); }}
                                    className="rounded-xl border border-hotel-blue/20 px-4 py-2 text-sm text-hotel-gray-md hover:bg-hotel-light"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-xl bg-hotel-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-hotel-gold/90"
                                >
                                    <Save size={15} /> Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
