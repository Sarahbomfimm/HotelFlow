export const StatusReuniao = {
    AGENDADA: 'agendada',
    CONCLUIDA: 'concluida',
    CANCELADA: 'cancelada',
};

export const RecorrenciaReuniao = {
    NENHUMA: 'nenhuma',
    SEMANAL: 'semanal',
    QUINZENAL: 'quinzenal',
    MENSAL: 'mensal',
};

export const SalasDisponiveis = [
    { id: 'sala-aurora', nome: 'Sala Aurora', capacidade: 8 },
    { id: 'sala-horizonte', nome: 'Sala Horizonte', capacidade: 12 },
    { id: 'sala-atlas', nome: 'Sala Atlas', capacidade: 6 },
    { id: 'auditorio', nome: 'Auditório Interno', capacidade: 40 },
    { id: 'videoconferencia', nome: 'Sala Videoconferência', capacidade: 20 },
];

export const StatusLabel = {
    [StatusReuniao.AGENDADA]: 'Agendada',
    [StatusReuniao.CONCLUIDA]: 'Concluída',
    [StatusReuniao.CANCELADA]: 'Cancelada',
};

export const RecorrenciaLabel = {
    [RecorrenciaReuniao.NENHUMA]: 'Sem recorrência',
    [RecorrenciaReuniao.SEMANAL]: 'Toda semana',
    [RecorrenciaReuniao.QUINZENAL]: 'Quinzenalmente',
    [RecorrenciaReuniao.MENSAL]: 'Todo mês',
};
