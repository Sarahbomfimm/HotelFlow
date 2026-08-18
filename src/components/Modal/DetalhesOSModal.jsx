import { useState, useEffect } from 'react';
import {
    X, Eye, ListTodo, Clock3, Tag, User, Calendar, Image as ImageIcon, Download,
    Play, Check, FileCheck, Plus, Edit3, Trash2, Trash, CheckSquare, Square,
    MessageSquare, RefreshCw, GitBranch, Paperclip, AlertTriangle, ChevronRight, Activity, CalendarDays
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOS, matchesOrderActor } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import {
    StatusOS, PDCAStep, StatusLabel, PDCALabel, ApprovalStage
} from '../../models/OrdemDeServico';
import { isSIOverdue, getLeaderEstimatedDeadlineValue } from '../../utils/osDeadlineRules';
import { UserRole } from '../../models/User';
import { hasPermission, PERMISSIONS } from '../../services/permissions';

import StatusBadge from '../Badge/StatusBadge';
import PDCABadge from '../Badge/PDCABadge';
import EditarOSModal from './EditarOSModal';
import ConfirmModal from './ConfirmModal';
import StatusObservacaoModal from './StatusObservacaoModal';
import AdicionarObservacaoModal from './AdicionarObservacaoModal';
import EditarAnexoHistoricoModal from './EditarAnexoHistoricoModal';

