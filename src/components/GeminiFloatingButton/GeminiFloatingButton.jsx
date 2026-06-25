import {
    useEffect, useMemo, useRef, useState,
} from 'react';
import { Send, Sparkles, X, ChevronRight } from 'lucide-react';
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
    'Como anexar um documento? 📁',
    'Como funciona o Treinamento? 🎓',
    'Como lançar Auditoria 5S? 🔍',
    'Como criar um POP? 📖',
    'Como conectar o Telegram? 🤖',
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
   * A partir de agora, as notificações mais importantes serão enviadas diretamente no seu chat privado com o bot. 🔔`,
        },
        {
            id: 'dashboard',
            keywords: ['dashboard', 'painel inicial', 'resumo', 'indicadores', 'visao geral', 'tela inicial', 'painel'],
            strong: ['indicadores', 'visao geral', 'como usar o dashboard'],
            response: `🏡 **Como aproveitar ao máximo o seu Dashboard:**

O Dashboard é a sua central de controle diário no HotelFlow. Como você é **\${roleLabel}**, veja o que está disponível para você:

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
        {
            id: 'documentacoes',
            keywords: ['documento', 'documentacao', 'documentacoes', 'anexar documento', 'pasta', 'categoria', 'excluir documento', 'excluir categoria', 'anexo', 'upload', 'como anexar', 'como anexar um documento'],
            strong: ['como anexar um documento', 'criar categoria', 'excluir item', 'documentacao'],
            response: `📁 **Central de Documentações (Documentações Flow):**

Esta área permite anexar e organizar arquivos importantes (como manuais, contratos e normas) em pastas/categorias personalizadas:

* **Criar Categoria (Pasta):** Clique em **"Criar Categoria"** no topo da tela, digite o título e a descrição da pasta (ex: *Contratos de TI*).
* **Anexar Documento:** Selecione a categoria desejada e clique em **"Anexar Documento"**. Defina um assunto, selecione o arquivo (PDF, imagens, planilhas de até 10MB) e clique em anexar.
* **Excluir Categorias ou Documentos:** Para manter a segurança da informação, a exclusão é restrita! Apenas o **Administrador (Admin)**, o **dono que anexou o documento** ou o **dono que criou a categoria** podem excluir itens.`,
        },
        {
            id: 'pops',
            keywords: ['pop', 'pops', 'procedimento', 'procedimentos', 'manual operacional', 'padrao', 'setor', 'criar pop', 'cadastrar pop', 'como criar um pop'],
            strong: ['o que e pop', 'como criar pop', 'procedimento operacional padrao'],
            response: `📖 **Procedimentos Operacionais Padrão (POPs):**

Os POPs servem para padronizar e treinar a equipe nas rotinas e tarefas operacionais de cada setor do hotel:

* **Categorias por Setor:** Os POPs são organizados em setores padrões como *Recepção, Governança, Manutenção, Restaurante, Financeiro, RH, Compras*, etc.
* **Criar um POP:** Se você tiver a permissão correspondente, acesse POPs, clique em **"Criar POP"**, selecione o setor de destino, dê um título, uma breve descrição e anexe o manual em PDF.
* **Consultar e Baixar:** Qualquer colaborador do hotel pode clicar no card do setor desejado para ler as instruções ou baixar o arquivo PDF de manual operacional.`,
        },
        {
            id: 'auditorias',
            keywords: ['auditoria', 'auditorias', '5s', 'senso', 'sensos', 'lancar auditoria', 'criar auditoria', 'seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke', 'como lancar auditoria'],
            strong: ['como fazer auditoria', 'auditoria 5s', 'sensos 5s', 'lancar auditoria', 'como lancar auditoria 5s'],
            response: `🔍 **Auditorias 5S:**

O módulo de Auditorias serve para monitorar a organização e limpeza dos setores através do programa 5S:

* **Os 5 Sensos Avaliados:**
  1. 🚪 **Triagem (Seiri):** Separar o útil do inútil e descartar.
  2. 🧼 **Arrumação (Seiton):** Organizar o espaço de trabalho.
  3. ✨ **Higiene (Seiso):** Limpeza geral e zelo.
  4. 📋 **Normalização (Seiketsu):** Padronização visual e saúde.
  5. 🤝 **Disciplina (Shitsuke):** Agir de acordo com os padrões.
* **Pontuação:** Cada senso tem 5 perguntas pontuadas de 0 a 4. A nota geral vai de 0 a 100 e é classificada como *Excelente (>=91), Bom, Médio, Mal ou Péssimo (<=50)*.
* **Como Registrar:** Se tiver a permissão **Criar Auditorias**, acesse a tela de Auditorias, selecione o setor e o mês correspondente, clique em "Nova Auditoria" e preencha as notas.`,
        },
        {
            id: 'treinamentos',
            keywords: ['treinamento', 'treinamentos', 'palestrante', 'convite treinamento', 'aceitar convite', 'recusar convite', 'rh', 'duracao', 'palestra', 'aceitar treinamento', 'como funciona o treinamento'],
            strong: ['criar treinamento', 'aceitar treinamento', 'convite de treinamento', 'como funciona o treinamento'],
            response: `🎓 **Registro e Convites de Treinamentos:**

Este módulo auxilia no desenvolvimento e na capacitação contínua da equipe do hotel:

* **Registrar Treinamento (Exclusivo RH/Admin):** Acesse a tela de Treinamentos, preencha o tema, setor de foco, palestrante, data, duração e selecione os participantes. É possível anexar um PDF com materiais de apoio.
* **Responder ao Convite (Líderes/Colaboradores):** Ao ser convidado para um treinamento, você visualizará o card com as opções de **Aceitar** ou **Recusar** o convite diretamente na tela de Treinamentos.
* **Painel de Confirmações:** Quem organizou consegue ver a lista atualizada de quem confirmou presença em tempo real.`,
        },
        {
            id: 'aprovacoes',
            keywords: ['aprovacao', 'aprovacoes', 'kanban aprovacoes', 'solicitada', 'em analise', 'aprovar si', 'como aprovar si', 'kanban de aprovacoes'],
            strong: ['como aprovar si', 'kanban de aprovacoes'],
            response: `📋 **Módulo de Aprovações de SI:**

O módulo de Aprovações serve para triar e analisar novas solicitações (SIs) antes de adicioná-las ao fluxo de execução operacional do hotel:

* **Colunas do Kanban:**
  1. 📥 **Solicitadas:** Novas demandas registradas que aguardam revisão.
  2. 🔍 **Em Análise:** Demandas sendo revisadas pela diretoria ou administração.
  3. 🟢 **Finalizadas / Aprovadas:** Demandas autorizadas que são convertidas em SIs ativas no painel principal dos líderes.
* **Acesso:** Exclusivo para perfis com permissão de aprovação de SIs.`,
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
* 📁 Central de documentações (como anexar arquivos)
* 📖 Manual de POPs e Procedimentos
* 🔍 Lançar auditoria 5S e avaliação de sensos
* 🎓 Convites e registros de treinamentos
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

    return 'Entendi sua mensagem, mas não tenho certeza de como responder. 🧐\n\nPosso te ajudar com dúvidas sobre **criação de SIs, responsáveis, reuniões, Telegram, PDCA, filtros, exportações, documentações, auditorias 5S, POPs e treinamentos**. Tente reformular sua pergunta ou use as sugestões rápidas acima!';
}

