import { useEffect, useMemo, useState, useRef } from 'react';
import {
    BarChart3,
    Calendar,
    Users,
    Sliders,
    Award,
    Briefcase,
    Megaphone,
    Shirt,
    ShoppingCart,
    Key,
    AlertTriangle,
    ConciergeBell,
    Wrench,
    Utensils,
    DollarSign,
    Home,
    ExternalLink,
    Edit3,
    X,
    CheckCircle2,
    AlertCircle,
    XCircle,
    TrendingUp,
    TrendingDown,
    Building2,
    Info,
    Target,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Trash2
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { UserRole } from '../../models/User';
import { subscribeIndicadores, saveIndicador, deleteIndicador, DEFAULT_INDICADORES_SPREADSHEET_URL } from '../../services/indicadoresStorage';
import { hasPermission, PERMISSIONS } from '../../services/permissions';

// Lista padrão de setores para garantir que a tela nunca fique vazia
const DEFAULT_SECTORS = [
    'Recepção',
    'Hospedagem',
    'Governança',
    'Manutenção',
    'Restaurante',
    'A&B',
    'Financeiro',
    'RH',
    'Compras e Suprimentos',
    'Controle',
    'Qualidade',
    'Comercial',
    'Marketing',
    'Lavanderia',
    'TI',
    'Eventos',
    'Diretoria'
];

// Mapeamento de estilos visuais e ícones para cada setor
const SECTOR_CONFIG = {
    'Recepção': { icon: ConciergeBell, color: 'from-blue-600 to-sky-500', bg: 'bg-blue-50 text-blue-600' },
    'Hospedagem': { icon: Key, color: 'from-sky-600 to-blue-400', bg: 'bg-sky-50 text-sky-600' },
    'Governança': { icon: Home, color: 'from-amber-500 to-yellow-500', bg: 'bg-amber-50 text-amber-600' },
    'Manutenção': { icon: Wrench, color: 'from-rose-500 to-orange-400', bg: 'bg-rose-50 text-rose-600' },
    'Restaurante': { icon: Utensils, color: 'from-emerald-600 to-teal-500', bg: 'bg-emerald-50 text-emerald-600' },
    'A&B': { icon: Utensils, color: 'from-teal-600 to-emerald-500', bg: 'bg-teal-50 text-teal-600' },
    'Financeiro': { icon: DollarSign, color: 'from-purple-600 to-indigo-500', bg: 'bg-purple-50 text-purple-600' },
    'RH': { icon: Users, color: 'from-pink-600 to-rose-400', bg: 'bg-pink-50 text-pink-600' },
    'Compras e Suprimentos': { icon: ShoppingCart, color: 'from-cyan-600 to-teal-400', bg: 'bg-cyan-50 text-cyan-600' },
    'Controle': { icon: Sliders, color: 'from-violet-600 to-fuchsia-500', bg: 'bg-violet-50 text-violet-600' },
    'Qualidade': { icon: Award, color: 'from-yellow-600 to-amber-500', bg: 'bg-yellow-50 text-yellow-600' },
    'Comercial': { icon: Briefcase, color: 'from-indigo-600 to-blue-500', bg: 'bg-indigo-50 text-indigo-600' },
    'Marketing': { icon: Megaphone, color: 'from-orange-600 to-red-500', bg: 'bg-orange-50 text-orange-600' },
    'Lavanderia': { icon: Shirt, color: 'from-sky-500 to-cyan-400', bg: 'bg-sky-50 text-sky-600' },
    'TI': { icon: Sliders, color: 'from-blue-600 to-indigo-500', bg: 'bg-blue-50 text-blue-600' },
    'Eventos': { icon: Calendar, color: 'from-fuchsia-600 to-pink-500', bg: 'bg-fuchsia-50 text-fuchsia-600' },
    'Diretoria': { icon: Award, color: 'from-amber-600 to-yellow-500', bg: 'bg-amber-50 text-amber-600' }
};

const DEFAULT_SECTOR_STYLE = {
    icon: Target,
    color: 'from-slate-600 to-slate-400',
    bg: 'bg-slate-50 text-slate-600'
};

function getSectorStyle(sectorName) {
    return SECTOR_CONFIG[sectorName] || DEFAULT_SECTOR_STYLE;
}

// Retorna classificação do resultado de acordo com as metas
function getClassification(percentage) {
    if (percentage < 50) return { label: 'Mal', colorClass: 'text-red-600 bg-red-50 border-red-200', hex: '#EF4444', icon: XCircle };
    if (percentage < 75) return { label: 'Razoável', colorClass: 'text-amber-600 bg-amber-50 border-amber-200', hex: '#F59E0B', icon: AlertCircle };
    return { label: 'Bom', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200', hex: '#10B981', icon: CheckCircle2 };
}

// Gera os 12 meses do ano para o gráfico histórico
function getMonthsOfYear(year) {
    const list = [];
    const months = [
        { name: 'Jan', value: '01' },
        { name: 'Fev', value: '02' },
        { name: 'Mar', value: '03' },
        { name: 'Abr', value: '04' },
        { name: 'Mai', value: '05' },
        { name: 'Jun', value: '06' },
        { name: 'Jul', value: '07' },
        { name: 'Ago', value: '08' },
        { name: 'Set', value: '09' },
        { name: 'Out', value: '10' },
        { name: 'Nov', value: '11' },
        { name: 'Dez', value: '12' }
    ];
    months.forEach((m) => {
        list.push({
            key: `${year}-${m.value}`,
            label: `${m.name}/${String(year).slice(-2)}`
        });
    });
    return list;
}

export default function Indicadores() {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { availableDepartments, currentUserProfile } = useUsers();
    const profile = currentUserProfile || user;

    // Configuração de Períodos
    const currentYear = new Date().getFullYear();
    const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
    const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonthStr}`);

    // Desmembrar mês e ano do estado selectedMonth (formato YYYY-MM)
    const [selectedYearPart, selectedMonthPart] = useMemo(() => {
        return selectedMonth.split('-');
    }, [selectedMonth]);

    // Lista de Indicadores da Base
    const [allIndicadores, setAllIndicadores] = useState([]);
    
    // Estados do Modal
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState({
        departamento: '',
        mes: '',
        porcentagem: 0,
        linkPlanilha: DEFAULT_INDICADORES_SPREADSHEET_URL
    });
    const [saving, setSaving] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    // Subscrever Firestore em tempo real
    useEffect(() => {
        const unsubscribe = subscribeIndicadores(
            (data) => setAllIndicadores(data),
            () => addNotification('Erro ao sincronizar indicadores. Exibindo dados locais.', 'warning')
        );
        return () => unsubscribe?.();
    }, [addNotification]);

    // Filtrar setores válidos
    const sectors = useMemo(() => {
        const source = availableDepartments && availableDepartments.length > 0 
            ? availableDepartments 
            : DEFAULT_SECTORS;
        return source.filter(dept => {
            const nameClean = dept.toLowerCase().trim().replace(/\./g, '');
            return nameClean !== 'bi' && nameClean !== 'teste';
        });
    }, [availableDepartments]);

    // Mapa de Indicadores do Mês Selecionado: { [departamento]: indicadorRecord }
    const currentMonthMap = useMemo(() => {
        const map = {};
        allIndicadores.forEach((ind) => {
            if (ind.mes === selectedMonth) {
                map[ind.departamento] = ind;
            }
        });
        return map;
    }, [allIndicadores, selectedMonth]);

    // Estatísticas do Mês Selecionado
    const monthStats = useMemo(() => {
        let totalPct = 0;
        let count = 0;
        let bomCount = 0;
        let razoavelCount = 0;
        let malCount = 0;

        sectors.forEach(dept => {
            const record = currentMonthMap[dept];
            if (record) {
                const pct = record.porcentagem;
                totalPct += pct;
                count++;
                if (pct >= 75) bomCount++;
                else if (pct >= 50) razoavelCount++;
                else malCount++;
            }
        });

        const average = count > 0 ? Math.round(totalPct / count) : null;
        return { average, count, bomCount, razoavelCount, malCount };
    }, [sectors, currentMonthMap]);

    // Dados para o Gráfico Histórico (12 meses do ano selecionado)
    const historyData = useMemo(() => {
        const months = getMonthsOfYear(selectedYearPart);
        return months.map(m => {
            let totalPct = 0;
            let count = 0;
            sectors.forEach(dept => {
                const found = allIndicadores.find(ind => ind.mes === m.key && ind.departamento === dept);
                if (found) {
                    totalPct += found.porcentagem;
                    count++;
                }
            });
            const avg = count > 0 ? Math.round(totalPct / count) : null;
            return {
                key: m.key,
                label: m.label,
                value: avg
            };
        });
    }, [allIndicadores, sectors, selectedYearPart]);

    // Determina se há algum histórico real no gráfico (se tudo for nulo, mostraremos um mock visual interativo com aviso)
    const hasHistoryData = useMemo(() => {
        return historyData.some(d => d.value !== null);
    }, [historyData]);

    // Mock para exibição inicial e design de impacto
    const displayHistoryData = useMemo(() => {
        if (hasHistoryData) return historyData;
        // Mock de demonstração caso esteja vazio
        const mockValues = [65, 70, 78, 72, 55, 68, 83, 80, 90, 88, 85, 92];
        return historyData.map((d, index) => {
            return { ...d, value: mockValues[index] || 80, isMock: true };
        });
    }, [historyData, hasHistoryData]);

    // Permissão de Edição por Setor
    const canEditSector = (sectorName) => {
        if (!hasPermission(profile, PERMISSIONS.INDICADORES_MANAGE)) {
            return false;
        }
        if (profile?.role === UserRole.ADMIN || profile?.role === UserRole.DIRETORA) {
            return true;
        }
        if (profile?.role === UserRole.LIDER) {
            const userDepts = profile?.departamentos || [];
            return userDepts.includes(sectorName);
        }
        return false;
    };

    // Abre Modal de Edição
    const handleOpenEdit = (sectorName) => {
        const record = currentMonthMap[sectorName];
        setModalData({
            departamento: sectorName,
            mes: selectedMonth,
            porcentagem: record ? record.porcentagem : 75,
            linkPlanilha: record && record.linkPlanilha ? record.linkPlanilha : DEFAULT_INDICADORES_SPREADSHEET_URL
        });
        setShowModal(true);
    };

    // Submeter Lançamento
    const handleSave = async (e) => {
        e.preventDefault();
        if (modalData.porcentagem < 0 || modalData.porcentagem > 100) {
            addNotification('A porcentagem deve estar entre 0 e 100%.', 'error');
            return;
        }

        if (!canEditSector(modalData.departamento)) {
            addNotification('Você não tem permissão para lançar notas para este setor.', 'error');
            return;
        }

        setSaving(true);
        try {
            await saveIndicador({
                departamento: modalData.departamento,
                mes: modalData.mes,
                porcentagem: Number(modalData.porcentagem),
                linkPlanilha: modalData.linkPlanilha ? modalData.linkPlanilha.trim() : DEFAULT_INDICADORES_SPREADSHEET_URL,
                atualizadoPor: profile?.nome || 'Usuário',
                updatedAt: new Date().toISOString()
            });

            addNotification(`Indicador do setor ${modalData.departamento} salvo com sucesso!`, 'success');
            setShowModal(false);
        } catch (error) {
            addNotification(`Erro ao salvar indicador: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Excluir Lançamento
    const handleDeleteClick = () => {
        if (!canEditSector(modalData.departamento)) {
            addNotification('Você não tem permissão para excluir notas deste setor.', 'error');
            return;
        }
        setShowConfirmDelete(true);
    };

    const handleDeleteConfirm = async () => {
        setShowConfirmDelete(false);
        const record = currentMonthMap[modalData.departamento];
        if (!record) {
            addNotification('Nenhum lançamento encontrado para excluir.', 'error');
            return;
        }

        setSaving(true);
        try {
            await deleteIndicador(record.id);
            addNotification(`Lançamento do setor ${modalData.departamento} excluído com sucesso!`, 'success');
            setShowModal(false);
        } catch (error) {
            addNotification(`Erro ao excluir lançamento: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Helpers de lista de meses e anos para o filtro minimalista
    const MONTHS_LIST = useMemo(() => [
        { value: '01', label: 'Janeiro' },
        { value: '02', label: 'Fevereiro' },
        { value: '03', label: 'Março' },
        { value: '04', label: 'Abril' },
        { value: '05', label: 'Maio' },
        { value: '06', label: 'Junho' },
        { value: '07', label: 'Julho' },
        { value: '08', label: 'Agosto' },
        { value: '09', label: 'Setembro' },
        { value: '10', label: 'Outubro' },
        { value: '11', label: 'Novembro' },
        { value: '12', label: 'Dezembro' }
    ], []);



    // Custom Dropdown Ref and Open/Temp states
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [tempYear, setTempYear] = useState(selectedYearPart);
    const dropdownRef = useRef(null);

    useEffect(() => {
        setTempYear(selectedYearPart);
    }, [selectedYearPart]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Desenho do SVG do Gráfico Histórico
    const svgChartContent = useMemo(() => {
        const width = 650;
        const height = 250;
        const paddingLeft = 60;
        const paddingRight = 45;
        const paddingTop = 35;
        const paddingBottom = 40;
        const marginX = 25; // margem horizontal para os nós não colarem nas bordas

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        const points = displayHistoryData.map((d, index) => {
            const val = d.value || 0;
            // Distribui os pontos com espaçamento seguro a partir das laterais
            const steps = displayHistoryData.length - 1 || 1;
            const x = paddingLeft + marginX + (index * ((chartWidth - 2 * marginX) / steps));
            const y = paddingTop + chartHeight - ((val / 100) * chartHeight);
            return { x, y, ...d };
        });

        // String do Path (linha de curva suave)
        let linePath = '';
        points.forEach((p, index) => {
            if (index === 0) {
                linePath += `M ${p.x} ${p.y}`;
            } else {
                const prev = points[index - 1];
                // Ponto de controle para deixar a curva suave
                const cp1x = prev.x + (p.x - prev.x) / 2;
                const cp1y = prev.y;
                const cp2x = prev.x + (p.x - prev.x) / 2;
                const cp2y = p.y;
                linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
            }
        });

        // Path de área sob a curva
        const areaPath = points.length > 0 
            ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
            : '';

        return { width, height, points, linePath, areaPath, paddingTop, paddingLeft, paddingRight, paddingBottom, chartWidth, chartHeight };
    }, [displayHistoryData]);

    return (
        <AppLayout pageTitle="Indicadores de Setor">
            <div className="mx-auto max-w-7xl animate-fadeIn space-y-6">
                
                {/* HEADER PREMIUM COM GRADIENTE */}
                <div 
                    className="relative rounded-[28px] text-white shadow-[0_20px_50px_rgba(10,61,98,0.15)] border border-white/10"
                >
                    {/* Background decorativo com overflow-hidden local */}
                    <div 
                        className="absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none z-0"
                        style={{ background: 'linear-gradient(135deg, #062135 0%, #0A3D62 50%, #1a5276 100%)' }}
                    >
                        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.03]" />
                        <div className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-hotel-gold/10" />
                    </div>
                    
                    <div className="relative z-10 grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_320px] lg:items-center">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                                <Target size={12} className="text-hotel-gold animate-pulse" /> Gestão de Performance
                            </div>
                            <h1 className="font-heading text-3xl font-extrabold tracking-tight lg:text-4xl">
                                Indicadores Mensais
                            </h1>
                            <p className="max-w-2xl text-sm leading-relaxed text-white/70 font-body">
                                Taxa de alcance de metas e KPIs para cada setor do hotel. Acompanhe os resultados gerais, consulte a planilha detalhada do departamento ou realize novos lançamentos mensais.
                            </p>
                        </div>

                        {/* Filtro de Meses Premium (Custom Dropdown) */}
                        <div 
                            ref={dropdownRef} 
                            className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm shadow-inner space-y-2"
                        >
                            <label className="text-[11px] font-bold uppercase tracking-wider text-hotel-gold flex items-center gap-1.5">
                                <Calendar size={13} /> Selecione o Período
                            </label>
                            
                            <div className="relative w-full">
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full flex items-center justify-between bg-white text-hotel-blue font-heading font-semibold text-sm rounded-xl px-4 py-2.5 outline-none shadow-md border border-white/15 hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                    <span className="flex items-center gap-2">
                                        <Calendar size={15} className="text-hotel-gold animate-pulse" />
                                        {MONTHS_LIST.find(m => m.value === selectedMonthPart)?.label} de {selectedYearPart}
                                    </span>
                                    <ChevronDown size={15} className={`text-hotel-blue/60 transition-transform duration-300 ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute right-0 left-0 mt-2 rounded-2xl bg-white p-4 shadow-xl border border-slate-100 z-50 animate-fadeIn min-w-[260px]">
                                        {/* Header com Navegação de Ano */}
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setTempYear(prev => String(Number(prev) - 1))}
                                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-hotel-blue transition-colors cursor-pointer"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <span className="font-heading font-bold text-sm text-hotel-blue tracking-wide">
                                                Ano {tempYear}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setTempYear(prev => String(Number(prev) + 1))}
                                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-hotel-blue transition-colors cursor-pointer"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>

                                        {/* Grid de Meses */}
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {MONTHS_LIST.map((m) => {
                                                const isSelected = selectedMonthPart === m.value && selectedYearPart === tempYear;
                                                return (
                                                    <button
                                                        key={m.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedMonth(`${tempYear}-${m.value}`);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className={`py-2 rounded-xl text-[11px] font-bold font-body transition-all text-center cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-hotel-blue text-white shadow-sm'
                                                                : 'bg-slate-50 text-slate-600 hover:bg-hotel-gold/15 hover:text-hotel-blue'
                                                        }`}
                                                    >
                                                        {m.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* DASHBOARD ANALYTICS E GRÁFICO HISTÓRICO */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
                    
                    {/* Estatísticas Gerais do Mês */}
                    <div className="rounded-3xl border border-hotel-gray/40 bg-white p-4 sm:p-6 shadow-card flex flex-col justify-between space-y-6 min-w-0">
                        <div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="font-heading text-sm font-bold text-slate-800 uppercase tracking-wider">
                                    Resultado do Mês
                                </h3>
                                <Info size={14} className="text-slate-400" />
                            </div>

                            <div className="mt-6 flex flex-col items-center text-center">
                                {monthStats.average !== null ? (
                                    <>
                                        <div className="relative flex items-center justify-center">
                                            {/* Circulo de Fundo */}
                                            <svg className="w-28 h-28 transform -rotate-90">
                                                <circle cx="56" cy="56" r="48" stroke="#E8ECF0" strokeWidth="8" fill="transparent" />
                                                <circle 
                                                    cx="56" 
                                                    cy="56" 
                                                    r="48" 
                                                    stroke={getClassification(monthStats.average).hex} 
                                                    strokeWidth="8" 
                                                    fill="transparent" 
                                                    strokeDasharray={2 * Math.PI * 48}
                                                    strokeDashoffset={2 * Math.PI * 48 - (monthStats.average / 100) * (2 * Math.PI * 48)}
                                                    className="transition-all duration-700 ease-out"
                                                />
                                            </svg>
                                            <span className="absolute text-2xl font-extrabold font-heading text-hotel-blue">
                                                {monthStats.average}%
                                            </span>
                                        </div>
                                        <h4 className="mt-4 text-base font-bold text-slate-850">
                                            Média Geral do Hotel
                                        </h4>
                                        <span className={`mt-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getClassification(monthStats.average).colorClass}`}>
                                            Média: {getClassification(monthStats.average).label}
                                        </span>
                                    </>
                                ) : (
                                    <div className="py-8 text-center space-y-2">
                                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto">
                                            <Target size={20} />
                                        </div>
                                        <p className="text-xs font-semibold text-slate-400 max-w-[200px]">
                                            Nenhum indicador lançado para este mês ainda.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pills de Contagem */}
                        <div className="border-t border-slate-100 pt-4 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Setores no "Bom"
                                </span>
                                <span className="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg">
                                    {monthStats.bomCount}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Setores no "Razoável"
                                </span>
                                <span className="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg">
                                    {monthStats.razoavelCount}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Setores no "Mal"
                                </span>
                                <span className="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg">
                                    {monthStats.malCount}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Gráfico Histórico Interativo */}
                    <div className="rounded-3xl border border-hotel-gray/40 bg-white p-4 sm:p-6 shadow-card space-y-4 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="font-heading text-sm font-bold text-slate-800 uppercase tracking-wider">
                                    Histórico de Desempenho
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Média consolidada do hotel ao longo do ano selecionado.
                                </p>
                            </div>
                            
                            {!hasHistoryData && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-250 animate-pulse">
                                    <Info size={10} /> Demonstração visual
                                </span>
                            )}
                        </div>

                        {/* SVG Drawing area */}
                        <div className="relative w-full overflow-x-auto overflow-y-hidden">
                            <svg 
                                viewBox={`0 0 ${svgChartContent.width} ${svgChartContent.height}`}
                                className="w-full min-w-[550px] h-[250px] overflow-visible"
                            >
                                <defs>
                                    {/* Gradiente de fundo sob a linha */}
                                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#C49A6C" stopOpacity="0.22" />
                                        <stop offset="100%" stopColor="#C49A6C" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                {/* Grid de Fundo */}
                                <line 
                                    x1={svgChartContent.paddingLeft} 
                                    y1={svgChartContent.paddingTop} 
                                    x2={svgChartContent.width - svgChartContent.paddingRight} 
                                    y2={svgChartContent.paddingTop} 
                                    stroke="#E8ECF0" 
                                    strokeDasharray="4 4" 
                                />
                                <line 
                                    x1={svgChartContent.paddingLeft} 
                                    y1={svgChartContent.paddingTop + svgChartContent.chartHeight / 2} 
                                    x2={svgChartContent.width - svgChartContent.paddingRight} 
                                    y2={svgChartContent.paddingTop + svgChartContent.chartHeight / 2} 
                                    stroke="#E8ECF0" 
                                    strokeDasharray="4 4" 
                                />
                                <line 
                                    x1={svgChartContent.paddingLeft} 
                                    y1={svgChartContent.paddingTop + svgChartContent.chartHeight} 
                                    x2={svgChartContent.width - svgChartContent.paddingRight} 
                                    y2={svgChartContent.paddingTop + svgChartContent.chartHeight} 
                                    stroke="#E2E8F0" 
                                    strokeWidth="1.5" 
                                />

                                {/* Área Gradiente */}
                                {svgChartContent.areaPath && (
                                    <path d={svgChartContent.areaPath} fill="url(#areaGrad)" />
                                )}

                                {/* Linha da Curva */}
                                {svgChartContent.linePath && (
                                    <path 
                                        d={svgChartContent.linePath} 
                                        stroke="#C49A6C" 
                                        strokeWidth="3.5" 
                                        fill="none" 
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}

                                {/* Eixo Y Labels com Alinhamento à Direita (textAnchor="end") */}
                                <text 
                                    x={svgChartContent.paddingLeft - 12} 
                                    y={svgChartContent.paddingTop + 4} 
                                    textAnchor="end"
                                    className="text-[10px] font-bold text-slate-400 font-body"
                                >
                                    100%
                                </text>
                                <text 
                                    x={svgChartContent.paddingLeft - 12} 
                                    y={svgChartContent.paddingTop + svgChartContent.chartHeight / 2 + 4} 
                                    textAnchor="end"
                                    className="text-[10px] font-bold text-slate-400 font-body"
                                >
                                    50%
                                </text>
                                <text 
                                    x={svgChartContent.paddingLeft - 12} 
                                    y={svgChartContent.paddingTop + svgChartContent.chartHeight + 4} 
                                    textAnchor="end"
                                    className="text-[10px] font-bold text-slate-400 font-body"
                                >
                                    0%
                                </text>

                                {/* Nós (Pontos) e Rótulos no Eixo X */}
                                {svgChartContent.points.map((p, i) => {
                                    const isActive = p.key === selectedMonth;
                                    const isTopPoint = p.y < svgChartContent.paddingTop + 20;
                                    // Reduz o espaço vertical para aproximar o texto do nó
                                    const labelY = isTopPoint ? p.y + 16 : p.y - 11;

                                    return (
                                        <g 
                                            key={i} 
                                            className="group cursor-pointer"
                                            onClick={() => setSelectedMonth(p.key)}
                                        >
                                            {/* Circulo Maior invisivel para facilitar hover */}
                                            <circle 
                                                cx={p.x} 
                                                cy={p.y} 
                                                r="16" 
                                                fill="transparent" 
                                            />
                                            {/* Círculo do Nó com destaque para o mês ativo e escala em local fixo no hover */}
                                            <circle 
                                                cx={p.x} 
                                                cy={p.y} 
                                                r={isActive ? "7.5" : "5.5"} 
                                                fill={isActive ? "#C49A6C" : "#0A3D62"} 
                                                stroke={isActive ? "#0A3D62" : "#C49A6C"} 
                                                strokeWidth={isActive ? "3" : "2"} 
                                                className="transition-all duration-200 group-hover:scale-110"
                                                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                                            />
                                            
                                            {/* Rótulo de Porcentagem acima do nó */}
                                            <text 
                                                x={p.x} 
                                                y={labelY} 
                                                textAnchor="middle" 
                                                className="text-[11px] font-bold text-hotel-blue fill-current opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white"
                                            >
                                                {p.value}%
                                            </text>

                                            {/* Rótulo de Porcentagem estático simples */}
                                            <text 
                                                x={p.x} 
                                                y={labelY} 
                                                textAnchor="middle" 
                                                className={`text-[10px] font-extrabold fill-current group-hover:opacity-0 ${
                                                    isActive ? 'text-hotel-blue font-black' : 'text-slate-500'
                                                }`}
                                            >
                                                {p.value}%
                                            </text>

                                            {/* Rótulo do Mês no eixo X */}
                                            <text 
                                                x={p.x} 
                                                y={svgChartContent.paddingTop + svgChartContent.chartHeight + 20} 
                                                textAnchor="middle" 
                                                className={`text-[10px] fill-current transition-all duration-200 ${
                                                    isActive ? 'font-bold text-hotel-blue scale-105' : 'font-semibold text-slate-400'
                                                }`}
                                                style={{ transformOrigin: `${p.x}px ${svgChartContent.paddingTop + svgChartContent.chartHeight + 20}px` }}
                                            >
                                                {p.label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                </div>

                {/* GRID DE CARTÕES DE SETORES */}
                <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-bold text-slate-800 font-heading">Performance por Departamento</h2>
                        <p className="text-xs text-slate-400">Distribuição operacional do mês selecionado. Caso necessário, lance novos resultados abaixo.</p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {sectors.map((dept) => {
                            const config = getSectorStyle(dept);
                            const IconComponent = config.icon;
                            const record = currentMonthMap[dept];
                            const pct = record ? record.porcentagem : null;
                            const spreadsheetLink = (record && record.linkPlanilha) ? record.linkPlanilha : DEFAULT_INDICADORES_SPREADSHEET_URL;

                            const classification = pct !== null ? getClassification(pct) : null;

                            return (
                                <div
                                    key={dept}
                                    className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-150 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-hotel-blue/20 hover:shadow-md"
                                >
                                    {/* Barra Decorativa Superior */}
                                    <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${config.color}`} />

                                    <div className="space-y-4">
                                        {/* Topo do Card */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`rounded-xl ${config.bg} p-2.5 flex-shrink-0 transition-transform duration-300 group-hover:scale-105`}>
                                                    <IconComponent size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-heading text-sm font-extrabold text-slate-800 group-hover:text-hotel-blue transition-colors">
                                                        {dept}
                                                    </h3>
                                                    <p className="text-[10px] text-slate-400 font-semibold font-body">
                                                        {record ? `Por: ${record.atualizadoPor}` : 'Aguardando lançamento'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Circulo Medidor de Progresso */}
                                            {pct !== null ? (
                                                <div className="relative flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-16 h-16 transform -rotate-90">
                                                        <circle cx="32" cy="32" r="26" stroke="#E8ECF0" strokeWidth="5" fill="transparent" />
                                                        <circle 
                                                            cx="32" 
                                                            cy="32" 
                                                            r="26" 
                                                            stroke={classification.hex} 
                                                            strokeWidth="5" 
                                                            fill="transparent" 
                                                            strokeDasharray={2 * Math.PI * 26}
                                                            strokeDashoffset={2 * Math.PI * 26 - (pct / 100) * (2 * Math.PI * 26)}
                                                            className="transition-all duration-500 ease-out"
                                                        />
                                                    </svg>
                                                    <span className="absolute text-xs font-bold text-hotel-blue">
                                                        {pct}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-350 text-[10px] font-bold">
                                                    —
                                                </div>
                                            )}
                                        </div>

                                        {/* Status do Mês */}
                                        {classification ? (
                                            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold border ${classification.colorClass}`}>
                                                <classification.icon size={11} className="flex-shrink-0" />
                                                Classificação: {classification.label}
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold bg-slate-50 border border-slate-150 text-slate-400">
                                                <Target size={11} className="flex-shrink-0" />
                                                Pendente de Lançamento
                                            </div>
                                        )}
                                    </div>

                                    {/* Ações Inferiores */}
                                    <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between">
                                        <a
                                            href={spreadsheetLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-hotel-blue hover:text-hotel-gold transition-colors"
                                        >
                                            <ExternalLink size={12} /> Ver Planilha Completa
                                        </a>

                                        {canEditSector(dept) && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(dept)}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-hotel-gold hover:text-hotel-gold-dk transition-colors border border-transparent hover:border-hotel-gold/30 rounded-lg px-2 py-1 bg-hotel-gold/5"
                                            >
                                                <Edit3 size={11} /> {pct !== null ? 'Editar' : 'Lançar'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MODAL DE LANÇAMENTO / EDICÃO */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-hotel-gold/10 p-2 text-hotel-gold">
                                    <Target size={20} />
                                </div>
                                <div>
                                    <h3 className="font-heading text-base font-bold text-slate-800">
                                        Lançar Metas - {modalData.departamento}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Indicador de metas para o período de {modalData.mes}.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-5">
                            {/* Controle Deslizante (Slider) Interativo de Meta */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                        Meta Geral Alcançada *
                                    </label>
                                    <span className={`text-sm font-extrabold px-2.5 py-0.5 rounded-lg border ${getClassification(modalData.porcentagem).colorClass}`}>
                                        {modalData.porcentagem}% ({getClassification(modalData.porcentagem).label})
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={modalData.porcentagem}
                                        onChange={(e) => setModalData(prev => ({ ...prev, porcentagem: Number(e.target.value) }))}
                                        className="flex-1 accent-hotel-blue cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
                                        required
                                    />
                                    <input 
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={modalData.porcentagem}
                                        onChange={(e) => setModalData(prev => ({ ...prev, porcentagem: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                                        className="w-16 rounded-xl border border-slate-200 bg-white p-2 text-xs font-extrabold text-center text-hotel-blue focus:border-hotel-blue outline-none"
                                    />
                                </div>
                            </div>

                            {/* Link da Planilha Detalhada */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Link da Tabela de Metas/KPIs (Spreadsheet URL)
                                </label>
                                <input
                                    type="url"
                                    placeholder="Ex: https://docs.google.com/spreadsheets/d/..."
                                    value={modalData.linkPlanilha}
                                    onChange={(e) => setModalData(prev => ({ ...prev, linkPlanilha: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm"
                                />
                                <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-1">
                                    <Info size={10} /> Link fixo da planilha dos indicadores pré-preenchido.
                                </p>
                            </div>

                            {/* Rodapé do Formulário */}
                            <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-100">
                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 rounded-xl bg-hotel-blue py-2.5 text-xs font-bold text-white transition-all hover:bg-hotel-blue-md disabled:opacity-60 shadow-sm"
                                    >
                                        {saving ? 'Gravando...' : 'Salvar Resultado'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                                {currentMonthMap[modalData.departamento] && (
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={handleDeleteClick}
                                        className="w-full rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-600 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Trash2 size={14} /> Excluir Lançamento Existente
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmDelete}
                title="Excluir Lançamento"
                message={`Tem certeza de que deseja excluir permanentemente o lançamento de meta para o setor ${modalData.departamento} no período de ${modalData.mes}?`}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setShowConfirmDelete(false)}
                danger={true}
            />
        </AppLayout>
    );
}
