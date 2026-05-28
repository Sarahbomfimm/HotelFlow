import { isPast, isValid, parseISO } from 'date-fns';
import { StatusOS } from '../models/OrdemDeServico';

function toValidDate(value) {
    if (!value) return null;
    const parsed = parseISO(String(value));
    return isValid(parsed) ? parsed : null;
}

export function getLeaderEstimatedDeadlineValue(order) {
    if (!order) return null;

    if (order.prazo_estimado) {
        return order.prazo_estimado;
    }

    const latestFromHistory = [...(order.historico || [])]
        .reverse()
        .find((entry) => entry?.prazo_estimado)?.prazo_estimado;

    return latestFromHistory || null;
}

export function getApplicableDeadlineDate(order) {
    if (!order || order.status === StatusOS.CONCLUIDO) {
        return null;
    }

    const leaderDeadline = toValidDate(getLeaderEstimatedDeadlineValue(order));
    if (leaderDeadline) {
        return leaderDeadline;
    }

    if (order.status === StatusOS.ABERTO) {
        return toValidDate(order.prazo);
    }

    return null;
}

export function isSIOverdue(order) {
    const deadline = getApplicableDeadlineDate(order);
    if (!deadline) {
        return false;
    }

    return isPast(deadline);
}