function formatMarkdown(text) {
    if (!text) return '';

    const lines = text.split('\n');
    let inList = false;
    let listType = null; // 'ul' or 'ol'
    let listItems = [];
    const elements = [];

    const parseInline = (str, lineIndex) => {
        if (typeof str !== 'string') return str;
        
        const parts = [];
        let lastIndex = 0;
        const regex = /(\*\*|`)(.*?)\1/g;
        let match;
        let partKey = 0;
        
        while ((match = regex.exec(str)) !== null) {
            const before = str.substring(lastIndex, match.index);
            if (before) {
                parts.push(before);
            }
            
            const type = match[1];
            const content = match[2];
            
            if (type === '**') {
                parts.push(
                    <strong key={`bold-${lineIndex}-${partKey++}`} className="font-semibold text-slate-900">
                        {content}
                    </strong>
                );
            } else if (type === '`') {
                parts.push(
                    <code key={`code-${lineIndex}-${partKey++}`} className="bg-slate-100/80 border border-slate-200/50 text-rose-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold">
                        {content}
                    </code>
                );
            }
            lastIndex = regex.lastIndex;
        }
        
        const after = str.substring(lastIndex);
        if (after) {
            parts.push(after);
        }
        
        return parts.length > 0 ? parts : str;
    };

    const flushList = (keyPrefix) => {
        if (listItems.length > 0) {
            const listKey = `list-${keyPrefix}`;
            if (listType === 'ul') {
                elements.push(
                    <ul key={listKey} className="space-y-1 my-1.5 list-disc pl-5 text-slate-700">
                        {listItems}
                    </ul>
                );
            } else if (listType === 'ol') {
                elements.push(
                    <ol key={listKey} className="space-y-1 my-1.5 list-decimal pl-5 text-slate-700">
                        {listItems}
                    </ol>
                );
            }
            listItems = [];
            inList = false;
            listType = null;
        }
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        const headingMatch = line.match(/^###\s+(.*)$/);
        const ulMatch = line.match(/^\s*([*\-]|•)\s+(.*)$/);
        const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);

        if (headingMatch) {
            flushList(index);
            elements.push(
                <h4 key={`h4-${index}`} className="text-[13px] font-bold text-slate-800 mt-3 mb-1.5 flex items-center gap-1.5 font-heading">
                    {parseInline(headingMatch[1], index)}
                </h4>
            );
        } else if (ulMatch) {
            if (!inList || listType !== 'ul') {
                flushList(index);
                inList = true;
                listType = 'ul';
            }
            listItems.push(
                <li key={`li-${index}`} className="text-slate-650 leading-relaxed text-[13px] pl-0.5 my-0.5">
                    {parseInline(ulMatch[2], index)}
                </li>
            );
        } else if (olMatch) {
            if (!inList || listType !== 'ol') {
                flushList(index);
                inList = true;
                listType = 'ol';
            }
            listItems.push(
                <li key={`li-${index}`} className="text-slate-650 leading-relaxed text-[13px] pl-0.5 my-0.5">
                    {parseInline(olMatch[2], index)}
                </li>
            );
        } else if (trimmed === '') {
            flushList(index);
            elements.push(<div key={`empty-${index}`} className="h-1.5" />);
        } else {
            flushList(index);
            elements.push(
                <p key={`p-${index}`} className="text-slate-650 leading-relaxed text-[13px] my-1 font-body">
                    {parseInline(line, index)}
                </p>
            );
        }
    });

    flushList(lines.length);
    return elements;
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
                        className="pointer-events-none absolute -top-[4.65rem] right-0 z-30 hidden w-56 rounded-2xl border border-slate-200/40 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 px-4 py-3 text-sm text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] group-hover:block"
                        style={{ animation: 'geminiTooltipRise 180ms ease-out forwards' }}
                    >
                        <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 rounded-lg bg-yellow-400/10 p-1 text-yellow-300">
                                <Sparkles size={13} />
                            </div>
                            <div>
                                <p className="font-heading text-xs font-bold tracking-[0.08em] text-yellow-300">IA.Flow PRO ✨</p>
                                <p className="mt-1 font-body text-[11px] leading-relaxed text-slate-350">
                                    Precisa de ajuda? Tire suas dúvidas com nossa inteligência artificial!
                                </p>
                            </div>
                        </div>
                        <div className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 rounded-[2px] bg-slate-900 border-r border-b border-slate-200/10" />
                    </div>
                )}

                {isOpen && (
                    <div
                        className="absolute bottom-[5.5rem] right-0 z-20 overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white/95 backdrop-blur-xl shadow-[0_24px_60px_rgba(15,23,42,0.12),0_1px_3px_rgba(0,0,0,0.04)] flex flex-col transition-all duration-300 ease-out"
                        style={{
                            width: 'min(380px, calc(100vw - 24px))',
                            height: 'min(530px, calc(100vh - 120px))',
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800 shadow-sm z-10 relative">
                            {/* Accent Glow Top line */}
                            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500" />
                            
                            <div className="flex items-center gap-3">
                                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md border border-white/10">
                                    <Sparkles size={18} className="animate-pulse text-yellow-300" />
                                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-500 animate-ping" />
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-heading text-[14px] font-bold tracking-wide text-white">IA.Flow</p>
                                        <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-[8px] font-extrabold text-slate-950 px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">PRO</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">Assistente de Suporte Online</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        clearChat();
                                    }}
                                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-slate-800"
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
                                    className="rounded-lg bg-slate-800 p-1.5 text-slate-400 transition-all hover:bg-slate-700 hover:text-white border border-slate-700/50"
                                    aria-label="Fechar assistente"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Conversational body */}
                        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] px-5 py-5 flex flex-col gap-4 scrollbar-thin">
                            {/* Suggestions rendered as grid if conversation is empty (only has welcome message) */}
                            {messages.length <= 1 && (
                                <div className="space-y-3 animate-[bubbleAppear_0.35s_ease-out_forwards] mt-1">
                                    <div className="flex items-center gap-1.5 pl-1.5">
                                        <Sparkles size={11} className="text-blue-500 animate-pulse" />
                                        <p className="text-[10px] font-bold text-slate-400 font-heading uppercase tracking-wider">Perguntas Sugeridas</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {suggestions.map((question) => (
                                            <button
                                                key={question}
                                                type="button"
                                                onClick={() => submitQuestion(question)}
                                                className="group/btn flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3.5 text-left font-body text-xs font-semibold text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/20 hover:shadow-[0_4px_12px_rgba(15,23,42,0.04)] hover:text-blue-600 active:translate-y-0"
                                            >
                                                <span>{question}</span>
                                                <ChevronRight size={14} className="text-slate-300 group-hover/btn:text-blue-500 group-hover/btn:translate-x-0.5 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Chat history */}
                            <div className="flex flex-col gap-5 flex-1">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex items-start gap-3 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'} animate-[bubbleAppear_0.25s_ease-out_forwards]`}
                                    >
                                        {message.role === 'assistant' && (
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-yellow-300 border border-slate-700/50 p-1.5 shadow-sm">
                                                <Sparkles size={14} />
                                            </div>
                                        )}
                                        <div
                                            className={message.role === 'assistant'
                                                ? 'max-w-[88%] rounded-2xl rounded-tl-none border border-slate-150/80 bg-white text-[13px] leading-relaxed text-slate-700 shadow-[0_2px_12px_rgba(15,23,42,0.02)] font-body'
                                                : 'max-w-[85%] rounded-2xl rounded-tr-none bg-gradient-to-br from-[#1e40af] to-[#3b82f6] text-[13.5px] leading-relaxed text-white shadow-[0_6px_18px_rgba(30,64,175,0.15)] font-body'}
                                            style={message.role === 'assistant'
                                                ? { padding: '0.85rem 1.15rem' }
                                                : { padding: '0.7rem 1.1rem' }}
                                        >
                                            {formatMarkdown(message.content)}
                                        </div>
                                    </div>
                                ))}

                                {isTyping && (
                                    <div className="flex items-start gap-3 justify-start animate-[bubbleAppear_0.2s_ease-out_forwards]">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-yellow-300 border border-slate-700/50 p-1.5 shadow-sm">
                                            <Sparkles size={14} />
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-white border border-slate-150/80 rounded-2xl rounded-tl-none shadow-[0_2px_12px_rgba(15,23,42,0.02)]" style={{ padding: '0.85rem 1.15rem' }}>
                                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-[typingPulse_1s_infinite_0ms]" />
                                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-[typingPulse_1s_infinite_150ms]" />
                                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-[typingPulse_1s_infinite_300ms]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Suggestions row if conversation has started */}
                        {messages.length > 1 && (
                            <div className="bg-slate-50/80 border-t border-slate-100 py-3 shrink-0 relative">
                                {/* Gradient fade indicators for scrolling */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50/80 to-transparent pointer-events-none z-10" />
                                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50/80 to-transparent pointer-events-none z-10" />
                                
                                <div className="flex overflow-x-auto gap-2.5 px-6 scrollbar-none snap-x snap-mandatory">
                                    {suggestions.map((question) => (
                                        <button
                                            key={question}
                                            type="button"
                                            onClick={() => submitQuestion(question)}
                                            className="shrink-0 snap-start rounded-full border border-slate-200/60 bg-white px-3.5 py-1.5 font-body text-[11px] font-semibold text-[#475569] hover:border-blue-500/40 hover:text-blue-600 hover:bg-blue-50/30 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:scale-95 whitespace-nowrap"
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bottom Form input */}
                        <div className="border-t border-slate-100 bg-white px-4 py-3">
                            <form onSubmit={handleSubmit}>
                                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-1.5 py-1.5 focus-within:border-blue-500/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:shadow-[0_4px_16px_rgba(15,23,42,0.03)] transition-all duration-200">
                                    <input
                                        type="text"
                                        value={draft}
                                        onChange={(event) => setDraft(event.target.value)}
                                        placeholder="Escreva sua pergunta..."
                                        className="h-9 flex-1 bg-transparent font-body text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!draft.trim() || isTyping}
                                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-all duration-200 ${
                                            !draft.trim() || isTyping
                                                ? 'bg-slate-150 text-slate-350 cursor-not-allowed shadow-none'
                                                : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:opacity-95 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                                        }`}
                                        aria-label="Enviar pergunta"
                                    >
                                        <Send size={13} />
                                    </button>
                                </div>
                            </form>
                            <div className="mt-2 text-center">
                                <span className="text-[9px] text-slate-400 font-medium tracking-wide">
                                    IA.Flow Inteligente • Respostas automatizadas 🏨
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div
                    className="absolute inset-1 z-0 rounded-[1.8rem] bg-indigo-500/10 blur-xl"
                    style={{ animation: 'geminiGlow 3.2s ease-in-out infinite' }}
                    aria-hidden="true"
                />
                <div
                    className="absolute inset-0 z-0 rounded-[2rem] bg-gradient-to-br from-white/20 via-transparent to-blue-500/10 blur-[1px]"
                    style={{ animation: 'geminiSpark 4.2s ease-in-out infinite' }}
                    aria-hidden="true"
                />
                <button
                    type="button"
                    className="relative z-10 flex h-[4.7rem] w-[4.7rem] items-center justify-center rounded-[1.8rem] border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-2 shadow-[0_20px_50px_rgba(15,23,42,0.35),0_1px_8px_rgba(255,255,255,0.12)_inset] backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_24px_60px_rgba(15,23,42,0.45),0_1px_10px_rgba(255,255,255,0.15)_inset]"
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
                        className="h-full w-full scale-105 rounded-[1.3rem] bg-white/95 object-contain p-1.5 drop-shadow-[0_6px_14px_rgba(15,23,42,0.15)]"
                    />
                </button>
            </div>
        </div>
    );
}