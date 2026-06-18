import { useEffect, useMemo, useState } from 'react';
import {
    BookOpen,
    Plus,
    Search,
    Trash2,
    X,
    Sparkles,
    Check,
    ChevronRight,
    FileText,
    UploadCloud,
    ConciergeBell,
    Wrench,
    Utensils,
    DollarSign,
    Home,
    ArrowLeft,
    Eye,
    Info,
    Lightbulb,
    User,
    Calendar,
    Users,
    Sliders,
    Award,
    Briefcase,
    Megaphone,
    Shirt,
    ShoppingCart,
    Key,
    AlertTriangle
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { subscribePops, savePop, deletePop } from '../../services/popsStorage';
import { uploadPopPdf } from '../../services/storage';

// Metadados temáticos para cada setor padrão
const SECTORS_METADATA = {
    'Recepção': {
        icon: ConciergeBell,
        color: 'from-blue-600 to-sky-500',
        bgIcon: 'bg-blue-50 text-blue-600',
        glowColor: 'group-hover:shadow-blue-500/20',
        description: 'Padrões de check-in, check-out, atendimento de hóspedes e telefonia.'
    },
    'Hospedagem': {
        icon: Key,
        color: 'from-sky-600 to-blue-400',
        bgIcon: 'bg-sky-50 text-sky-600',
        glowColor: 'group-hover:shadow-sky-500/20',
        description: 'Instruções de check-in, check-out, chaves de quartos e atendimento.'
    },
    'Governança': {
        icon: Home,
        color: 'from-amber-500 to-yellow-500',
        bgIcon: 'bg-amber-50 text-amber-600',
        glowColor: 'group-hover:shadow-amber-500/20',
        description: 'Normas de arrumação, limpeza de quartos, enxovais e vistorias.'
    },
    'Manutenção': {
        icon: Wrench,
        color: 'from-rose-500 to-orange-400',
        bgIcon: 'bg-rose-50 text-rose-600',
        glowColor: 'group-hover:shadow-rose-500/20',
        description: 'Checklists de reparos elétricos, hidráulicos, ar-condicionado e piscinas.'
    },
    'Restaurante': {
        icon: Utensils,
        color: 'from-emerald-600 to-teal-500',
        bgIcon: 'bg-emerald-50 text-emerald-600',
        glowColor: 'group-hover:shadow-emerald-500/20',
        description: 'Higiene alimentar, mise en place, recepção de clientes e serviço de bar.'
    },
    'A&B': {
        icon: Utensils,
        color: 'from-teal-600 to-emerald-500',
        bgIcon: 'bg-teal-50 text-teal-600',
        glowColor: 'group-hover:shadow-teal-500/20',
        description: 'Procedimentos de buffet, preparo de alimentos, bebidas e cozinha.'
    },
    'Financeiro': {
        icon: DollarSign,
        color: 'from-purple-600 to-indigo-500',
        bgIcon: 'bg-purple-50 text-purple-600',
        glowColor: 'group-hover:shadow-purple-500/20',
        description: 'Fluxo de compras, sangria de caixa, lançamentos e reembolsos.'
    },
    'RH': {
        icon: Users,
        color: 'from-pink-600 to-rose-400',
        bgIcon: 'bg-pink-50 text-pink-600',
        glowColor: 'group-hover:shadow-pink-500/20',
        description: 'Integração de novos funcionários, fardamento e políticas internas.'
    },
    'Compras e Suprimentos': {
        icon: ShoppingCart,
        color: 'from-cyan-600 to-teal-400',
        bgIcon: 'bg-cyan-50 text-cyan-600',
        glowColor: 'group-hover:shadow-cyan-500/20',
        description: 'Cotações de fornecedores, recebimento de mercadorias e insumos.'
    },
    'Controle': {
        icon: Sliders,
        color: 'from-violet-600 to-fuchsia-500',
        bgIcon: 'bg-violet-50 text-violet-600',
        glowColor: 'group-hover:shadow-violet-500/20',
        description: 'Fluxos de auditoria, controle de processos internos e metas.'
    },
    'Qualidade': {
        icon: Award,
        color: 'from-yellow-600 to-amber-500',
        bgIcon: 'bg-yellow-50 text-yellow-600',
        glowColor: 'group-hover:shadow-yellow-500/20',
        description: 'Padrões de auditorias de qualidade, NPS e excelência de serviços.'
    },
    'Comercial': {
        icon: Briefcase,
        color: 'from-indigo-600 to-blue-500',
        bgIcon: 'bg-indigo-50 text-indigo-600',
        glowColor: 'group-hover:shadow-indigo-500/20',
        description: 'Prospecção de contas corporativas, eventos, vendas e reservas.'
    },
    'Marketing': {
        icon: Megaphone,
        color: 'from-orange-600 to-red-500',
        bgIcon: 'bg-orange-50 text-orange-600',
        glowColor: 'group-hover:shadow-orange-500/20',
        description: 'Campanhas de reservas, redes sociais, comunicação visual e branding.'
    },
    'Lavanderia': {
        icon: Shirt,
        color: 'from-sky-500 to-cyan-400',
        bgIcon: 'bg-sky-50 text-sky-600',
        glowColor: 'group-hover:shadow-sky-500/20',
        description: 'Lavagem de enxovais, lavagem de uniformes e tratamento de manchas.'
    },
    'TI': {
        icon: Sliders,
        color: 'from-blue-600 to-indigo-500',
        bgIcon: 'bg-blue-50 text-blue-600',
        glowColor: 'group-hover:shadow-blue-500/20',
        description: 'Padrões de rede, sistemas, suporte técnico e segurança digital.'
    },
    'Eventos': {
        icon: Calendar,
        color: 'from-fuchsia-600 to-pink-500',
        bgIcon: 'bg-fuchsia-50 text-fuchsia-600',
        glowColor: 'group-hover:shadow-fuchsia-500/20',
        description: 'Procedimentos de montagem, coffee break, recepção e som em eventos.'
    },
    'Diretoria': {
        icon: Award,
        color: 'from-amber-600 to-yellow-500',
        bgIcon: 'bg-amber-50 text-amber-600',
        glowColor: 'group-hover:shadow-amber-500/20',
        description: 'Diretrizes gerais corporativas, planejamento estratégico e governança.'
    }
};

const DEFAULT_METADATA = {
    icon: BookOpen,
    color: 'from-slate-600 to-slate-400',
    bgIcon: 'bg-slate-50 text-slate-600',
    glowColor: 'group-hover:shadow-slate-500/20',
    description: 'Diretrizes gerais e procedimentos operacionais padronizados.'
};

// Função auxiliar para normalizar nomes de departamentos em comparações
const cleanStringForMatching = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/&/g, 'e')               // substitui & por e
        .replace(/[^a-z0-9]/g, '');       // remove qualquer outro caractere especial
};

