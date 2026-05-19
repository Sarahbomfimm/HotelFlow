import {
    useEffect, useMemo, useRef, useState,
} from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const INITIAL_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    content: 'Olá. Sou a IA.Flow e estou aqui para te ajudar no HotelFlow. Você pode escolher uma pergunta rápida ou escrever sua dúvida que eu te explico em passos claros.',
};

const QUICK_QUESTIONS = [
    'Como criar uma SI?',
    'Como funciona o PDCA Visual?',
    'Como registrar progresso em uma SI?',
    'Como funcionam as reuniões?',
    'Como ativar o Telegram?',
    'Quem consegue acessar o painel admin?',
];

const MAX_MESSAGES = 14;

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function keywordMatches(normalizedQuestion, keyword) {
    const normalizedKeyword = normalizeText(keyword);
    const tokens = normalizedKeyword.split(' ').filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every((token) => normalizedQuestion.includes(token));
}

function getRoleLabel(role) {
    if (role === 'admin') return 'admin';
    if (role === 'diretora') return 'diretoria';
    return 'lider';
}

function buildAnswer(question, role) {
    const normalizedQuestion = normalizeText(question);
    const roleLabel = getRoleLabel(role);

    const answers = [
        {
            keywords: ['criar si', 'criar uma si', 'nova si', 'abrir si', 'solicitacao interna', 'solicitacao', 'os'],
            response: 'Como criar uma SI:\n1. Acesse Nova SI pelo dashboard.\n2. Preencha título, descrição, departamento e prazo.\n3. Escolha o responsável do departamento.\n4. Se houver mais de um responsável, selecione um ou mais.\n5. Envie e acompanhe pela lista de SIs.',
        },
        {
            keywords: ['responsavel', 'lider', 'atribuir', 'departamento'],
            response: 'Como funciona a atribuição de responsável:\n1. O departamento define quem pode receber a SI.\n2. Se existir apenas um responsável, ele é usado automaticamente.\n3. Se existir mais de um, você escolhe no formulário.\n4. Admin, diretoria e líder com departamento vinculado podem aparecer nessa seleção.',
        },
        {
            keywords: ['pdca', 'pdca visual', 'planejar', 'executar', 'checar', 'agir'],
            response: 'Como usar o PDCA Visual:\n1. Abra a tela PDCA Visual.\n2. Veja as SIs separadas por Planejar, Executar, Checar e Agir.\n3. Abra o card para entender o contexto da demanda.\n4. Use a evolução por etapa para acompanhar o avanço operacional.',
        },
        {
            keywords: ['progresso', 'observacao', 'registrar progresso', 'status'],
            response: 'Como registrar progresso em uma SI:\n1. Entre em Ordens e abra a SI desejada.\n2. Clique em Registrar progresso.\n3. Informe a observação da etapa atual do PDCA.\n4. Avance o status quando necessário.\n5. Consulte o histórico para ver as alterações.',
        },
        {
            keywords: ['reuniao', 'reunioes', 'participante', 'ata'],
            response: 'Como funcionam as reuniões:\n1. Acesse Reuniões e crie uma nova reunião.\n2. Defina data, pauta e participantes.\n3. Salve para notificar os participantes.\n4. Se houver Telegram configurado, os avisos também podem ir por lá.\n5. Use o histórico da reunião para rastrear mudanças.',
        },
        {
            keywords: ['historico', 'alteracao', 'antes', 'depois'],
            response: 'Como ler o histórico:\n1. Abra a SI ou reunião desejada.\n2. Vá na área de histórico.\n3. Veja apenas campos alterados.\n4. Cada item mostra antes e depois para facilitar auditoria.',
        },
        {
            keywords: ['telegram', 'bot', 'notificacao'],
            response: 'Como ativar Telegram:\n1. Acesse o dashboard.\n2. Abra o bloco/banner de conexão Telegram.\n3. Vincule seu chat ID.\n4. Após ativar, você pode receber alertas de SI e reuniões no Telegram.',
        },
        {
            keywords: ['dashboard', 'painel inicial', 'resumo'],
            response: `Como usar o dashboard (${roleLabel}):\n1. Veja os indicadores principais da operação.\n2. Use os atalhos para abrir SI ou navegar para listas.\n3. Clique nos blocos de PDCA para filtrar rapidamente as demandas.\n4. Confira o painel como visão diária da equipe.`,
        },
        {
            keywords: ['filtro', 'lista', 'ordens', 'buscar'],
            response: 'Como filtrar as ordens:\n1. Abra Ordens.\n2. Pesquise por texto livre no campo de busca.\n3. Combine filtros por status, etapa PDCA, responsável, departamento e prazo.\n4. Limpe filtros para voltar ao panorama geral.',
        },
        {
            keywords: ['admin', 'gerenciamento', 'painel administrativo', 'usuario', 'usuarios'],
            response: 'Painel administrativo:\n1. Acesso exclusivo para admin.\n2. Gerencie usuários, papéis e departamentos.\n3. Atualize dados de contato e Telegram.\n4. Faça ajustes de cadastro sincronizados com Firebase.',
        },
        {
            keywords: ['quem acessa', 'permissao', 'perfil', 'papel', 'acesso'],
            response: 'Perfis e permissões:\n1. Admin: acesso total e gerenciamento do sistema.\n2. Diretoria: visão gerencial completa e histórico.\n3. Líder: foco em SIs, PDCA Visual e reuniões da operação.',
        },
    ];

    let bestMatch = null;
    let bestScore = 0;

    answers.forEach((answer) => {
        const score = answer.keywords.reduce(
            (total, keyword) => total + (keywordMatches(normalizedQuestion, keyword) ? 1 : 0),
            0,
        );

        if (score > bestScore) {
            bestMatch = answer;
            bestScore = score;
        }
    });

    if (bestMatch) {
        return bestMatch.response;
    }

    if (/oi|ola|olá|bom dia|boa tarde|boa noite/.test(normalizedQuestion)) {
        return 'Oi. Posso te orientar sobre SI, PDCA Visual, reuniões, Telegram, filtros, histórico e painel administrativo. Se quiser, escolha uma pergunta rápida acima.';
    }

    return 'Ainda não encontrei uma resposta exata para isso, mas posso te ajudar melhor se você perguntar sobre criação de SI, responsáveis, PDCA Visual, progresso, reuniões, histórico, Telegram, dashboard, filtros ou painel administrativo.';
}

