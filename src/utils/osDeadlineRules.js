import { endOfDay, isPast, isValid, parseISO } from 'date-fns';
import { StatusOS } from '../models/OrdemDeServico';

function toValidDate(value) {
    if (!value) return null;
    const parsed = parseISO(String(value));
    return isValid(parsed) ? parsed : null;
}

function hasDeadlinePassed(value) {
    return Boolean(value) && isPast(endOfDay(value));
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

    const officialDeadline = toValidDate(order.prazo);
    const leaderDeadline = toValidDate(getLeaderEstimatedDeadlineValue(order));
    if (leaderDeadline && !hasDeadlinePassed(leaderDeadline)) {
        return leaderDeadline;
    }

    if (officialDeadline) {
        return officialDeadline;
    }

    if (leaderDeadline) {
        return leaderDeadline;
    }

    return null;
}

export function isSIOverdue(order) {
    const deadline = getApplicableDeadlineDate(order);
    if (!deadline) {
        return false;
    }

    return hasDeadlinePassed(deadline);
}
