import { useEffect, useMemo, useState } from 'react';
import {
    FileText,
    Plus,
    Search,
    Trash2,
    X,
    ChevronRight,
    UploadCloud,
    Folder,
    ArrowLeft,
    Download,
    Info,
    Calendar,
    User,
    Sparkles,
    BookOpen,
    Eye,
    FolderOpen,
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import {
    subscribeCategories,
    subscribeDocuments,
    saveCategory,
    deleteCategory,
    saveDocument,
    deleteDocument,
} from '../../services/documentacoesStorage';
import { uploadDocumentoFile } from '../../services/storage';

export default function Documentacoes() {
    const { user } = useAuth();
    const { currentUserProfile } = useUsers();
    const { addNotification } = useNotification();

    const profile = currentUserProfile || user;

    const canDeleteCategory = (cat) => {
        if (!profile || !profile.id) return false;
        if (profile.role === 'admin') return true;
        return cat.criadoPorId === profile.id;
    };

    const canDeleteDocument = (docRec) => {
        if (!profile || !profile.id) return false;
        if (profile.role === 'admin') return true;
        if (docRec.criadoPorId === profile.id) return true;
        const parentCat = categories.find((c) => c.id === docRec.categoryId);
        if (parentCat && parentCat.criadoPorId === profile.id) return true;
        return false;
    };

    const [categories, setCategories] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals states
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form states
    const [catForm, setCatForm] = useState({ titulo: '', descricao: '' });
    const [docForm, setDocForm] = useState({ titulo: '', descricao: '', file: null });

    // Confirm deletes
    const [deleteCatId, setDeleteCatId] = useState(null);
    const [deleteDocId, setDeleteDocId] = useState(null);

    // Load data
    useEffect(() => {
        setLoading(true);
        const unsubCats = subscribeCategories(
            (data) => {
                setCategories(data);
            },
            (error) => {
                console.error('Erro ao buscar categorias:', error);
                addNotification('Não foi possível carregar as categorias de documentos.', 'error');
            }
        );

        const unsubDocs = subscribeDocuments(
            (data) => {
                setDocuments(data);
                setLoading(false);
            },
            (error) => {
                console.error('Erro ao buscar documentos:', error);
                addNotification('Não foi possível carregar os documentos.', 'error');
                setLoading(false);
            }
        );

        return () => {
            unsubCats();
            unsubDocs();
        };
    }, []);

    // Filter documents
    const filteredDocuments = useMemo(() => {
        if (!selectedCategory) return [];
        let list = documents.filter((d) => d.categoryId === selectedCategory.id);
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase().trim();
            list = list.filter(
                (d) =>
                    d.titulo.toLowerCase().includes(query) ||
                    d.descricao.toLowerCase().includes(query)
            );
        }
        return list;
    }, [documents, selectedCategory, searchTerm]);

    // Get count of documents per category
    const getDocCountForCategory = (catId) => {
        return documents.filter((d) => d.categoryId === catId).length;
    };

    // Get latest updated date for category
    const getCategoryLastUpdated = (catId) => {
        const catDocs = documents.filter((d) => d.categoryId === catId);
        if (catDocs.length === 0) return null;
        const sorted = [...catDocs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return sorted[0].createdAt;
    };

    // Category form submission
    const handleCreateCategory = async (e) => {
        e.preventDefault();
        if (!catForm.titulo.trim()) {
            addNotification('Por favor, informe o título da categoria.', 'error');
            return;
        }

        setSaving(true);
        try {
            const newCat = {
                titulo: catForm.titulo.trim(),
                descricao: catForm.descricao.trim(),
                criadoPorId: profile?.id || null,
                criadoPorNome: profile?.nome || 'Usuário',
                createdAt: new Date().toISOString(),
            };

            await saveCategory(newCat);
            addNotification('Categoria de documentação criada com sucesso!', 'success');
            setCatForm({ titulo: '', descricao: '' });
            setShowCategoryModal(false);
        } catch (error) {
            addNotification(`Erro ao criar categoria: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Delete category
    const handleDeleteCategoryConfirm = async () => {
        if (!deleteCatId) return;
        const cat = categories.find((c) => c.id === deleteCatId);
        if (!cat || !canDeleteCategory(cat)) {
            addNotification('Você não tem permissão para excluir esta categoria.', 'error');
            setDeleteCatId(null);
            return;
        }
        try {
            await deleteCategory(deleteCatId);
            addNotification('Categoria e seus documentos excluídos com sucesso!', 'success');
            if (selectedCategory && selectedCategory.id === deleteCatId) {
                setSelectedCategory(null);
            }
        } catch (error) {
            addNotification(`Erro ao excluir categoria: ${error.message}`, 'error');
        } finally {
            setDeleteCatId(null);
        }
    };

    // Document file selection
    const handleFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            addNotification('O arquivo deve ter no máximo 10MB.', 'error');
            return;
        }

        setDocForm((prev) => ({
            ...prev,
            file,
        }));
    };

    // Document submission
    const handleCreateDocument = async (e) => {
        e.preventDefault();
        if (!docForm.titulo.trim() || !docForm.file || !selectedCategory) {
            addNotification('Preencha o assunto/título e anexe o arquivo.', 'error');
            return;
        }

        setSaving(true);
        try {
            // Upload file to Cloudinary
            const uploadResult = await uploadDocumentoFile(docForm.file, selectedCategory.titulo);
            if (!uploadResult || !uploadResult.url) {
                throw new Error('Falha no upload do arquivo.');
            }

            const newDoc = {
                categoryId: selectedCategory.id,
                titulo: docForm.titulo.trim(),
                descricao: docForm.descricao.trim(),
                pdf: {
                    name: docForm.file.name,
                    data: uploadResult.url,
                },
                criadoPorId: profile?.id || null,
                criadoPorNome: profile?.nome || 'Usuário',
                createdAt: new Date().toISOString(),
            };

            await saveDocument(newDoc);
            addNotification('Documento anexado com sucesso!', 'success');
            setDocForm({ titulo: '', descricao: '', file: null });
            setShowDocModal(false);
        } catch (error) {
            addNotification(`Erro ao anexar documento: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Delete document
    const handleDeleteDocumentConfirm = async () => {
        if (!deleteDocId) return;
        const docRec = documents.find((d) => d.id === deleteDocId);
        if (!docRec || !canDeleteDocument(docRec)) {
            addNotification('Você não tem permissão para excluir este documento.', 'error');
            setDeleteDocId(null);
            return;
        }
        try {
            await deleteDocument(deleteDocId);
            addNotification('Documento excluído com sucesso!', 'success');
        } catch (error) {
            addNotification(`Erro ao excluir documento: ${error.message}`, 'error');
        } finally {
            setDeleteDocId(null);
        }
    };

    return (
        <AppLayout pageTitle="Documentações Flow">
            <div className="mx-auto max-w-7xl animate-fadeIn space-y-6">
                {/* Header Premium */}
                <div
                    className="relative overflow-hidden rounded-[28px] text-white shadow-[0_20px_50px_rgba(10,61,98,0.15)] border border-white/10"
                    style={{ background: 'linear-gradient(135deg, #091e3a 0%, #1e3c72 50%, #2a5298 100%)' }}
                >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.03]" />
                    <div className="pointer-events-none absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-hotel-gold/10" />

                    <div className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                                <Sparkles size={12} className="text-hotel-gold animate-pulse" /> HotelFlow Documents
                            </div>
                            <h1 className="font-heading text-3xl font-extrabold tracking-tight lg:text-4xl">
                                Central de Documentações
                            </h1>
                            <p className="max-w-2xl text-sm leading-relaxed text-white/70 font-body">
                                Anexe arquivos, manuais e contratos. Organize documentos importantes por categorias customizadas para o seu time.
                            </p>
                        </div>
                    </div>
                </div>

                {!selectedCategory ? (
                    // VIEW 1: Categorias de Documentos
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-800 font-heading">Categorias Disponíveis</h2>
                                <p className="text-xs text-slate-400 font-body">Clique em uma categoria para abrir e ver os documentos anexados.</p>
                            </div>
                            <button
                                onClick={() => setShowCategoryModal(true)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-hotel-blue px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-hotel-blue/90 shadow-sm cursor-pointer"
                            >
                                <Plus size={14} /> Criar Categoria
                            </button>
                        </div>

                        {loading ? (
                            <div className="py-12 flex justify-center items-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hotel-blue" />
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="rounded-[24px] border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                                <FolderOpen className="mx-auto h-12 w-12 text-slate-300" />
                                <h3 className="mt-4 text-sm font-bold text-slate-700 font-heading">Nenhuma categoria criada</h3>
                                <p className="mt-1.5 text-xs text-slate-400 font-body max-w-sm mx-auto">
                                    Crie pastas para organizar seus contratos, manuais e regulamentos clicando em "Criar Categoria".
                                </p>
                                <button
                                    onClick={() => setShowCategoryModal(true)}
                                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-hotel-blue px-4 py-2 text-xs font-bold text-hotel-blue hover:bg-hotel-blue hover:text-white transition-all shadow-sm"
                                >
                                    <Plus size={14} /> Começar Agora
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {categories.map((cat) => {
                                    const docCount = getDocCountForCategory(cat.id);
                                    const lastUpdated = getCategoryLastUpdated(cat.id);

                                    return (
                                        <div
                                            key={cat.id}
                                            onClick={() => {
                                                setSelectedCategory(cat);
                                                setSearchTerm('');
                                            }}
                                            className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-150 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-hotel-blue/20 hover:shadow-md cursor-pointer"
                                        >
                                            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
                                            
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="rounded-xl bg-blue-50 text-blue-600 p-2.5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                                                        <Folder size={22} />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-colors duration-300 ${
                                                            docCount > 0 
                                                                ? 'bg-hotel-blue/5 text-hotel-blue' 
                                                                : 'bg-slate-50 text-slate-400'
                                                        }`}>
                                                            {docCount} {docCount === 1 ? 'Arquivo' : 'Arquivos'}
                                                        </span>
                                                        {canDeleteCategory(cat) && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeleteCatId(cat.id);
                                                                }}
                                                                className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                                title="Excluir Categoria"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="font-heading text-base font-extrabold text-slate-800 group-hover:text-hotel-blue transition-colors duration-200 truncate">
                                                        {cat.titulo}
                                                    </h3>
                                                    <p className="mt-1.5 text-xs text-slate-400 leading-relaxed font-body line-clamp-2 min-h-[32px]">
                                                        {cat.descricao || 'Sem descrição cadastrada.'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                                                <span>
                                                    {lastUpdated 
                                                        ? `Atualizado em ${new Date(lastUpdated).toLocaleDateString('pt-BR')}`
                                                        : 'Nenhum arquivo anexado'
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
                        )}
                    </div>
                ) : (
                    // VIEW 2: Lista de Documentos da Categoria Selecionada
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className="h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center bg-white shadow-sm"
                                    title="Voltar para categorias"
                                >
                                    <ArrowLeft size={16} className="text-slate-600" />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Folder size={18} className="text-hotel-blue" />
                                        <h2 className="text-lg font-extrabold text-slate-800 font-heading truncate max-w-sm sm:max-w-md">
                                            {selectedCategory.titulo}
                                        </h2>
                                    </div>
                                    <p className="text-xs text-slate-400 font-body truncate max-w-sm sm:max-w-md mt-0.5">
                                        {selectedCategory.descricao || 'Diretório de documentos.'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Pesquisar documento..."
                                        className="input pl-9 pr-4 py-2 text-xs font-semibold"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => setShowDocModal(true)}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-hotel-blue px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-hotel-blue/90 shadow-sm cursor-pointer"
                                >
                                    <Plus size={14} /> Anexar Documento
                                </button>
                            </div>
                        </div>

                        {filteredDocuments.length === 0 ? (
                            <div className="rounded-[24px] border border-slate-150 bg-white p-12 text-center shadow-sm">
                                <FileText className="mx-auto h-12 w-12 text-slate-300" />
                                <h3 className="mt-4 text-sm font-bold text-slate-700 font-heading">Nenhum documento encontrado</h3>
                                <p className="mt-1.5 text-xs text-slate-400 font-body max-w-sm mx-auto">
                                    Ainda não há arquivos nesta categoria. Clique no botão "Anexar Documento" para publicar o primeiro.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {filteredDocuments.map((docRec) => (
                                    <div
                                        key={docRec.id}
                                        className="rounded-2xl border border-slate-150 bg-white p-4 shadow-sm hover:shadow-md transition-all flex items-start justify-between gap-4"
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="rounded-xl bg-indigo-50 text-indigo-600 p-2.5 flex-shrink-0">
                                                <FileText size={20} />
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="font-heading font-extrabold text-sm text-slate-800 truncate" title={docRec.titulo}>
                                                    {docRec.titulo}
                                                </h4>
                                                {docRec.descricao && (
                                                    <p className="text-xs text-slate-500 font-body line-clamp-2 leading-relaxed">
                                                        {docRec.descricao}
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-400 font-semibold pt-1">
                                                    <span className="flex items-center gap-1">
                                                        <User size={12} /> {docRec.criadoPorNome}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} /> {new Date(docRec.createdAt).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                                {docRec.pdf?.name && (
                                                    <p className="text-[10px] font-mono text-indigo-600 truncate mt-1">
                                                        {docRec.pdf.name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {docRec.pdf?.data && (
                                                <>
                                                    <a
                                                        href={docRec.pdf.data}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-hotel-blue transition-colors border border-slate-100 bg-white"
                                                        title="Visualizar"
                                                    >
                                                        <Eye size={14} />
                                                    </a>
                                                    <a
                                                        href={docRec.pdf.data}
                                                        download={docRec.pdf.name || 'documento'}
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-hotel-blue transition-colors border border-slate-100 bg-white"
                                                        title="Baixar"
                                                    >
                                                        <Download size={14} />
                                                    </a>
                                                </>
                                            )}
                                            {canDeleteDocument(docRec) && (
                                                <button
                                                    onClick={() => setDeleteDocId(docRec.id)}
                                                    className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors border border-slate-100 bg-white"
                                                    title="Excluir Documento"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL: CRIAR CATEGORIA */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4 overflow-hidden animate-fadeIn">
                        <div className="bg-hotel-blue px-6 py-4 flex items-center justify-between">
                            <h3 className="font-heading font-semibold text-white flex items-center gap-2">
                                <Folder size={18} className="text-hotel-gold" /> Criar Nova Categoria
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCategoryModal(false);
                                    setCatForm({ titulo: '', descricao: '' });
                                }}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCategory}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="label mb-1" htmlFor="cat-titulo">Título da Categoria</label>
                                    <input
                                        type="text"
                                        id="cat-titulo"
                                        className="input"
                                        placeholder="Ex: Contratos de Fornecedores, Manuais"
                                        value={catForm.titulo}
                                        onChange={(e) => setCatForm((prev) => ({ ...prev, titulo: e.target.value }))}
                                        required
                                        maxLength={80}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1" htmlFor="cat-desc">Descrição / Objetivo</label>
                                    <textarea
                                        id="cat-desc"
                                        className="input resize-none"
                                        rows={3}
                                        placeholder="Descreva o que será anexado nesta aba para guiar os outros usuários..."
                                        value={catForm.descricao}
                                        onChange={(e) => setCatForm((prev) => ({ ...prev, descricao: e.target.value }))}
                                        maxLength={200}
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCategoryModal(false);
                                        setCatForm({ titulo: '', descricao: '' });
                                    }}
                                    className="btn-secondary text-xs"
                                    disabled={saving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary text-xs flex items-center gap-1.5"
                                    disabled={saving}
                                >
                                    {saving ? 'Criando...' : 'Criar Categoria'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ANEXAR DOCUMENTO */}
            {showDocModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4 overflow-hidden animate-fadeIn">
                        <div className="bg-hotel-blue px-6 py-4 flex items-center justify-between">
                            <h3 className="font-heading font-semibold text-white flex items-center gap-2">
                                <FileText size={18} className="text-hotel-gold" /> Anexar Novo Documento
                            </h3>
                            <button
                                onClick={() => {
                                    setShowDocModal(false);
                                    setDocForm({ titulo: '', descricao: '', file: null });
                                }}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateDocument}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="label mb-1" htmlFor="doc-titulo">Assunto / Nome do Documento</label>
                                    <input
                                        type="text"
                                        id="doc-titulo"
                                        className="input"
                                        placeholder="Ex: Contrato Elevador Jan/2026"
                                        value={docForm.titulo}
                                        onChange={(e) => setDocForm((prev) => ({ ...prev, titulo: e.target.value }))}
                                        required
                                        maxLength={80}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1" htmlFor="doc-desc">Observações / Contexto (opcional)</label>
                                    <textarea
                                        id="doc-desc"
                                        className="input resize-none"
                                        rows={2.5}
                                        placeholder="Vigência, contatos ou informações complementares..."
                                        value={docForm.descricao}
                                        onChange={(e) => setDocForm((prev) => ({ ...prev, descricao: e.target.value }))}
                                        maxLength={250}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1">Selecionar Arquivo</label>
                                    <label
                                        htmlFor="doc-file-input"
                                        className="mt-1 block rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-hotel-blue/40 px-4 py-6 transition-all text-center cursor-pointer"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <UploadCloud size={28} className="text-slate-400 group-hover:text-hotel-blue" />
                                            <span className="text-xs font-bold text-slate-600 block">
                                                {docForm.file ? 'Arquivo selecionado' : 'Clique para anexar arquivo'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-normal">
                                                {docForm.file ? docForm.file.name : 'PDF, Imagens, Documentos até 10MB'}
                                            </span>
                                        </div>
                                    </label>
                                    <input
                                        type="file"
                                        id="doc-file-input"
                                        className="sr-only"
                                        onChange={handleFileChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDocModal(false);
                                        setDocForm({ titulo: '', descricao: '', file: null });
                                    }}
                                    className="btn-secondary text-xs"
                                    disabled={saving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary text-xs flex items-center gap-1.5"
                                    disabled={saving || !docForm.file}
                                >
                                    {saving ? 'Publicando...' : 'Anexar Arquivo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRM MODAL: DELETE CATEGORY */}
            {deleteCatId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm mx-4 overflow-hidden animate-fadeIn p-6">
                        <h3 className="font-heading font-extrabold text-slate-800 text-base">Confirmar Exclusão</h3>
                        <p className="mt-2 text-xs text-slate-500 leading-relaxed font-body">
                            Tem certeza que deseja excluir esta categoria? **Todos os documentos anexados dentro dela serão excluídos permanentemente**. Esta ação não pode ser desfeita.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteCatId(null)}
                                className="btn-secondary text-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteCategoryConfirm}
                                className="inline-flex items-center justify-center rounded-xl bg-red-600 text-white font-bold text-xs px-4 py-2 hover:bg-red-700 transition-all shadow-sm cursor-pointer"
                            >
                                Sim, Excluir Tudo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM MODAL: DELETE DOCUMENT */}
            {deleteDocId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm mx-4 overflow-hidden animate-fadeIn p-6">
                        <h3 className="font-heading font-extrabold text-slate-800 text-base">Confirmar Exclusão</h3>
                        <p className="mt-2 text-xs text-slate-500 leading-relaxed font-body">
                            Deseja realmente excluir este documento anexado? Ele será deletado permanentemente.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteDocId(null)}
                                className="btn-secondary text-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteDocumentConfirm}
                                className="inline-flex items-center justify-center rounded-xl bg-red-600 text-white font-bold text-xs px-4 py-2 hover:bg-red-700 transition-all shadow-sm cursor-pointer"
                            >
                                Excluir Documento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
