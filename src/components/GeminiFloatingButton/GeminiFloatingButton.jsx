import {
    useEffect, useMemo, useRef, useState,
} from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const INITIAL_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    content: 'Olá! Sou a **IA.Flow**, sua assistente inteligente no HotelFlow. 🏨✨\n\nEstou aqui para tirar suas dúvidas e ajudar você a dominar o sistema rapidamente. Como posso ajudar você hoje?',
};

const QUICK_QUESTIONS = [
    'Como criar uma SI? 📋',
    'Como funciona o PDCA Visual? 📊',
    'Como registrar progresso? 📝',
    'Prazo oficial vs estimado? 📅',
    'Como funcionam as reuniões? 🗓️',
    'Como conectar o Telegram? 🤖',
    'Quem acessa o painel admin? ⚙️',
    'Quem pode editar ou excluir? ✏️',
];

const MAX_MESSAGES = 14;

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function keywordMatches(normalizedQuestion, keyword) {
    const normalizedKeyword = normalizeText(keyword);
    const tokens = normalizedKeyword.split(' ').filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every((token) => normalizedQuestion.includes(token));
}

function getRoleLabel(role) {
    if (role === 'admin') return 'administrador';
    if (role === 'diretora') return 'diretoria';
    return 'líder de equipe';
}

function hasAnyToken(normalizedQuestion, tokens) {
    return tokens.some((token) => normalizedQuestion.includes(normalizeText(token)));
}

function getPathHint(pathname) {
    if (pathname === '/lista-os') return 'ordens';
    if (pathname === '/nova-os') return 'nova-si';
    if (pathname === '/pdca-visual') return 'pdca';
    if (pathname === '/reunioes') return 'reunioes';
    if (pathname === '/admin') return 'admin';
    return 'geral';
}

