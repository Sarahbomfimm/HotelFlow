import { UserRole } from '../models/User';

export const PERMISSIONS = {
    ADMIN_PANEL_ACCESS: 'admin_panel_access',
    SI_CREATE_ACCESS: 'si_create_access',
    AUDITORIAS_ACCESS: 'auditorias_access',
    AUDITORIAS_CREATE: 'auditorias_create',
    AUDITORIAS_MANAGE: 'auditorias_manage',
    REUNIOES_ACCESS: 'reunioes_access',
    REUNIOES_MANAGE: 'reunioes_manage',
    HISTORICO_ACCESS: 'historico_access',
    SI_FINALIZE: 'si_finalize',
    SI_EDIT: 'si_edit',
};

export const PERMISSION_DEFINITIONS = [
    {
        key: PERMISSIONS.ADMIN_PANEL_ACCESS,
        label: 'Acessar Gerenciamento',
        description: 'Permite abrir o painel de Gerenciamento (Admin Console).',
        category: 'Admin',
    },
    {
        key: PERMISSIONS.SI_CREATE_ACCESS,
        label: 'Acessar Nova SI',
        description: 'Permite abrir a tela de criação de SI.',
        category: 'SI',
    },
    {
        key: PERMISSIONS.AUDITORIAS_ACCESS,
        label: 'Acessar Auditorias',
        description: 'Permite abrir as telas de Auditorias.',
        category: 'Auditorias',
    },
    {
        key: PERMISSIONS.AUDITORIAS_CREATE,
        label: 'Criar Auditorias',
        description: 'Permite registrar novas auditorias.',
        category: 'Auditorias',
    },
    {
        key: PERMISSIONS.AUDITORIAS_MANAGE,
        label: 'Gerenciar Auditorias',
        description: 'Permite editar, excluir auditorias e operar configurações ligadas ao módulo.',
        category: 'Auditorias',
    },
    {
        key: PERMISSIONS.REUNIOES_ACCESS,
        label: 'Acessar Reuniões',
        description: 'Permite abrir o calendário e a área de reuniões.',
        category: 'Reuniões',
    },
    {
        key: PERMISSIONS.REUNIOES_MANAGE,
        label: 'Gerenciar Reuniões',
        description: 'Permite criar, editar e excluir reuniões.',
        category: 'Reuniões',
    },
    {
        key: PERMISSIONS.HISTORICO_ACCESS,
        label: 'Acessar Histórico',
        description: 'Permite abrir a tela de histórico das SI.',
        category: 'SI',
    },
    {
        key: PERMISSIONS.SI_FINALIZE,
        label: 'Finalizar SI',
        description: 'Permite concluir solicitações internas.',
        category: 'SI',
    },
    {
        key: PERMISSIONS.SI_EDIT,
        label: 'Editar SI',
        description: 'Permite editar dados de solicitações internas.',
        category: 'SI',
    },
];

export function getDefaultPermissions(role) {
    if (role === UserRole.ADMIN) {
        return {
            [PERMISSIONS.ADMIN_PANEL_ACCESS]: true,
            [PERMISSIONS.SI_CREATE_ACCESS]: true,
            [PERMISSIONS.AUDITORIAS_ACCESS]: true,
            [PERMISSIONS.AUDITORIAS_CREATE]: true,
            [PERMISSIONS.AUDITORIAS_MANAGE]: true,
            [PERMISSIONS.REUNIOES_ACCESS]: true,
            [PERMISSIONS.REUNIOES_MANAGE]: true,
            [PERMISSIONS.HISTORICO_ACCESS]: true,
            [PERMISSIONS.SI_FINALIZE]: true,
            [PERMISSIONS.SI_EDIT]: true,
        };
    }

    if (role === UserRole.DIRETORA) {
        return {
            [PERMISSIONS.ADMIN_PANEL_ACCESS]: false,
            [PERMISSIONS.SI_CREATE_ACCESS]: true,
            [PERMISSIONS.AUDITORIAS_ACCESS]: true,
            [PERMISSIONS.AUDITORIAS_CREATE]: true,
            [PERMISSIONS.AUDITORIAS_MANAGE]: true,
            [PERMISSIONS.REUNIOES_ACCESS]: true,
            [PERMISSIONS.REUNIOES_MANAGE]: true,
            [PERMISSIONS.HISTORICO_ACCESS]: true,
            [PERMISSIONS.SI_FINALIZE]: true,
            [PERMISSIONS.SI_EDIT]: true,
        };
    }

    return {
        [PERMISSIONS.ADMIN_PANEL_ACCESS]: false,
        [PERMISSIONS.SI_CREATE_ACCESS]: true,
        [PERMISSIONS.AUDITORIAS_ACCESS]: true,
        [PERMISSIONS.AUDITORIAS_CREATE]: true,
        [PERMISSIONS.AUDITORIAS_MANAGE]: false,
        [PERMISSIONS.REUNIOES_ACCESS]: true,
        [PERMISSIONS.REUNIOES_MANAGE]: true,
        [PERMISSIONS.HISTORICO_ACCESS]: false,
        [PERMISSIONS.SI_FINALIZE]: true,
        [PERMISSIONS.SI_EDIT]: true,
    };
}

export function normalizePermissions(role, permissions) {
    const defaults = getDefaultPermissions(role);
    const source = permissions && typeof permissions === 'object' && !Array.isArray(permissions) ? permissions : {};

    const merged = Object.keys(defaults).reduce((acc, key) => {
        acc[key] = typeof source[key] === 'boolean' ? source[key] : defaults[key];
        return acc;
    }, {});

    Object.keys(source).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(merged, key)) {
            return;
        }

        if (typeof source[key] === 'boolean') {
            merged[key] = source[key];
        }
    });

    return merged;
}

export function hasPermission(user, permissionKey) {
    if (!permissionKey) return true;
    const normalized = normalizePermissions(user?.role, user?.permissions);
    return Boolean(normalized[permissionKey]);
}

export function getPermissionDeniedCopy(permissionKey) {
    switch (permissionKey) {
        case PERMISSIONS.ADMIN_PANEL_ACCESS:
            return {
                title: 'Acesso negado ao Gerenciamento',
                message: 'Seu usuário não está autorizado no Gerenciamento para acessar o painel administrativo.',
            };
        case PERMISSIONS.SI_CREATE_ACCESS:
            return {
                title: 'Sem permissão para criar SI',
                message: 'Seu usuário não está autorizado no Gerenciamento para abrir a tela de Nova SI.',
            };
        case PERMISSIONS.AUDITORIAS_ACCESS:
            return {
                title: 'Acesso negado a Auditorias',
                message: 'Seu usuário não está autorizado no Gerenciamento para acessar o módulo de Auditorias.',
            };
        case PERMISSIONS.AUDITORIAS_CREATE:
            return {
                title: 'Sem permissão para criar auditorias',
                message: 'Seu usuário pode visualizar o módulo, mas não está autorizado a registrar novas auditorias.',
            };
        case PERMISSIONS.REUNIOES_ACCESS:
            return {
                title: 'Acesso negado a Reuniões',
                message: 'Seu usuário não está autorizado no Gerenciamento para acessar o módulo de Reuniões.',
            };
        case PERMISSIONS.HISTORICO_ACCESS:
            return {
                title: 'Acesso negado ao Histórico',
                message: 'Seu usuário não está autorizado no Gerenciamento para acessar a tela de Histórico.',
            };
        default:
            return {
                title: 'Acesso negado',
                message: 'Seu usuário não possui a permissão necessária para acessar esta área.',
            };
    }
}