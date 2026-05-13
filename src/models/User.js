// Modelo de dados: Usuário
export const UserRole = {
    ADMIN: 'admin',
    DIRETORA: 'diretora',
    LIDER: 'lider',
};

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} nome
 * @property {string} email
 * @property {string} senha
 * @property {'admin'|'diretora'|'lider'} role
 * @property {string[]} departamentos  - departamentos sob responsabilidade do líder
 */
export function createUser({ id, nome, email, senha, role, departamentos = [] }) {
    return { id, nome, email, senha, role, departamentos };
}