// Busca metadados de forma case/accent/space-insensitive e substring match
const getSectorMetadata = (deptName) => {
    if (!deptName) return DEFAULT_METADATA;
    
    // 1. Busca direta exata
    if (SECTORS_METADATA[deptName]) return SECTORS_METADATA[deptName];
    
    // 2. Normalização completa
    const target = cleanStringForMatching(deptName);
    const matchedKey = Object.keys(SECTORS_METADATA).find(
        (key) => cleanStringForMatching(key) === target
    );
    if (matchedKey) return SECTORS_METADATA[matchedKey];
    
    // 3. Busca parcial/substring
    const matchedSub = Object.keys(SECTORS_METADATA).find((key) => {
        const cleanKey = cleanStringForMatching(key);
        return cleanKey.includes(target) || target.includes(cleanKey);
    });
    if (matchedSub) return SECTORS_METADATA[matchedSub];
    
    return DEFAULT_METADATA;
};

// Dicas educacionais de POP
const POP_TIPS = [
    {
        title: "Por que usar um POP?",
        content: "Garante que o serviço seja feito sempre com o mesmo padrão de excelência, independente do funcionário de folga."
    },
    {
        title: "Dica de escrita: Clareza",
        content: "Use frases curtas, imperativas e ordene em passos lógicos. Evite termos ambíguos."
    },
    {
        title: "Conexão entre setores",
        content: "Conhecer o POP do outro setor diminui atritos de comunicação e facilita a resolução de pendências."
    },
    {
        title: "Revisão Periódica",
        content: "Os POPs devem ser revisados anualmente para acompanhar mudanças operacionais ou novos equipamentos."
    }
];