export default function GeminiFloatingButton() {
    const location = useLocation();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const panelRef = useRef(null);
    const messagesEndRef = useRef(null);

    if (!user || location.pathname === '/login') {
        return null;
    }

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!panelRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const suggestions = useMemo(() => QUICK_QUESTIONS, []);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const submitQuestion = (question) => {
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion) {
            return;
        }

        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmedQuestion,
        };

        const assistantMessage = {
            id: `assistant-${Date.now() + 1}`,
            role: 'assistant',
            content: buildAnswer(trimmedQuestion, user?.role),
        };

        setMessages((current) => {
            const next = [...current, userMessage, assistantMessage];
            if (next.length <= MAX_MESSAGES) {
                return next;
            }

            const trimmed = next.slice(-(MAX_MESSAGES - 1));
            return [INITIAL_MESSAGE, ...trimmed];
        });
        setDraft('');
        setIsOpen(true);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        submitQuestion(draft);
    };

    const closeChat = () => {
        setIsOpen(false);
        clearChat();
    };

    const clearChat = () => {
        setMessages([INITIAL_MESSAGE]);
        setDraft('');
    };

    return (
        <div ref={panelRef} className="fixed bottom-5 right-5 z-40">
            <style>
                {`@keyframes geminiFloat {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    50% { transform: translateY(-5px) scale(1.012); }
                }

                @keyframes geminiGlow {
                    0%, 100% { opacity: 0.45; transform: scale(0.96); }
                    50% { opacity: 0.78; transform: scale(1.06); }
                }

                @keyframes geminiSpark {
                    0%, 100% { opacity: 0.35; transform: scale(1) rotate(0deg); }
                    50% { opacity: 0.75; transform: scale(1.08) rotate(8deg); }
                }

                @keyframes geminiTooltipRise {
                    0% { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }`}
            </style>
            <div className="group relative">
                {!isOpen && (
                    <div
                        className="pointer-events-none absolute -top-[4.65rem] right-0 z-30 hidden w-56 rounded-2xl border border-white/40 bg-gradient-to-br from-hotel-blue via-hotel-blue to-[#164b9f] px-3.5 py-2.5 text-sm text-white shadow-[0_18px_44px_rgba(8,32,79,0.28)] group-hover:block"
                        style={{ animation: 'geminiTooltipRise 180ms ease-out forwards' }}
                    >
                        <div className="flex items-start gap-2">
                            <div className="mt-0.5 rounded-full bg-hotel-gold/20 p-1 text-hotel-gold">
                                <Sparkles size={13} />
                            </div>
                            <div>
                                <p className="font-heading text-sm font-bold tracking-[0.08em] text-hotel-gold drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]">IA.Flow ✨</p>
                                <p className="mt-1 font-body text-xs leading-5 text-white/85">
                                    Tire suas duvidas com a IA.Flow.
                                </p>
                            </div>
                        </div>
                        <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 rounded-[4px] bg-[#164b9f]" />
                    </div>
                )}

                {isOpen && (
                    <div
                        className="absolute bottom-[5.25rem] right-0 z-20 w-[calc(100vw-1.1rem)] max-w-[17.4rem] overflow-hidden rounded-[1.25rem] border border-white/50 bg-white/95 shadow-[0_18px_48px_rgba(8,32,79,0.22)] backdrop-blur-xl sm:w-[18.1rem] sm:max-w-none sm:rounded-[1.45rem]"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="bg-gradient-to-br from-hotel-blue via-hotel-blue to-[#174796] px-3 py-2.5 text-white">
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-heading text-sm font-semibold">IA.Flow</p>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        closeChat();
                                    }}
                                    className="rounded-lg border border-white/15 bg-white/10 p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                                    aria-label="Fechar assistente"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    clearChat();
                                }}
                                className="mt-1 text-[10px] font-medium text-white/60 underline-offset-2 transition-colors hover:text-white/85 hover:underline"
                            >
                                Limpar conversa
                            </button>
                        </div>

                        <div className="max-h-[17.2rem] space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(233,179,52,0.12),_transparent_28%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_100%)] px-2.5 py-2.5 sm:max-h-[18rem] sm:px-3 sm:py-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {suggestions.map((question) => (
                                    <button
                                        key={question}
                                        type="button"
                                        onClick={() => submitQuestion(question)}
                                        className="rounded-2xl border border-hotel-blue/12 bg-white px-3 py-2 text-left font-body text-xs font-medium text-hotel-blue shadow-sm transition-all hover:-translate-y-0.5 hover:border-hotel-blue/25 hover:shadow-md"
                                    >
                                        {question}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={message.role === 'assistant' ? 'flex justify-start' : 'flex justify-end'}
                                    >
                                        <div
                                            className={message.role === 'assistant'
                                                ? 'max-w-[85%] whitespace-pre-line rounded-[1.2rem] rounded-bl-md border border-hotel-blue/10 bg-white px-4 py-3 text-sm leading-6 text-hotel-blue shadow-sm'
                                                : 'max-w-[85%] whitespace-pre-line rounded-[1.2rem] rounded-br-md bg-gradient-to-br from-hotel-blue to-[#164b9f] px-4 py-3 text-sm leading-6 text-white shadow-[0_12px_28px_rgba(11,61,145,0.22)]'}
                                        >
                                            {message.content}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="border-t border-slate-200/80 bg-white px-2.5 py-2">
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 shadow-inner">
                                <input
                                    type="text"
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    placeholder="Pergunte sobre SI, PDCA, reuniões, Telegram..."
                                    className="h-10 flex-1 bg-transparent px-2 font-body text-sm text-hotel-blue outline-none placeholder:text-slate-400"
                                />
                                <button
                                    type="submit"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-hotel-blue text-white shadow-sm transition-colors hover:bg-hotel-blue/90"
                                    aria-label="Enviar pergunta"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                    </div>
                )}

            <div
                className="absolute inset-1 z-0 rounded-[1.7rem] bg-hotel-gold/20 blur-xl"
                style={{ animation: 'geminiGlow 3.2s ease-in-out infinite' }}
                aria-hidden="true"
            />
            <div
                className="absolute inset-0 z-0 rounded-[1.9rem] bg-gradient-to-br from-white/35 via-transparent to-hotel-gold/20 blur-[2px]"
                style={{ animation: 'geminiSpark 4.2s ease-in-out infinite' }}
                aria-hidden="true"
            />
            <button
                type="button"
                className="relative z-10 flex h-[4.7rem] w-[4.7rem] items-center justify-center rounded-[1.7rem] border border-white/30 bg-gradient-to-br from-[#0e3c84] via-hotel-blue to-[#1c60c2] p-1.5 shadow-[0_22px_58px_rgba(8,32,79,0.44),0_1px_10px_rgba(255,255,255,0.18)_inset] backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_24px_64px_rgba(8,32,79,0.52),0_1px_12px_rgba(255,255,255,0.2)_inset]"
                style={{ animation: 'geminiFloat 3.4s ease-in-out infinite' }}
                onClick={(event) => {
                    event.stopPropagation();
                    setIsOpen((current) => !current);
                }}
                aria-label="Abrir assistente IA.Flow"
            >
                <img
                    src="/gemini-svg.svg"
                    alt="Gemini"
                    className="h-full w-full scale-110 rounded-[1.2rem] bg-white/95 object-contain p-1.5 drop-shadow-[0_10px_18px_rgba(8,32,79,0.2)]"
                />
            </button>
            </div>
        </div>
    );
}