function buildAnswer(question, role, pathname) {
    const normalizedQuestion = normalizeText(question);
    const roleLabel = getRoleLabel(role);
    const pathHint = getPathHint(pathname);

    const intents = [
        {
            id: 'criar-si',
            keywords: ['criar si', 'criar uma si', 'nova si', 'abrir si', 'solicitacao interna', 'solicitacao', 'os', 'criar os', 'abrir os', 'nova ordem', 'criar ordem'],
            strong: ['como criar', 'abrir solicitacao', 'abrir si', 'criar si'],
            response: `✨ **Como abrir uma nova Solicitação Interna (SI):**

Para criar uma nova demanda e enviá-la para a equipe responsável, siga estes passos simples:

1. 📂 **Acesse a tela:** Clique em **"Nova SI"** no menu lateral ou use o botão de atalho rápido no seu Dashboard.
2. ✍️ **Preencha as informações:**
   * **Título:** Escreva um título curto que resuma o problema (ex: *Lâmpada queimada no quarto 204*).
   * **Descrição:** Explique os detalhes com clareza para ajudar quem vai executar.
3. 🏢 **Escolha o Departamento:** Selecione qual setor deve receber a solicitação (ex: Manutenção, Governança, TI).
4. 👤 **Selecione o Responsável:**
   * O sistema carregará os colaboradores do setor.
   * Você pode selecionar **um ou mais responsáveis** (co-responsáveis) para atuar juntos.
5. 📅 **Prazo Limite:** Defina a data limite desejada para que o serviço seja concluído.
6. 🚀 **Enviar:** Clique em **"Criar Solicitação"**. O setor de destino será notificado na hora! 🛎️`,
        },
        {
            id: 'responsavel',
            keywords: ['responsavel', 'lider', 'atribuir', 'departamento', 'atribuicao', 'co-responsavel', 'mais de um', 'vários responsáveis', 'quem recebe', 'atribuir responsavel'],
            strong: ['quem pode receber', 'como escolher responsavel', 'atribuicao', 'co-responsaveis'],
            response: `👥 **Atribuição de Responsáveis e Co-responsáveis:**

No HotelFlow, o gerenciamento de quem resolve cada demanda é muito flexível:

* **Atribuição Automática:** Se o departamento selecionado tiver apenas um responsável cadastrado, ele será definido automaticamente pelo sistema.
* **Múltiplos Responsáveis (Co-responsáveis):** Se houver mais de um líder ou colaborador cadastrado no setor, você poderá selecionar **um ou mais colaboradores** para trabalharem juntos na mesma SI.
* **Quem aparece na lista?** Admin, Diretoria e qualquer Líder que tenha aquele departamento vinculado ao seu cadastro no painel de Gerenciamento.`,
        },
        {
            id: 'pdca',
            keywords: ['pdca', 'pdca visual', 'planejar', 'executar', 'checar', 'agir', 'quadro pdca', 'kanban', 'etapas pdca', 'o que e pdca'],
            strong: ['etapas pdca', 'quadro pdca', 'painel pdca', 'o que é pdca'],
            response: `📊 **O Quadro PDCA Visual:**

O PDCA Visual organiza suas solicitações em uma esteira de processos baseada na metodologia PDCA. Isso facilita ver em qual etapa cada serviço está travado:

1. 📅 **P - Planejar (Plan):** SIs que foram criadas e estão aguardando o início das ações. Aqui definimos o que e como será feito.
2. 🛠️ **D - Executar (Do):** SIs em andamento. O responsável está executando a tarefa no momento.
3. 🔍 **C - Checar (Check):** A tarefa foi realizada e está em fase de validação/vistoria para garantir que ficou perfeita.
4. 🔄 **A - Agir (Act):** Fase de ajustes finais ou padronização antes da conclusão definitiva.

*💡 **Dica:** Você pode filtrar o quadro por setor ou período no topo da página para analisar o gargalo da operação!*`,
        },
        {
            id: 'progresso',
            keywords: ['progresso', 'observacao', 'registrar progresso', 'atualizar progresso', 'adicionar observacao', 'registrar andamento', 'como registrar'],
            strong: ['atualizar progresso', 'adicionar observacao', 'registrar andamento', 'registrar progresso'],
            response: `📝 **Como Registrar Progresso em uma SI:**

Manter as solicitações atualizadas ajuda toda a equipe a acompanhar o andamento. Para atualizar uma SI:

1. 📋 Acesse a tela de **"Minhas SI"** ou **"Todas as SI"**.
2. 🔍 Clique na linha da solicitação que deseja atualizar para abrir os detalhes dela.
3. 💬 Clique no botão **"Registrar Progresso"**.
4. ✍️ **Escreva a observação:** Relate o que foi feito até o momento (ex: *Peça encomendada, aguardando entrega*).
5. 🎯 **Selecione a etapa PDCA:** Se o status mudou, selecione a nova etapa (ex: mover de *Planejar* para *Executar*).
6. 📅 **Prazo Estimado (Opcional):** Se você tem uma previsão real de quando vai terminar, preencha esse campo para dar visibilidade ao solicitante.
7. Clique em **"Registrar"** e pronto! A timeline de atualizações da SI será atualizada imediatamente. 🚀`,
        },
        {
            id: 'prazo-estimado',
            keywords: ['prazo estimado', 'estimativa entrega', 'previsao entrega', 'estimativa si', 'prazo previsto', 'data estimada', 'quando entrega', 'previsao', 'prazo oficial', 'prazo limite', 'estimativa'],
            strong: ['prazo previsto', 'data estimada', 'quando entrega', 'prazo oficial vs estimado'],
            response: `📅 **Como funciona o Prazo Estimado de Entrega?**

Para dar mais transparência à operação, o HotelFlow possui dois prazos para a mesma SI:

1. 📋 **Prazo Limite (Oficial):** Definido por quem criou a SI (a data máxima ideal de atendimento).
2. ⏳ **Prazo Estimado:** Informado pelo **responsável da execução** ao registrar um progresso. É a previsão real de entrega baseada na rotina de trabalho (ex: se o prazo limite é hoje, mas a peça só chega amanhã, o executor estima para amanhã).

* O prazo estimado é **opcional** e pode ser atualizado em novos registros de progresso.
* Ele aparece destacado no card da SI e na timeline do histórico para evitar ruídos de comunicação! ✨`,
        },
        {
            id: 'reunioes',
            keywords: ['reuniao', 'reunioes', 'participante', 'ata', 'agenda', 'criar reuniao', 'pauta', 'ata de reuniao'],
            strong: ['como criar reuniao', 'agenda de reuniao', 'criar reuniao'],
            response: `📅 **Módulo de Reuniões e Atas:**

O módulo de Reuniões ajuda a agendar, gerenciar e documentar as pautas e decisões da equipe:

1. 🗓️ **Acessar Reuniões:** Clique em **"Reuniões"** no menu lateral.
2. ➕ **Criar Nova:** Clique no botão **"Nova Reunião"** no topo da tela.
3. ✍️ **Preencha os Detalhes:** Defina o título da reunião, a data/hora, o local (físico ou link) e a pauta detalhada.
4. 👥 **Selecionar Participantes:** Escolha quais colaboradores devem comparecer. Eles receberão uma notificação automática no sistema!
5. 🤖 **Notificação via Telegram:** Se os participantes tiverem o Telegram vinculado, receberão os alertas e lembretes diretamente pelo celular.
6. 📑 **Histórico e Ata:** Use o campo de histórico da reunião para registrar o que foi decidido (gerando a ata da reunião de forma simples).`,
        },
        {
            id: 'telegram',
            keywords: ['telegram', 'bot', 'notificacao', 'conectar telegram', 'chat id', 'alerta telegram', 'vincular telegram', 'notificacoes telegram', 'ativar telegram'],
            strong: ['conectar telegram', 'chat id', 'alerta telegram', 'como ativar o telegram'],
            response: `🤖 **Como Conectar e Receber Notificações no Telegram:**

Você pode receber alertas de novas SIs, atualizações e reuniões diretamente no seu celular via Telegram:

1. 📱 **Abra o Telegram:** Procure pelo bot do sistema ou use o link de integração no Dashboard.
2. 💬 **Inicie a conversa:** Envie a mensagem \`/start\` para o bot do HotelFlow. Ele responderá com o seu **Chat ID** (um código numérico).
3. ⚙️ **Vincule no sistema:**
   * Acesse o seu perfil ou o Dashboard.
   * Encontre o bloco **"Conectar Telegram"**.
   * Insira o seu **Chat ID** no campo indicado e salve.
4. ✅ Prontinho! A partir de agora, as notificações mais importantes serão enviadas diretamente no seu chat privado com o bot. 🔔`,
        },
        {
            id: 'dashboard',
            keywords: ['dashboard', 'painel inicial', 'resumo', 'indicadores', 'visao geral', 'tela inicial', 'painel'],
            strong: ['indicadores', 'visao geral', 'como usar o dashboard'],
            response: `🏡 **Como aproveitar ao máximo o seu Dashboard:**

O Dashboard é a sua central de controle diário no HotelFlow. Como você é **${roleLabel}**, veja o que está disponível para você:

* 📊 **Métricas Rápidas:** Veja a quantidade de SIs abertas, em andamento, concluídas e atrasadas do seu setor.
* ⚡ **Atalhos Rápidos:** Botões de um clique para abrir uma Nova SI, acessar o Kanban PDCA ou gerenciar reuniões.
* 🎯 **Acesso rápido ao PDCA:** Blocos clicáveis com as etapas do PDCA filtram a sua lista de ordens instantaneamente.
* 🔗 **Integração Telegram:** Um card direto para você consultar ou cadastrar seu Chat ID do Telegram e ativar alertas no celular.`,
        },
        {
            id: 'filtros',
            keywords: ['filtro', 'lista', 'ordens', 'buscar', 'filtrar si', 'buscar solicitacao', 'lista os', 'pesquisa', 'procurar'],
            strong: ['filtrar si', 'buscar solicitacao', 'lista os'],
            response: `🔍 **Como Filtrar e Buscar Solicitações (SIs):**

Na tela de **"Minhas SI"** ou **"Todas as SI"**, você pode encontrar qualquer demanda rapidamente usando os filtros avançados:

1. ✍️ **Busca por Texto:** Digite palavras-chave no campo de pesquisa para buscar pelo título ou descrição.
2. 🏢 **Filtro por Departamento:** Visualize apenas as solicitações de um setor específico.
3. 🎯 **Filtro por Status / PDCA:** Filtre por *Aberto*, *Em Andamento*, *Concluído* ou pelas etapas do PDCA (*Planejar, Executar, Checar, Agir*).
4. 👤 **Filtro por Responsável:** Veja apenas as demandas atribuídas a você ou a outro colaborador.
5. 🧹 **Limpar Filtros:** Se quiser ver tudo de novo, clique em **"Limpar"** ao lado dos filtros.`,
        },
        {
            id: 'admin',
            keywords: ['admin', 'gerenciamento', 'painel administrativo', 'usuario', 'usuarios', 'cadastrar lider', 'criar usuario', 'gerenciar lideres'],
            strong: ['gerenciar usuarios', 'painel admin', 'cadastro de usuario'],
            response: `⚙️ **Painel de Gerenciamento (Exclusivo para Administradores):**

Se você tem perfil de Administrador, pode acessar a área de **"Gerenciamento"** para controlar o acesso do sistema:

* 👤 **Gerenciar Usuários:** Cadastre novos líderes, edite nomes, e-mails, setores e cargos.
* 🔑 **Controle de Permissões:** Defina exatamente o que cada líder pode fazer (acesso a reuniões, criar auditorias, aprovações, etc.) clicando em "Editar Permissões".
* 🏢 **Vincular Departamentos:** Associe quais setores cada líder gerencia para que eles recebam as SIs corretas.
* 🗑️ **Desativar Contas:** Remova ou inative usuários que não fazem mais parte da equipe.`,
        },
        {
            id: 'permissoes',
            keywords: ['quem acessa', 'permissao', 'perfil', 'papel', 'acesso', 'niveis de acesso', 'diretora', 'admin', 'lider'],
            strong: ['tipos de usuario', 'nivel de acesso'],
            response: `🔑 **Perfis de Usuário e Níveis de Acesso:**

O HotelFlow possui três perfis principais de acesso para garantir a segurança dos dados:

1. 🛠️ **Administrador (Admin):** Possui acesso total a todas as telas do sistema, relatórios, cadastros e painel de controle de usuários/permissões.
2. 📊 **Diretora:** Visão gerencial completa do hotel. Pode ver todas as SIs, reuniões, indicadores e auditorias, mas não acessa a edição de usuários.
3. 👤 **Líder (Operação):** Foco na execução. Vê as SIs do seu departamento, responde a auditorias e gerencia reuniões da sua equipe. Suas permissões específicas (como criar auditorias ou acessar o financeiro) são configuradas individualmente pelo Admin.`,
        },
        {
            id: 'editar-excluir',
            keywords: ['editar si', 'alterar si', 'excluir si', 'apagar si', 'remover si', 'cancelar si', 'modificar ordem', 'quem pode editar', 'quem pode excluir'],
            strong: ['quem pode editar', 'quem pode excluir'],
            response: `✏️ **Edição e Exclusão de Solicitações (SI):**

Para manter a rastreabilidade e evitar fraudes na operação, existem regras para alterar ou apagar uma SI:

* 📝 **Quem pode editar?**
  * O criador/solicitante da SI pode editar as informações básicas a qualquer momento.
  * Usuários com perfil de **Diretoria** e **Admin** também têm permissão total de edição.
* 🗑️ **Quem pode excluir?**
  * Apenas o **criador da SI** ou um **Administrador** pode deletar uma solicitação.
* 🔄 **Auditoria:** Qualquer alteração relevante de status, responsável ou prazo gera um registro automático na timeline da SI para fins de auditoria.`,
        },
        {
            id: 'status',
            keywords: ['status', 'aberto', 'em andamento', 'concluido', 'finalizar', 'fluxo de status', 'mudar status', 'etapas status'],
            strong: ['fluxo de status', 'mudar status'],
            response: `🔄 **Entendendo o Fluxo de Status de uma SI:**

Toda Solicitação Interna passa por um ciclo de vida simples e claro:

1. 🟡 **Aberto:** A SI foi criada e está aguardando o início do atendimento. Ela entra automaticamente na etapa de *Planejar (Plan)*.
2. 🔵 **Em Andamento:** O responsável assumiu a execução da tarefa. A SI é movida para a etapa de *Executar (Do)*.
3. 🟢 **Concluído:** O trabalho foi finalizado pelo responsável.

*⚠️ **Importante:** Mudanças de status mudam a etapa correspondente no PDCA e notificam o solicitante sobre a evolução do serviço.*`,
        },
        {
            id: 'exportacao',
            keywords: ['exportar', 'csv', 'baixar lista', 'relatorio', 'excel', 'planilha', 'baixar dados'],
            strong: ['exportar ordens', 'planilha de si'],
            response: `📊 **Como Exportar Relatórios de SIs para Excel/CSV:**

Se você precisa fazer análises externas ou apresentar relatórios, pode baixar os dados das solicitações facilmente:

1. 📋 Vá para a tela de **"Minhas SI"** ou **"Todas as SI"**.
2. 🔍 **Aplique os filtros desejados** (ex: filtrar por departamento ou apenas SIs concluídas no mês).
3. 📥 Clique no botão **"Exportar CSV"** ou **"Exportar Planilha"** no topo da tabela.
4. 💾 O arquivo será baixado contendo exatamente as colunas e registros filtrados na tela, pronto para abrir no Excel ou Google Planilhas!`,
        },
    ];

    let bestMatch = null;
    let bestScore = 0;

    intents.forEach((intent) => {
        const keywordScore = intent.keywords.reduce(
            (total, keyword) => total + (keywordMatches(normalizedQuestion, keyword) ? 2 : 0),
            0,
        );
        const strongScore = (intent.strong || []).reduce(
            (total, keyword) => total + (keywordMatches(normalizedQuestion, keyword) ? 3 : 0),
            0,
        );

        const questionTokens = normalizedQuestion.split(' ').filter(Boolean);
        const tokenOverlap = questionTokens.filter((token) =>
            intent.keywords.some((keyword) => normalizeText(keyword).includes(token)),
        ).length;

        const score = keywordScore + strongScore + Math.min(tokenOverlap, 3);

        if (score > bestScore) {
            bestMatch = intent;
            bestScore = score;
        }
    });

    if (bestMatch && bestScore >= 2) {
        return bestMatch.response;
    }

    if (/oi|ola|olá|bom dia|boa tarde|boa noite/.test(normalizedQuestion)) {
        return `Oi! 😊 Sou a **IA.Flow**. Como posso te ajudar hoje?

Você pode me perguntar sobre:
* 📋 Criação de solicitações (SI)
* 📊 Como funciona o quadro PDCA Visual
* 📝 Como registrar progresso ou prazos estimados
* 🤖 Conectar seu Telegram para receber alertas
* 🗓️ Gerenciamento de reuniões e atas

Se preferir, clique em uma das perguntas rápidas acima! ✨`;
    }

    if (pathHint === 'ordens') {
        return 'Posso te ajudar nesta tela de **Ordens**! Aqui você pode aplicar filtros avançados, alterar status das SIs, registrar progresso, definir prazo estimado e exportar relatórios. O que você gostaria de fazer?';
    }

    if (pathHint === 'nova-si') {
        return 'Você está na tela de **Nova SI**! Para registrar uma demanda, preencha o título, a descrição, escolha o departamento e selecione um ou mais líderes responsáveis. Quer ajuda para preencher algum campo específico?';
    }

    if (pathHint === 'pdca') {
        return 'Você está no painel do **PDCA Visual**! Aqui as SIs são organizadas entre *Planejar, Executar, Checar e Agir*. Isso ajuda você a auditar onde a operação está travada. Qual a sua dúvida sobre esse painel?';
    }

    if (hasAnyToken(normalizedQuestion, ['erro', 'bug', 'nao funciona', 'travou', 'falhou', 'problema'])) {
        return 'Poxa, sinto muito por isso! 😟 Vamos resolver juntos. Pode me dizer:\n1. Em qual tela você está?\n2. O que você tentou fazer?\n3. Apareceu alguma mensagem de erro?\n\nCom esses detalhes eu consigo te passar uma orientação precisa!';
    }

    return 'Entendi sua mensagem, mas não tenho certeza de como responder. 🧐\n\nPosso te ajudar com dúvidas sobre **criação de SIs, responsáveis, reuniões, Telegram, PDCA, filtros e exportações**. Tente reformular sua pergunta ou use as sugestões rápidas acima!';
}

