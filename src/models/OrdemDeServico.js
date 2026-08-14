// Modelo de dados: Ordem de Serviço
export const StatusOS = {
    ABERTO: 'aberto',
    EM_ANDAMENTO: 'em_andamento',
    CONCLUIDO: 'concluido',
};

export const StatusLabel = {
    aberto: 'Aberto',
    em_andamento: 'Em Andamento',
    concluido: 'Concluído',
};

export const ApprovalStage = {
    SOLICITADA: 'solicitada',
    EM_ANALISE: 'em_analise',
    FINALIZADA: 'finalizada',
};

export const ApprovalStageLabel = {
    [ApprovalStage.SOLICITADA]: 'Solicitadas',
    [ApprovalStage.EM_ANALISE]: 'Em análise',
    [ApprovalStage.FINALIZADA]: 'Finalizadas',
};

export const PDCAStep = {
    PLAN: 'P',
    DO: 'D',
    CHECK: 'C',
    ACT: 'A',
};

export const PDCALabel = {
    P: 'Planejar',
    D: 'Executar',
    C: 'Checar',
    A: 'Agir',
};

export const DEPARTAMENTOS = [
    'Manutenção',
    'Controle',
    'Qualidade',
    'Comercial',
    'Marketing',
    'Hospedagem',
    'Governança',
    'Lavanderia',
    'A&B',
    'RH',
    'Compras e Suprimentos',
    'Financeiro',
    'Teste',
];

/**
 * @typedef {Object} HistoricoItem
 * @property {string} data
 * @property {string} usuario_nome
 * @property {string} descricao
 */

/**
 * @typedef {Object} OrdemDeServico
 * @property {string} id
 * @property {string} titulo
 * @property {string} descricao
 * @property {string} departamento
 * @property {string} responsavel_id
 * @property {string} responsavel_nome
 * @property {string} prazo              - ISO date string
 * @property {'aberto'|'em_andamento'|'concluido'} status
 * @property {'P'|'D'|'C'|'A'} etapa_pdca
 * @property {HistoricoItem[]} historico
 * @property {string | null} [concluido_em] - ISO datetime string da conclusão
 * @property {string} criado_em          - ISO datetime string
 * @property {string} criado_por_id
 * @property {string} criado_por_nome
 */

