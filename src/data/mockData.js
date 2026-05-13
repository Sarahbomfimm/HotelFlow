import { UserRole } from '../models/User';
import { StatusOS } from '../models/OrdemDeServico';

// ─── Usuários (senha fictícia para desenvolvimento) ────────────────────────
export const USERS = [
    {
        id: 'u1',
        firebaseUid: '49eOS1J4RqXKsoSC5tktxQwSTRy1',
        nome: 'Sofia',
        email: 'sofia@hotelflow.com',
        telefone: '+558288736580',
        senha: 'sofia123',
        role: UserRole.DIRETORA,
        departamentos: ['Financeiro'],
    },
    {
        id: 'u2',
        nome: 'Mauricio',
        email: 'mauricio@hotelflow.com',
        telefone: '+558288736580',
        senha: 'mauricio123',
        role: UserRole.LIDER,
        departamentos: ['Manutenção'],
    },
    {
        id: 'u3',
        nome: 'Getúlio',
        email: 'getulio@hotelflow.com',
        telefone: '+558288736580',
        senha: 'getulio123',
        role: UserRole.LIDER,
        departamentos: ['Controle', 'Qualidade'],
    },
    {
        id: 'u4',
        nome: 'Bernadino',
        email: 'bernadino@hotelflow.com',
        telefone: '+558288736580',
        senha: 'bernadino123',
        role: UserRole.LIDER,
        departamentos: ['Comercial', 'Marketing'],
    },
    {
        id: 'u5',
        nome: 'Silvio',
        email: 'silvio@hotelflow.com',
        telefone: '+558288736580',
        senha: 'silvio123',
        role: UserRole.LIDER,
        departamentos: ['Hospedagem'],
    },
    {
        id: 'u6',
        nome: 'Vanessa',
        email: 'vanessa@hotelflow.com',
        telefone: '+558288736580',
        senha: 'vanessa123',
        role: UserRole.LIDER,
        departamentos: ['Governança'],
    },
    {
        id: 'u7',
        nome: 'Leonardo',
        email: 'leonardo@hotelflow.com',
        telefone: '+558288736580',
        senha: 'leonardo123',
        role: UserRole.LIDER,
        departamentos: ['A&B'],
    },
    {
        id: 'u8',
        nome: 'Kelen',
        email: 'kelen@hotelflow.com',
        telefone: '+558288736580',
        senha: 'kelen123',
        role: UserRole.LIDER,
        departamentos: ['RH'],
    },
    {
        id: 'u9',
        nome: 'Suellen',
        email: 'suellen@hotelflow.com',
        telefone: '+558288736580',
        senha: 'suellen123',
        role: UserRole.LIDER,
        departamentos: ['Compras e Suprimentos', 'Lavanderia'],
    },
];

// Helper: mapa departamento -> líder
export const DEPT_LIDER_MAP = {};
USERS.forEach((u) => {
    if (u.role === UserRole.LIDER) {
        u.departamentos.forEach((d) => {
            DEPT_LIDER_MAP[d] = { id: u.id, nome: u.nome };
        });
    }
});

// ─── Solicitações Internas iniciais ───────────────────────────────────────────
const today = new Date();
const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString();
};