export default function Pops() {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { availableDepartments, currentUserProfile } = useUsers();
    const profile = currentUserProfile || user;

    // Filtrar setores indesejados (BI e Teste)
    const filteredAvailableDepartments = useMemo(() => {
        return availableDepartments.filter(dept => {
            const nameLower = dept.toLowerCase().trim();
            return nameLower !== 'bi' && nameLower !== 'teste';
        });
    }, [availableDepartments]);

    // Estados locais
    const [allPops, setAllPops] = useState([]);
    const [selectedSector, setSelectedSector] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activePdfUrl, setActivePdfUrl] = useState(null);
    const [activePdfName, setActivePdfName] = useState('');
    const [tipIndex, setTipIndex] = useState(0);
    const [popToDelete, setPopToDelete] = useState(null);

    // Estado do formulário de upload
    const [showUploader, setShowUploader] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        titulo: '',
        descricao: '',
        pdf: null,
        pdfFile: null
    });
    const [dragOver, setDragOver] = useState(false);

    // Subscrever banco de dados em tempo real
    useEffect(() => {
        const unsubscribe = subscribePops(
            (data) => setAllPops(data),
            () => addNotification('Erro ao sincronizar POPs. Carregando dados offline.', 'warning')
        );
        return () => unsubscribe?.();
    }, [addNotification]);

    // Rotação automática de dicas de POP
    useEffect(() => {
        const timer = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % POP_TIPS.length);
        }, 15000);
        return () => clearInterval(timer);
    }, []);

    // Estatísticas e agrupamento por setor
    const sectorStats = useMemo(() => {
        const stats = {};
        allPops.forEach((p) => {
            const dept = p.departamento || 'Outros';
            if (!stats[dept]) {
                stats[dept] = { count: 0, lastUpdated: p.createdAt, popsList: [] };
            }
            stats[dept].count += 1;
            stats[dept].popsList.push(p);
            if (new Date(p.createdAt) > new Date(stats[dept].lastUpdated)) {
                stats[dept].lastUpdated = p.createdAt;
            }
        });
        return stats;
    }, [allPops]);

    // Helper para obter estatísticas do setor de forma case/accent-insensitive
    const getSectorStatsValue = (deptName) => {
        if (!deptName) return { count: 0, lastUpdated: null, popsList: [] };
        const targetClean = cleanStringForMatching(deptName);
        const matchedKey = Object.keys(sectorStats).find(
            (key) => cleanStringForMatching(key) === targetClean
        );
        return matchedKey ? sectorStats[matchedKey] : { count: 0, lastUpdated: null, popsList: [] };
    };

    // POPs filtrados por busca no setor selecionado
    const filteredSectorPops = useMemo(() => {
        if (!selectedSector) return [];
        const pops = getSectorStatsValue(selectedSector).popsList || [];
        return pops
            .filter((p) => {
                const query = searchTerm.toLowerCase();
                return (
                    p.titulo.toLowerCase().includes(query) ||
                    p.descricao.toLowerCase().includes(query) ||
                    p.criadoPorNome.toLowerCase().includes(query)
                );
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [selectedSector, sectorStats, searchTerm]);

    // Lidar com arquivo anexado
    const handleFileChange = (file) => {
        if (!file) return;
        if (file.type !== 'application/pdf') {
            addNotification('Por favor, anexe apenas arquivos no formato PDF.', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            addNotification('O arquivo PDF deve ter no máximo 10MB.', 'error');
            return;
        }

        setFormData((prev) => ({
            ...prev,
            pdfFile: file,
            pdf: {
                name: file.name,
                data: null
            }
        }));
    };

    // Submissão do novo POP
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.titulo || !formData.pdfFile || !selectedSector) {
            addNotification('Preencha o título e anexe o arquivo PDF.', 'error');
            return;
        }

        setSaving(true);
        try {
            // Envia o PDF para o Cloudinary
            const uploadResult = await uploadPopPdf(formData.pdfFile, selectedSector);
            if (!uploadResult || !uploadResult.url) {
                throw new Error('Falha no upload do arquivo PDF para o servidor.');
            }

            const record = {
                titulo: formData.titulo.trim(),
                departamento: selectedSector,
                descricao: formData.descricao.trim(),
                pdf: {
                    name: formData.pdf.name,
                    data: uploadResult.url
                },
                criadoPorId: profile?.id || null,
                criadoPorNome: profile?.nome || 'Colaborador',
                createdAt: new Date().toISOString()
            };

            await savePop(record);
            addNotification('Procedimento Operacional Padrão publicado com sucesso!', 'success');
            
            // Reset do formulário
            setFormData({ titulo: '', descricao: '', pdf: null, pdfFile: null });
            setShowUploader(false);
        } catch (error) {
            addNotification(`Erro ao publicar POP: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Abrir confirmação de exclusão
    const handleConfirmDelete = (popId, event) => {
        event.stopPropagation();
        setPopToDelete(popId);
    };

    // Executar exclusão do POP
    const executeDeletePop = async () => {
        if (!popToDelete) return;
        try {
            await deletePop(popToDelete);
            addNotification('POP excluído com sucesso.', 'success');
        } catch (error) {
            addNotification(`Erro ao excluir POP: ${error.message}`, 'error');
        } finally {
            setPopToDelete(null);
        }
    };

    return (
        <AppLayout pageTitle="Procedimentos Operacionais (POPs)">
            <div className="mx-auto max-w-7xl animate-fadeIn space-y-6">
                
                {/* Header Premium com Estética Visual de Destaque */}
                <div 
                    className="relative overflow-hidden rounded-[28px] text-white shadow-[0_20px_50px_rgba(10,61,98,0.15)] border border-white/10"
                    style={{ background: 'linear-gradient(135deg, #062135 0%, #0A3D62 50%, #175e8f 100%)' }}
                >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.03]" />
                    <div className="pointer-events-none absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-hotel-gold/10" />
                    
                    <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_320px] lg:items-center">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                                <Sparkles size={12} className="text-hotel-gold animate-pulse" /> HotelFlow Academy
                            </div>
                            <h1 className="font-heading text-3xl font-extrabold tracking-tight lg:text-4xl">
                                Central de POPs
                            </h1>
                            <p className="max-w-2xl text-sm leading-relaxed text-white/70 font-body">
                                Procedimento Operacional Padrão. Aqui você consulta as rotinas e regras de trabalho de cada setor do hotel. 
                                Compartilhe o conhecimento e promova a excelência no atendimento.
                            </p>
                        </div>

                        {/* Bloco Educacional Rotativo */}
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300">
                            <div className="flex items-start gap-2.5">
                                <Lightbulb className="text-hotel-gold mt-0.5 flex-shrink-0 animate-bounce" size={18} />
                                <div className="space-y-1">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-hotel-gold">
                                        {POP_TIPS[tipIndex].title}
                                    </h4>
                                    <p className="text-[11px] leading-relaxed text-white/80 font-body">
                                        {POP_TIPS[tipIndex].content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {!selectedSector ? (
                    // VIEW 1: Diretório de Setores
                    <div className="space-y-6">
                        <div className="border-b border-slate-100 pb-2">
                            <h2 className="text-base font-bold text-slate-800 font-heading">Selecione o Departamento</h2>
                            <p className="text-xs text-slate-400">Clique no setor para visualizar e gerenciar os seus respectivos POPs.</p>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredAvailableDepartments.map((dept) => {
                                const metadata = getSectorMetadata(dept);
                                const IconComponent = metadata.icon;
                                const stats = getSectorStatsValue(dept);

                                return (
                                    <div
                                        key={dept}
                                        onClick={() => {
                                            setSelectedSector(dept);
                                            setSearchTerm('');
                                        }}
                                        className={`group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-150 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-hotel-blue/20 hover:shadow-md cursor-pointer`}
                                    >
                                        {/* Barra decorativa de gradiente */}
                                        <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${metadata.color}`} />
                                        
                                        <div className="space-y-4">
                                            {/* Topo do Card */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className={`rounded-xl ${metadata.bgIcon} p-2.5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                                                    <IconComponent size={22} />
                                                </div>
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-colors duration-300 ${
                                                    stats.count > 0 
                                                        ? 'bg-hotel-blue/5 text-hotel-blue' 
                                                        : 'bg-slate-50 text-slate-400'
                                                }`}>
                                                    {stats.count} {stats.count === 1 ? 'POP' : 'POPs'}
                                                </span>
                                            </div>

                                            {/* Texto Informativo */}
                                            <div>
                                                <h3 className="font-heading text-base font-extrabold text-slate-800 group-hover:text-hotel-blue transition-colors duration-200">
                                                    {dept}
                                                </h3>
                                                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed font-body">
                                                    {metadata.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Rodapé do Card do Setor */}
                                        <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                                            <span>
                                                {stats.lastUpdated 
                                                    ? `Atualizado em ${new Date(stats.lastUpdated).toLocaleDateString('pt-BR')}`
                                                    : 'Nenhum POP publicado'
                                                }
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-hotel-gold opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1">
                                                Acessar <ChevronRight size={12} />
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    // VIEW 2: Hub Interno do Setor Selecionado
                    <div className="space-y-6">
                        
                        {/* Header de Ação do Setor */}
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                            <button
                                type="button"
                                onClick={() => setSelectedSector(null)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-800"
                            >
                                <ArrowLeft size={14} /> Voltar para Setores
                            </button>

                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="relative min-w-[240px]">
                                    <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        placeholder="Pesquisar POP neste setor..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue w-full"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowUploader(true)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-hotel-gold px-6 py-2 text-xs font-bold text-white transition-all hover:bg-hotel-gold-lt active:scale-95 shadow-sm"
                                >
                                    <Plus size={14} /> Publicar POP
                                </button>
                            </div>
                        </div>

                        {/* Título e Subtítulo do Setor */}
                        <div className="space-y-1">
                            <h2 className="text-base font-bold text-slate-800 font-heading">
                                Procedimentos de {selectedSector}
                            </h2>
                            <p className="text-xs text-slate-400">Consulte abaixo as instruções operacionais oficiais deste departamento.</p>
                        </div>

                        {/* Layout de Conteúdo do Setor */}
                        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                            
                            {/* Lista de Documentos POP */}
                            <div className="space-y-4 lg:h-full">
                                {filteredSectorPops.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 py-12 px-6 text-center lg:h-full">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                            <FileText size={20} />
                                        </div>
                                        <h3 className="font-heading text-sm font-bold text-slate-700">Nenhum POP encontrado</h3>
                                        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mt-1">
                                            Não encontramos procedimentos operacionais cadastrados para este setor. Clique em "Publicar POP" para adicionar o primeiro.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                                        {filteredSectorPops.map((pop) => (
                                            <div
                                                key={pop.id}
                                                className="group relative flex flex-col justify-between rounded-2xl border border-slate-150 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="rounded-lg bg-red-50 text-red-500 p-2 flex-shrink-0">
                                                            <FileText size={18} />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleConfirmDelete(pop.id, e)}
                                                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                            title="Excluir POP permanentemente"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                    
                                                    <h3 className="mt-3 font-heading text-sm font-bold text-slate-800 group-hover:text-hotel-blue transition-colors">
                                                        {pop.titulo}
                                                    </h3>
                                                    <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                        {pop.descricao || 'Sem descrição detalhada.'}
                                                    </p>
                                                </div>

                                                <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                                                    <div className="min-w-0 flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold truncate">
                                                        <User size={10} className="text-hotel-gold flex-shrink-0" />
                                                        <span className="truncate">{pop.criadoPorNome}</span>
                                                    </div>
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActivePdfUrl(pop.pdf.data);
                                                            setActivePdfName(pop.pdf.name);
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-hotel-blue hover:text-hotel-gold transition-colors"
                                                    >
                                                        <Eye size={12} /> Ler POP
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Coluna Educacional Informativa */}
                            <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-sm space-y-4 h-fit">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <div className="rounded-lg bg-hotel-gold/10 p-1.5 text-hotel-gold">
                                        <Lightbulb size={16} />
                                    </div>
                                    <h3 className="font-heading text-xs font-extrabold uppercase tracking-wider text-slate-700">
                                        HotelFlow Checklist
                                    </h3>
                                </div>
                                <div className="space-y-3.5 text-xs text-slate-650 leading-relaxed font-body">
                                    <p>
                                        Os <strong>POPs (Procedimento Operacional Padrão)</strong> servem para guiar o trabalho em cada tarefa crítica.
                                    </p>
                                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-2">
                                        <div className="flex gap-2">
                                            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-hotel-blue text-[9px] font-bold text-white">1</span>
                                            <span className="text-[11px]">Seja descritivo e direto.</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-hotel-blue text-[9px] font-bold text-white">2</span>
                                            <span className="text-[11px]">Evite palavras difíceis.</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-hotel-blue text-[9px] font-bold text-white">3</span>
                                            <span className="text-[11px]">Sempre defina quem executa a tarefa.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* MODAL DE UPLOADER (FORMULÁRIO DE PUBLICAÇÃO) */}
            {showUploader && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-hotel-gold/10 p-2 text-hotel-gold">
                                    <UploadCloud size={20} />
                                </div>
                                <div>
                                    <h3 className="font-heading text-base font-bold text-slate-800">
                                        Publicar Novo POP em {selectedSector}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Preencha as informações do manual operacional.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowUploader(false);
                                    setFormData({ titulo: '', descricao: '', pdf: null, pdfFile: null });
                                }}
                                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Título do Procedimento *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Abertura de Quartos e Higiene Geral"
                                    value={formData.titulo}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Descrição Curta (Opcional)
                                </label>
                                <textarea
                                    placeholder="Descreva resumidamente o objetivo ou as etapas centrais deste POP..."
                                    value={formData.descricao}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-hotel-blue focus:ring-1 focus:ring-hotel-blue shadow-sm min-h-[80px] resize-none"
                                />
                            </div>

                            {/* Drag and Drop Zone */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                                    Documento PDF (Máx 10MB) *
                                </label>
                                
                                {formData.pdf ? (
                                    <div className="flex items-center justify-between rounded-xl border border-emerald-250 bg-emerald-50/40 p-3.5 text-xs font-semibold text-emerald-800">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                                            <span className="truncate max-w-[260px]" title={formData.pdf.name}>{formData.pdf.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, pdf: null, pdfFile: null }))}
                                            className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                                            title="Remover arquivo"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDragOver(true);
                                        }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setDragOver(false);
                                            const file = e.dataTransfer.files[0];
                                            handleFileChange(file);
                                        }}
                                        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
                                            dragOver 
                                                ? 'border-hotel-blue bg-hotel-blue/5 text-hotel-blue' 
                                                : 'border-slate-300 hover:border-hotel-gold bg-slate-50/50 text-slate-500'
                                        }`}
                                    >
                                        <UploadCloud size={30} className="mb-2 text-slate-400 group-hover:text-hotel-gold" />
                                        <span className="text-xs font-bold text-slate-700">Arraste seu PDF aqui ou</span>
                                        <label className="mt-1.5 rounded-lg bg-hotel-blue px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-hotel-blue-md cursor-pointer shadow-sm">
                                            Escolher arquivo
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                className="hidden"
                                                onChange={(e) => handleFileChange(e.target.files[0])}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={saving || !formData.pdf}
                                    className="flex-1 rounded-xl bg-hotel-blue py-2.5 text-xs font-bold text-white transition-all hover:bg-hotel-blue-md disabled:opacity-60 shadow-sm"
                                >
                                    {saving ? 'Publicando...' : 'Publicar Procedimento'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowUploader(false);
                                        setFormData({ titulo: '', descricao: '', pdf: null, pdfFile: null });
                                    }}
                                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE VISUALIZAÇÃO DO PDF EM TEMPO REAL */}
            {activePdfUrl && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-md animate-fadeIn">
                    <div className="relative w-full max-w-4xl h-[90vh] rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-hotel-blue/10 p-2 text-hotel-blue">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h3 className="font-heading text-sm font-bold text-slate-800 truncate max-w-md">
                                        {activePdfName}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-semibold">{selectedSector}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = activePdfUrl;
                                        link.download = activePdfName;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                    className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                    Download PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivePdfUrl(null);
                                        setActivePdfName('');
                                    }}
                                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Exibição Embutida do PDF */}
                        <div className="flex-1 w-full overflow-hidden rounded-2xl bg-slate-50 border border-slate-200">
                            <iframe
                                src={activePdfUrl}
                                className="w-full h-full rounded-2xl border-0"
                                title="Leitor de POP"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO PREMIUM */}
            {popToDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-scaleUp">
                        {/* Ícone de Alerta */}
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                            <AlertTriangle size={28} className="animate-pulse" />
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="font-heading text-base font-extrabold text-slate-800">
                                Confirmar Exclusão
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed font-body">
                                Tem certeza que deseja remover permanentemente este POP? Esta ação não poderá ser desfeita.
                            </p>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={executeDeletePop}
                                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-red-700 active:scale-95 shadow-sm shadow-red-600/15"
                            >
                                Excluir
                            </button>
                            <button
                                type="button"
                                onClick={() => setPopToDelete(null)}
                                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