export default function GeminiFloatingButton() {
    const location = useLocation();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [isTyping, setIsTyping] = useState(false);
    const panelRef = useRef(null);
    const messagesEndRef = useRef(null);

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
    }, [messages, isOpen, isTyping]);

    const submitQuestion = (question) => {
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion || isTyping) {
            return;
        }

        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmedQuestion,
        };

        setMessages((current) => {
            const next = [...current, userMessage];
            if (next.length <= MAX_MESSAGES) {
                return next;
            }

            const trimmed = next.slice(-(MAX_MESSAGES - 1));
            return [INITIAL_MESSAGE, ...trimmed];
        });
        setDraft('');
        setIsTyping(true);
        setIsOpen(true);

        setTimeout(() => {
            const assistantMessage = {
                id: `assistant-${Date.now() + 1}`,
                role: 'assistant',
                content: buildAnswer(trimmedQuestion, user?.role, location.pathname),
            };

            setMessages((current) => {
                const next = [...current, assistantMessage];
                if (next.length <= MAX_MESSAGES) {
                    return next;
                }

                const trimmed = next.slice(-(MAX_MESSAGES - 1));
                return [INITIAL_MESSAGE, ...trimmed];
            });
            setIsTyping(false);
        }, 850);
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
        setIsTyping(false);
    };

    const shouldRender = Boolean(user) && location.pathname !== '/login';

    if (!shouldRender) {
        return null;
    }

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
                }

                @keyframes bubbleAppear {
                    from { opacity: 0; transform: translateY(10px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                @keyframes typingPulse {
                    0%, 100% { transform: translateY(0); opacity: 0.3; }
                    50% { transform: translateY(-4px); opacity: 1; }
                }

                /* Custom scrollbar rules */
                .scrollbar-none::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-none {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-thin::-webkit-scrollbar {
                    width: 5px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 9999px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                `}
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
                                    Tire suas dúvidas com a IA.Flow.
                                </p>
                            </div>
                        </div>
                        <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 rounded-[4px] bg-[#164b9f]" />
                    </div>
                )}

                {isOpen && (
                    <div
                        className="absolute bottom-[5.25rem] right-0 z-20 w-[calc(100vw-1.2rem)] max-w-[21.5rem] sm:w-[22rem] h-[31.5rem] sm:h-[33.5rem] overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-[0_20px_50px_rgba(8,32,79,0.16)] flex flex-col transition-all duration-300"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-[#0e3c84] via-hotel-blue to-[#1951ab] px-4 py-3.5 text-white flex items-center justify-between shadow-[0_2px_12px_rgba(8,32,79,0.12)] z-10">
                            <div className="flex items-center gap-3">
                                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-hotel-gold border border-white/20">
                                    <Sparkles size={18} className="animate-pulse" />
                                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-hotel-blue bg-green-500 animate-ping" />
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-hotel-blue bg-green-500" />
                                </div>
                                <div>
                                    <p className="font-heading text-sm font-bold tracking-wide">IA.Flow</p>
                                    <p className="text-[10px] text-white/70 font-medium">Assistente de Suporte Online</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        clearChat();
                                    }}
                                    className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/10 transition-all border border-white/15"
                                    title="Limpar conversa"
                                >
                                    Limpar
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        closeChat();
                                    }}
                                    className="rounded-lg bg-white/10 p-1.5 text-white/85 transition-all hover:bg-white/20 hover:text-white"
                                    aria-label="Fechar assistente"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Conversational body */}
                        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] px-4 py-4 space-y-4 flex flex-col scrollbar-thin">
                            {/* Suggestions rendered as grid if conversation is empty (only has welcome message) */}
                            {messages.length <= 1 && (
                                <div className="space-y-3 animate-[bubbleAppear_0.35s_ease-out_forwards]">
                                    <p className="text-[10px] font-bold text-slate-400 font-heading uppercase tracking-wider pl-1">Perguntas Rápidas Sugeridas:</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {suggestions.map((question) => (
                                            <button
                                                key={question}
                                                type="button"
                                                onClick={() => submitQuestion(question)}
                                                className="rounded-xl border border-slate-200/50 bg-white px-3 py-2.5 text-left font-body text-xs font-semibold text-[#3b5580] shadow-[0_2px_8px_rgba(28,46,76,0.02)] transition-all hover:-translate-y-0.5 hover:border-hotel-blue/20 hover:shadow-[0_4px_12px_rgba(28,46,76,0.06)] hover:text-hotel-blue active:translate-y-0"
                                            >
                                                {question}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Chat history */}
                            <div className="space-y-4 flex-1">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex items-start gap-2.5 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'} animate-[bubbleAppear_0.25s_ease-out_forwards]`}
                                    >
                                        {message.role === 'assistant' && (
                                            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-hotel-blue/10 text-hotel-blue border border-hotel-blue/10 p-1">
                                                <Sparkles size={13} />
                                            </div>
                                        )}
                                        <div
                                            className={message.role === 'assistant'
                                                ? 'max-w-[85%] whitespace-pre-line rounded-[1.25rem] rounded-tl-none border border-[#e2ebf8] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#1c2e4c] shadow-[0_2px_12px_rgba(28,46,76,0.03)] font-body'
                                                : 'max-w-[85%] whitespace-pre-line rounded-[1.25rem] rounded-tr-none bg-gradient-to-br from-hotel-blue to-[#13499b] px-4 py-3 text-[13px] leading-relaxed text-white shadow-[0_6px_20px_rgba(28,78,160,0.12)] font-body'}
                                        >
                                            {message.content}
                                        </div>
                                    </div>
                                ))}

                                {isTyping && (
                                    <div className="flex items-start gap-2.5 justify-start animate-[bubbleAppear_0.2s_ease-out_forwards]">
                                        <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-hotel-blue/10 text-hotel-blue border border-hotel-blue/10 p-1">
                                            <Sparkles size={13} />
                                        </div>
                                        <div className="flex items-center gap-1 bg-white border border-[#e2ebf8] rounded-[1.25rem] rounded-tl-none shadow-[0_2px_12px_rgba(28,46,76,0.03)] px-4 py-3.5">
                                            <span className="w-1.5 h-1.5 bg-[#8ea7cc] rounded-full animate-[typingPulse_1s_infinite_0ms]" />
                                            <span className="w-1.5 h-1.5 bg-[#8ea7cc] rounded-full animate-[typingPulse_1s_infinite_150ms]" />
                                            <span className="w-1.5 h-1.5 bg-[#8ea7cc] rounded-full animate-[typingPulse_1s_infinite_300ms]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Suggestions row if conversation has started */}
                        {messages.length > 1 && (
                            <div className="bg-slate-50 border-t border-slate-200/50 py-2.5 shrink-0">
                                <div className="flex overflow-x-auto gap-2 px-3 scrollbar-none snap-x snap-mandatory">
                                    {suggestions.map((question) => (
                                        <button
                                            key={question}
                                            type="button"
                                            onClick={() => submitQuestion(question)}
                                            className="shrink-0 snap-start rounded-full border border-slate-200 bg-white px-3.5 py-1.5 font-body text-[11px] font-semibold text-[#4f6b98] hover:border-hotel-blue/30 hover:text-hotel-blue hover:bg-hotel-blue/5 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-95"
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bottom Form input */}
                        <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white px-3 py-3">
                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-1.5 py-1 focus-within:border-hotel-blue/35 focus-within:bg-white focus-within:shadow-[0_2px_12px_rgba(28,78,160,0.04)] transition-all">
                                <input
                                    type="text"
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    placeholder="Escreva sua pergunta..."
                                    className="h-9 flex-1 bg-transparent font-body text-[13px] text-[#1c2e4c] outline-none placeholder:text-slate-400"
                                />
                                <button
                                    type="submit"
                                    disabled={!draft.trim() || isTyping}
                                    className={`inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg shadow-sm transition-all duration-200 ${
                                        !draft.trim() || isTyping
                                            ? 'bg-slate-150 text-slate-400 cursor-not-allowed shadow-none'
                                            : 'bg-hotel-blue text-white hover:bg-hotel-blue/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                                    }`}
                                    aria-label="Enviar pergunta"
                                >
                                    <Send size={13} />
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