export const INITIAL_OS = [
    {
        id: 'os1',
        titulo: 'Revisão do sistema de ar-condicionado — Ala Norte',
        descricao: 'Realizar manutenção preventiva nos aparelhos de ar-condicionado dos quartos 101 a 120.',
        departamento: 'Manutenção',
        responsavel_id: 'u2',
        responsavel_nome: 'Mauricio',
        prazo: addDays(today, 3),
        status: StatusOS.EM_ANDAMENTO,
        criado_em: addDays(today, -2),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -2),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
            {
                data: addDays(today, -1),
                usuario_nome: 'Mauricio',
                descricao: 'Status alterado de Aberto para Em Andamento.',
            },
        ],
    },
    {
        id: 'os2',
        titulo: 'Auditoria de qualidade — Restaurante Principal',
        descricao: 'Verificar padrões de higiene, atendimento e apresentação dos pratos no restaurante.',
        departamento: 'Qualidade',
        responsavel_id: 'u3',
        responsavel_nome: 'Getúlio',
        prazo: addDays(today, 5),
        status: StatusOS.ABERTO,
        criado_em: addDays(today, -1),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -1),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
        ],
    },
    {
        id: 'os3',
        titulo: 'Campanha de alta temporada — Redes Sociais',
        descricao: 'Planejar e executar campanha de marketing para a alta temporada de julho.',
        departamento: 'Marketing',
        responsavel_id: 'u4',
        responsavel_nome: 'Bernadino',
        prazo: addDays(today, 14),
        status: StatusOS.ABERTO,
        criado_em: addDays(today, -3),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -3),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
        ],
    },
    {
        id: 'os4',
        titulo: 'Treinamento de recepção — Processos de check-in',
        descricao: 'Treinar equipe de hospedagem nos novos fluxos de check-in e uso do sistema.',
        departamento: 'Hospedagem',
        responsavel_id: 'u5',
        responsavel_nome: 'Silvio',
        prazo: addDays(today, 7),
        status: StatusOS.EM_ANDAMENTO,
        criado_em: addDays(today, -4),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -4),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
            {
                data: addDays(today, -2),
                usuario_nome: 'Silvio',
                descricao: 'Status alterado de Aberto para Em Andamento.',
            },
        ],
    },
    {
        id: 'os5',
        titulo: 'Inspeção de enxoval — Lavanderia',
        descricao: 'Inspeção e descarte de enxoval danificado; levantar necessidade de reposição.',
        departamento: 'Lavanderia',
        responsavel_id: 'u9',
        responsavel_nome: 'Suellen',
        prazo: addDays(today, 2),
        status: StatusOS.CONCLUIDO,
        criado_em: addDays(today, -7),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -7),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
            {
                data: addDays(today, -5),
                usuario_nome: 'Suellen',
                descricao: 'Status alterado de Aberto para Em Andamento.',
            },
            {
                data: addDays(today, -1),
                usuario_nome: 'Suellen',
                descricao: 'Status alterado de Em Andamento para Concluído.',
            },
        ],
    },
    {
        id: 'os6',
        titulo: 'Revisão de cardápio — A&B',
        descricao: 'Propor atualização do cardápio do café da manhã para a temporada de verão.',
        departamento: 'A&B',
        responsavel_id: 'u7',
        responsavel_nome: 'Leonardo',
        prazo: addDays(today, 10),
        status: StatusOS.ABERTO,
        criado_em: addDays(today, -1),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -1),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
        ],
    },
    {
        id: 'os7',
        titulo: 'Processo seletivo — Auxiliares de limpeza',
        descricao: 'Conduzir processo de recrutamento e seleção para 4 vagas de auxiliar de limpeza.',
        departamento: 'RH',
        responsavel_id: 'u8',
        responsavel_nome: 'Kelen',
        prazo: addDays(today, 20),
        status: StatusOS.EM_ANDAMENTO,
        criado_em: addDays(today, -5),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -5),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
            {
                data: addDays(today, -3),
                usuario_nome: 'Kelen',
                descricao: 'Status alterado de Aberto para Em Andamento.',
            },
        ],
    },
    {
        id: 'os8',
        titulo: 'Cotação de produtos de limpeza',
        descricao: 'Realizar cotação com pelo menos 3 fornecedores para os produtos de limpeza do próximo trimestre.',
        departamento: 'Compras e Suprimentos',
        responsavel_id: 'u9',
        responsavel_nome: 'Suellen',
        prazo: addDays(today, 4),
        status: StatusOS.ABERTO,
        criado_em: addDays(today, -2),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -2),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
        ],
    },
    {
        id: 'os9',
        titulo: 'Fechamento financeiro — Março',
        descricao: 'Concluir o fechamento financeiro do mês de março e preparar relatório para a diretoria.',
        departamento: 'Financeiro',
        responsavel_id: 'u1',
        responsavel_uid: '49eOS1J4RqXKsoSC5tktxQwSTRy1',
        responsavel_nome: 'Sofia',
        prazo: addDays(today, 1),
        status: StatusOS.EM_ANDAMENTO,
        criado_em: addDays(today, -6),
        criado_por_id: 'u1',
        criado_por_nome: 'Sofia',
        historico: [
            {
                data: addDays(today, -6),
                usuario_nome: 'Sofia',
                descricao: 'Solicitação interna criada.',
            },
            {
                data: addDays(today, -4),
                usuario_nome: 'Sofia',
                descricao: 'Status alterado de Aberto para Em Andamento.',
            },
        ],
    },
];