export default function DetalhesOSModal({ osId, os: osProp, isOpen, onClose }) {
    const {
        ordens,
        solicitarFinalizacao,
        atualizarStatus,
        adicionarObservacao,
        atualizarChecklist,
        editarAnexoHistorico,
        excluirOS,
    } = useOS();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { currentUserProfile, availableDepartments } = useUsers();

    const actor = currentUserProfile || user;
    const actorDepartments = actor?.departamentos || [];
    const isDiretora = actor?.role === UserRole.DIRETORA || actor?.role === UserRole.ADMIN;
    const canFinalizeSI = hasPermission(actor, PERMISSIONS.SI_FINALIZE);
    const canMoveApprovals = hasPermission(actor, PERMISSIONS.SI_APPROVALS_MOVE);

    const [modalActiveTab, setModalActiveTab] = useState('detalhes');
    const [novoItemChecklist, setNovoItemChecklist] = useState('');
    const [editingChecklist, setEditingChecklist] = useState({ osId: null, itemId: null, text: '' });

    // Submodals
    const [toEdit, setToEdit] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const [obsModal, setObsModal] = useState({ open: false, novoStatus: null });
    const [adicionarObsModal, setAdicionarObsModal] = useState(false);
    const [editarAnexoModalState, setEditarAnexoModalState] = useState({ open: false, item: null });

    const activeOsId = osId || osProp?.id;
    const os = ordens.find((o) => o.id === activeOsId) || osProp;

    useEffect(() => {
        if (isOpen) {
            setModalActiveTab('detalhes');
            setNovoItemChecklist('');
            setEditingChecklist({ osId: null, itemId: null, text: '' });
        }
    }, [isOpen, activeOsId]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && !toEdit && !toDelete && !obsModal.open && !adicionarObsModal && !editarAnexoModalState.open) {
                onClose?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, toEdit, toDelete, obsModal.open, adicionarObsModal, editarAnexoModalState.open]);

    if (!isOpen || !os) return null;

    const atrasada = isSIOverdue(os);
    const prazoEstimadoCard = getLeaderEstimatedDeadlineValue(os);
    const isResponsavel = matchesOrderActor(os, actor, 'responsavel');
    const isCriador = matchesOrderActor(os, actor, 'criado_por');
    const isLider = actor?.role === UserRole.LIDER;
    const isInDept = actorDepartments && actorDepartments.includes(os.departamento);
    const isLiderOfDept = isLider && isInDept;

    const isActStage = os.etapa_pdca === PDCAStep.ACT;
    const canReopen = (os.status === StatusOS.CONCLUIDO || (isActStage && os.status !== StatusOS.EM_ANDAMENTO)) && (isDiretora || isCriador || isResponsavel);

    const canStart = os.status === StatusOS.ABERTO && (isResponsavel || isCriador || isLiderOfDept || isDiretora);
    const canConcludeDirectly = os.status === StatusOS.EM_ANDAMENTO && (
        isCriador || isDiretora || (isResponsavel && canFinalizeSI && canMoveApprovals)
    );
    const hasPendingApproval = [ApprovalStage.SOLICITADA, ApprovalStage.EM_ANALISE].includes(os.aprovacao_finalizacao_status);
    const canRequestFinalization = os.status === StatusOS.EM_ANDAMENTO && isResponsavel && !canConcludeDirectly && !hasPendingApproval;
    const podeAtualizar = !canReopen && (canStart || canConcludeDirectly);
    const podeEditar = isDiretora || isCriador;
    const podeExcluir = isDiretora || isCriador;
    const podeEditarChecklist = isDiretora || isCriador || isResponsavel || isLiderOfDept;

    const nextStatus = {
        [StatusOS.ABERTO]: StatusOS.EM_ANDAMENTO,
        [StatusOS.EM_ANDAMENTO]: StatusOS.CONCLUIDO,
    };

    const historico = os.historico || [];

    const solicitarStatusChange = (statusAlvo) => {
        setObsModal({ open: true, novoStatus: statusAlvo });
    };

    const confirmarStatusChange = async (observacaoText, prazoEstimado) => {
        const { novoStatus } = obsModal;
        setObsModal({ open: false, novoStatus: null });

        try {
            await atualizarStatus(os.id, novoStatus, actor, observacaoText, prazoEstimado);
            addNotification(`Status da SI "${os.titulo}" atualizado com sucesso.`, 'success');
        } catch (error) {
            addNotification(error?.message || 'Não foi possível atualizar o status.', 'error');
        }
    };

    const handleAdicionarObs = async ({ observacao, fotoUrl, pdfUrl, pdfNome }) => {
        setAdicionarObsModal(false);
        try {
            await adicionarObservacao(os.id, observacao, actor, fotoUrl, pdfUrl, pdfNome);
            addNotification('Progresso registrado com sucesso.', 'success');
        } catch (error) {
            addNotification(error?.message || 'Não foi possível adicionar o progresso.', 'error');
        }
    };

    const handleToggleChecklistItem = async (itemId) => {
        try {
            const currentChecklist = os.checklist || [];
            const updated = currentChecklist.map((item) =>
                item.id === itemId ? { ...item, concluido: !item.concluido } : item
            );
            await atualizarChecklist(os.id, updated);
        } catch (error) {
            addNotification('Erro ao atualizar item do checklist.', 'error');
        }
    };

    const handleAdicionarItemChecklist = async () => {
        if (!novoItemChecklist.trim()) return;
        try {
            const currentChecklist = os.checklist || [];
            const newItem = {
                id: `check-${Date.now()}`,
                texto: novoItemChecklist.trim(),
                concluido: false,
            };
            await atualizarChecklist(os.id, [...currentChecklist, newItem]);
            setNovoItemChecklist('');
        } catch (error) {
            addNotification('Erro ao adicionar item ao checklist.', 'error');
        }
    };

    const handleSalvarEdicaoChecklist = async (itemId) => {
        if (!editingChecklist.text.trim()) return;
        try {
            const currentChecklist = os.checklist || [];
            const updated = currentChecklist.map((item) =>
                item.id === itemId ? { ...item, texto: editingChecklist.text.trim() } : item
            );
            await atualizarChecklist(os.id, updated);
            setEditingChecklist({ osId: null, itemId: null, text: '' });
        } catch (error) {
            addNotification('Erro ao editar item do checklist.', 'error');
        }
    };

    const handleRemoverItemChecklist = async (itemId) => {
        try {
            const currentChecklist = os.checklist || [];
            const updated = currentChecklist.filter((item) => item.id !== itemId);
            await atualizarChecklist(os.id, updated);
        } catch (error) {
            addNotification('Erro ao remover item do checklist.', 'error');
        }
    };

    const handleConfirmEditarAnexo = async ({ acao, texto, fotoUrl, pdfUrl, pdfNome }) => {
        const itemHistorico = editarAnexoModalState.item;
        setEditarAnexoModalState({ open: false, item: null });

        if (!itemHistorico) return;

        try {
            await editarAnexoHistorico(os.id, itemHistorico, acao, { texto, fotoUrl, pdfUrl, pdfNome }, actor);
            addNotification('Registro do histórico atualizado com sucesso.', 'success');
        } catch (error) {
            addNotification(error?.message || 'Erro ao editar anexo do histórico.', 'error');
        }
    };

    const confirmDelete = async () => {
        setToDelete(null);
        try {
            await excluirOS(os.id, actor);
            addNotification(`SI "${os.titulo}" excluída com sucesso.`, 'success');
            onClose?.();
        } catch (error) {
            addNotification(error?.message || 'Erro ao excluir SI.', 'error');
        }
    };

    const parseTimelineDescription = (descricaoStr, isEtapa, isStatus) => {
        let text = descricaoStr || '';
        const adjustments = [];
        const pattern = /\[AJUSTE_REGISTRO:([^\]]+)\]/g;
        let match;

        while ((match = pattern.exec(descricaoStr)) !== null) {
            const fullTag = match[0];
            const metaInfo = match[1];
            const metaIndex = match.index;
            const restOfText = descricaoStr.slice(metaIndex + fullTag.length);
            const nextTagIndex = restOfText.search(/\[AJUSTE_REGISTRO:/);
            const detailText = nextTagIndex !== -1 ? restOfText.slice(0, nextTagIndex).trim() : restOfText.trim();
            adjustments.push({ meta: metaInfo, detail: detailText });
        }

        const tagPos = text.indexOf('[AJUSTE_REGISTRO:');
        if (tagPos !== -1) {
            text = text.slice(0, tagPos).trim();
        }

        const contentElement = (
            <p className={`text-xs leading-relaxed whitespace-pre-line ${isEtapa ? 'text-amber-900 font-semibold' : isStatus ? 'text-hotel-blue font-semibold' : 'text-hotel-gray-dark font-body'}`}>
                {text}
            </p>
        );

        return { contentElement, adjustments };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="bg-hotel-blue text-white px-6 py-4 flex items-center justify-between rounded-t-3xl shadow-sm shrink-0">
                    <div className="min-w-0 flex-1">
                        <span className="text-[10px] bg-hotel-gold text-hotel-blue font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Detalhes da SI
                        </span>
                        <h3 className="font-extrabold text-base sm:text-lg mt-1 truncate tracking-wide">{os.titulo}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-all"
                        aria-label="Fechar detalhes"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-hotel-light p-1 rounded-xl w-fit border border-hotel-gray/30 mx-6 mt-4 shrink-0 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setModalActiveTab('detalhes')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            modalActiveTab === 'detalhes'
                                ? 'bg-hotel-blue text-white shadow-sm'
                                : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                        }`}
                    >
                        <Eye size={13} />
                        Detalhes
                    </button>
                    <button
                        type="button"
                        onClick={() => setModalActiveTab('checklist')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            modalActiveTab === 'checklist'
                                ? 'bg-hotel-blue text-white shadow-sm'
                                : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                        }`}
                    >
                        <ListTodo size={13} />
                        Checklist
                    </button>
                    <button
                        type="button"
                        onClick={() => setModalActiveTab('progresso')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            modalActiveTab === 'progresso'
                                ? 'bg-hotel-blue text-white shadow-sm'
                                : 'text-hotel-gray-md hover:text-hotel-blue bg-transparent hover:bg-white/50'
                        }`}
                    >
                        <Clock3 size={13} />
                        Progresso
                    </button>
                </div>

                {/* Tab Content (Scrollable) */}
                <div className="overflow-y-auto p-6 flex-1 min-h-0 space-y-4">
                    {modalActiveTab === 'detalhes' && (
                        <div className="space-y-4 animate-fadeIn">
                            {/* Descrição */}
                            <div>
                                <h5 className="text-xs font-bold text-hotel-blue uppercase tracking-wider mb-1 font-body">Descrição da SI</h5>
                                <p className="text-sm font-body text-gray-700 leading-relaxed whitespace-pre-line bg-hotel-light/30 border border-hotel-gray/20 rounded-xl p-3 select-text">
                                    {os.descricao || 'Nenhuma descrição fornecida.'}
                                </p>
                            </div>

                            {/* Imagem Anexada */}
                            {os.imagem && (
                                <div className="rounded-xl overflow-hidden border border-hotel-gray/30 shadow-sm bg-white">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-hotel-light border-b border-hotel-gray/20">
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

                            {/* Informações / Metadados */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-body">
                                {/* Card 1: Departamento */}
                                <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                        <Tag size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Departamento</span>
                                        <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">{os.departamento}</span>
                                    </div>
                                </div>

                                {/* Card 2: Responsável */}
                                <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3 sm:col-span-2 lg:col-span-1">
                                    <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Responsável</span>
                                        <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">{os.responsavel_nome}</span>
                                        {Array.isArray(os.co_responsaveis) && os.co_responsaveis.length > 0 && (
                                            <span className="block text-[10px] text-hotel-gray-md mt-0.5 truncate" title={os.co_responsaveis.map((c) => c.nome).join(', ')}>
                                                + {os.co_responsaveis.map((c) => c.nome).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Card 3: Criado por */}
                                <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Criado por</span>
                                        <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">{os.criado_por_nome}</span>
                                    </div>
                                </div>

                                {/* Card 4: Prazo Oficial */}
                                <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                    <div className={`p-2 rounded-xl shrink-0 ${atrasada ? 'bg-red-50 text-red-500' : 'bg-hotel-blue/5 text-hotel-gold'}`}>
                                        <Calendar size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Prazo Oficial</span>
                                        <span className={`block text-sm font-bold mt-0.5 ${atrasada ? 'text-red-500 font-extrabold' : 'text-hotel-blue'}`}>
                                            {format(parseISO(os.prazo), 'dd/MM/yyyy')}
                                        </span>
                                    </div>
                                </div>

                                {/* Card 5: Prazo do Líder */}
                                {prazoEstimadoCard && (
                                    <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                        <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                            <Clock3 size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Prazo do Líder</span>
                                            <span className="block text-sm font-bold text-hotel-gold mt-0.5">
                                                {format(parseISO(prazoEstimadoCard), 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Card 6: Criado em */}
                                <div className="bg-hotel-light/35 border border-hotel-gray/20 rounded-2xl p-3.5 flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-hotel-blue/5 text-hotel-gold shrink-0">
                                        <Clock3 size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[10px] font-bold text-hotel-gray-md uppercase tracking-wider">Criado em</span>
                                        <span className="block text-sm font-bold text-hotel-blue mt-0.5 truncate">
                                            {format(parseISO(os.criado_em), "dd/MM/yyyy 'às' HH:mm")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Status e Etapa PDCA */}
                            <div className="flex flex-wrap items-center gap-3 bg-hotel-light/20 border border-hotel-gray/25 rounded-2xl p-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">STATUS:</span>
                                    <StatusBadge status={os.status} />
                                </div>
                                <div className="flex items-center gap-2 border-l border-hotel-gray/30 pl-3">
                                    <span className="text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">Etapa:</span>
                                    <PDCABadge etapa={os.etapa_pdca} status={os.status} />
                                </div>
                                {atrasada && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 border border-red-200 ml-auto">
                                        ⚠ Atrasada
                                    </span>
                                )}
                            </div>

                            {/* Transições de Status e Ações */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {podeAtualizar && (
                                    <button
                                        type="button"
                                        onClick={() => solicitarStatusChange(nextStatus[os.status])}
                                        className="inline-flex items-center gap-1.5 bg-hotel-gold text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-hotel-gold/90 transition-all shadow-sm cursor-pointer"
                                    >
                                        {os.status === StatusOS.ABERTO ? <Play size={14} /> : <Check size={14} />}
                                        <span>{os.status === StatusOS.ABERTO ? 'Iniciar SI' : 'Concluir SI'}</span>
                                    </button>
                                )}
                                {canReopen && (
                                    <button
                                        type="button"
                                        onClick={() => solicitarStatusChange(StatusOS.EM_ANDAMENTO)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-hotel-blue bg-hotel-blue/5 text-hotel-blue font-bold text-xs px-4 py-2 hover:bg-hotel-blue hover:text-white transition-all shadow-sm cursor-pointer"
                                    >
                                        <Play size={14} />
                                        <span>Reativar SI</span>
                                    </button>
                                )}
                                {canRequestFinalization && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                await solicitarFinalizacao(os.id, actor);
                                                addNotification(`Solicitação de finalização enviada para a SI "${os.titulo}".`, 'info');
                                            } catch (error) {
                                                addNotification(error?.message || 'Não foi possível solicitar finalização.', 'error');
                                            }
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500 bg-amber-50/50 text-amber-700 font-extrabold text-xs px-4 py-2 hover:bg-amber-500 hover:text-white transition-all shadow-sm cursor-pointer"
                                    >
                                        <FileCheck size={14} />
                                        <span>Solicitar Finalização</span>
                                    </button>
                                )}
                                {os.status === StatusOS.EM_ANDAMENTO && (
                                    <button
                                        type="button"
                                        onClick={() => setAdicionarObsModal(true)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-hotel-blue/30 bg-hotel-blue/5 px-4 py-2 text-xs text-hotel-blue font-bold font-body transition-all hover:bg-hotel-blue hover:text-white shadow-sm cursor-pointer"
                                    >
                                        <Plus size={14} />
                                        <span>Registrar Progresso</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {modalActiveTab === 'checklist' && (
                        <div className="space-y-3 animate-fadeIn">
                            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">
                                <ListTodo size={14} /> Checklist de Etapas da SI
                            </p>
                            
                            <div className="space-y-2">
                                {(!os.checklist || os.checklist.length === 0) && !podeEditarChecklist && (
                                    <p className="text-sm text-hotel-gray-md font-body">Nenhum item cadastrado no checklist.</p>
                                )}

                                {os.checklist?.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-hotel-gray/30 bg-white p-2.5 shadow-sm transition-colors hover:border-hotel-blue/30">
                                        {editingChecklist.osId === os.id && editingChecklist.itemId === item.id ? (
                                            <div className="flex flex-1 items-center gap-2">
                                                <input
                                                    id={`edit-checklist-${item.id}`}
                                                    name={`edit-checklist-${item.id}`}
                                                    type="text"
                                                    value={editingChecklist.text}
                                                    onChange={(e) => setEditingChecklist({ ...editingChecklist, text: e.target.value })}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleSalvarEdicaoChecklist(item.id)}
                                                    className="input py-1 px-2 text-sm flex-1 bg-white"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleSalvarEdicaoChecklist(item.id)} className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors" title="Salvar">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => setEditingChecklist({ osId: null, itemId: null, text: '' })} className="p-1.5 text-hotel-gray-md hover:text-red-500 transition-colors" title="Cancelar">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => podeEditarChecklist && handleToggleChecklistItem(item.id)}
                                                    className={`flex flex-1 items-center gap-3 text-left ${item.concluido ? 'text-emerald-700' : 'text-hotel-blue'} ${!podeEditarChecklist ? 'cursor-default' : ''}`}
                                                >
                                                    {item.concluido ? <CheckSquare size={16} className="shrink-0 text-emerald-500" /> : <Square size={16} className="shrink-0 text-hotel-gray-md" />}
                                                    <span className={`text-sm font-semibold font-body ${item.concluido ? 'line-through opacity-70' : ''}`}>{item.texto}</span>
                                                </button>
                                                {podeEditarChecklist && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button onClick={() => setEditingChecklist({ osId: os.id, itemId: item.id, text: item.texto })} className="p-1.5 text-hotel-gray-md hover:text-hotel-blue transition-colors" title="Editar etapa">
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoverItemChecklist(item.id)}
                                                            className="p-1.5 text-hotel-gray-md hover:text-red-500 transition-colors"
                                                            title="Remover etapa"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}

                                {podeEditarChecklist && (
                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-hotel-gray/10">
                                        <input
                                            id={`add-checklist-${os.id}`}
                                            name={`add-checklist-${os.id}`}
                                            type="text"
                                            value={novoItemChecklist}
                                            onChange={(e) => setNovoItemChecklist(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdicionarItemChecklist())}
                                            placeholder="Adicionar nova etapa..."
                                            className="input py-1.5 text-sm flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAdicionarItemChecklist}
                                            className="rounded-xl bg-hotel-blue p-2 text-white hover:bg-hotel-blue/90 transition-colors"
                                            title="Adicionar etapa"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {modalActiveTab === 'progresso' && (
                        <div className="space-y-3 animate-fadeIn">
                            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-hotel-blue uppercase tracking-wider font-body">
                                <Clock3 size={14} /> Log de Alterações / Progresso
                            </p>
                            
                            <div className="space-y-3 pr-1">
                                {historico.length === 0 ? (
                                    <p className="text-sm text-hotel-gray-md">Nenhum progresso registrado.</p>
                                ) : (
                                    [...historico].reverse().map((h, index) => {
                                        const isEtapa = h.tipo === 'etapa' || h.descricao.includes('Etapa PDCA alterada') || h.descricao.includes('alteração de etapa');
                                        const isStatus = h.tipo === 'status' || h.descricao.includes('Status alterado');
                                        
                                        let cardClass = 'border-hotel-gray/30 bg-hotel-light/20';
                                        let iconClass = 'bg-hotel-blue/10 text-hotel-blue';
                                        let IconComponent = MessageSquare;
                                        
                                        if (isEtapa) {
                                            cardClass = 'border-amber-300 bg-amber-50/30 shadow-sm shadow-amber-50';
                                            iconClass = 'bg-amber-100 text-amber-600 border border-amber-200';
                                            IconComponent = RefreshCw;
                                        } else if (isStatus) {
                                            cardClass = 'border-hotel-blue/20 bg-hotel-blue/5 shadow-sm shadow-blue-50';
                                            iconClass = 'bg-hotel-blue/15 text-hotel-blue border border-hotel-blue/10';
                                            IconComponent = GitBranch;
                                        }

                                        const { contentElement, adjustments } = parseTimelineDescription(h.descricao, isEtapa, isStatus);

                                        return (
                                            <div key={`${h.data}-${index}`} className={`flex gap-3 rounded-2xl border px-4 py-4 transition-all ${cardClass}`}>
                                                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                                                    <IconComponent size={14} className={isEtapa ? "animate-spin-slow" : ""} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-hotel-blue flex flex-wrap items-center gap-1.5 font-heading">
                                                        <span>{h.usuario_nome}</span>
                                                        <span className="text-[11px] font-normal text-hotel-gray-md font-sans">
                                                            • {format(parseISO(h.data), "dd/MM/yyyy 'às' HH:mm")}
                                                        </span>
                                                        {h.prazo_estimado && (
                                                            <span className="text-[11px] font-normal text-hotel-gold font-sans">
                                                                · Prazo: {format(parseISO(h.prazo_estimado), 'dd/MM/yyyy')}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="mt-2">
                                                        {contentElement}
                                                    </div>
                                                    {h.anexo_pdf_url && (
                                                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-hotel-blue/10 px-2.5 py-1 text-[11px] font-semibold text-hotel-blue font-body">
                                                                <Paperclip size={11} /> PDF anexado
                                                            </span>
                                                            <a
                                                                href={h.anexo_pdf_url}
                                                                download={h.anexo_pdf_nome || 'anexo.pdf'}
                                                                className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-blue hover:text-hotel-gold mr-3 font-body"
                                                                target="_blank" rel="noreferrer"
                                                            >
                                                                <Download size={11} /> {h.anexo_pdf_nome || 'Abrir anexo'}
                                                            </a>
                                                            {(isDiretora || h.usuario_nome === actor?.nome) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditarAnexoModalState({ open: true, item: h });
                                                                    }}
                                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-gray-md hover:text-hotel-blue transition-colors border-l border-hotel-gray-md/30 pl-3 font-body cursor-pointer"
                                                                    title="Editar ou remover documento anexado"
                                                                >
                                                                    <Edit3 size={11} /> Editar anexo
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    {h.anexo_foto_url && (
                                                        <div className="mt-3">
                                                            <a
                                                                href={h.anexo_foto_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-block relative group rounded-xl overflow-hidden border border-hotel-gray/30 hover:border-hotel-gold transition-all"
                                                            >
                                                                <img
                                                                    src={h.anexo_foto_url}
                                                                    alt={h.anexo_foto_nome || 'Foto do progresso'}
                                                                    className="max-h-40 object-cover rounded-xl group-hover:scale-[1.03] transition-transform duration-200"
                                                                />
                                                                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                                                    Ver Foto Ampliada
                                                                </div>
                                                            </a>
                                                            {(isDiretora || h.usuario_nome === actor?.nome) && (
                                                                <div className="mt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditarAnexoModalState({ open: true, item: h });
                                                                        }}
                                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-hotel-gray-md hover:text-hotel-blue transition-colors font-body cursor-pointer"
                                                                        title="Editar ou remover foto anexada"
                                                                    >
                                                                        <Edit3 size={11} /> Editar foto
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {adjustments.length > 0 && (
                                                        <div className="mt-3 space-y-2 border-t border-dashed border-hotel-gray/30 pt-3">
                                                            {adjustments.map((adj, i) => (
                                                                <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/10 p-3 text-xs font-body text-slate-600 shadow-sm animate-fadeIn">
                                                                    <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                                                                        <AlertTriangle size={13} className="shrink-0" />
                                                                        <span>Ajuste de Registro</span>
                                                                        <span className="text-[10px] text-hotel-gray-md font-normal font-sans">({adj.meta})</span>
                                                                    </div>
                                                                    <p className="mt-1 text-hotel-gray-dark leading-relaxed">
                                                                        {adj.detail}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-hotel-gray/20 px-6 py-4 flex justify-between items-center rounded-b-3xl bg-hotel-light/20 shrink-0">
                    <div>
                        {podeEditar && (
                            <button
                                onClick={() => setToEdit(os)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-hotel-gray/30 bg-white text-hotel-blue font-bold text-xs px-4 py-2 hover:bg-hotel-light transition-all shadow-sm cursor-pointer"
                            >
                                <Edit3 size={14} />
                                <span>Editar</span>
                            </button>
                        )}
                    </div>
                    {podeExcluir && (
                        <button
                            type="button"
                            onClick={() => setToDelete(os)}
                            className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 p-2 hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-all shadow-sm cursor-pointer"
                            title="Excluir SI"
                            aria-label="Excluir SI"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Nested Submodals */}
            <EditarOSModal
                os={toEdit}
                onClose={() => setToEdit(null)}
            />

            <ConfirmModal
                isOpen={!!toDelete}
                title="Excluir Solicitação Interna"
                message={`Tem certeza que deseja excluir a SI "${toDelete?.titulo}"? Esta ação não pode ser desfeita.`}
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
                danger
            />

            <StatusObservacaoModal
                isOpen={obsModal.open}
                os={os}
                novoStatus={obsModal.novoStatus}
                onConfirm={confirmarStatusChange}
                onCancel={() => setObsModal({ open: false, novoStatus: null })}
            />

            <AdicionarObservacaoModal
                isOpen={adicionarObsModal}
                os={os}
                onConfirm={handleAdicionarObs}
                onCancel={() => setAdicionarObsModal(false)}
            />

            <EditarAnexoHistoricoModal
                isOpen={editarAnexoModalState.open}
                os={os}
                historicoItem={editarAnexoModalState.item}
                onCancel={() => setEditarAnexoModalState({ open: false, item: null })}
                onConfirm={handleConfirmEditarAnexo}
            />
        </div>
    );
}
