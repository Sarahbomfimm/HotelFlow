import { isSameMonth, isValid, parseISO } from 'date-fns';
import { StatusOS } from '../models/OrdemDeServico';

function toValidDate(value) {
    if (!value) return null;
    const parsed = parseISO(String(value));
    return isValid(parsed) ? parsed : null;
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export function getCompletionDate(order) {
    if (!order) {
        return null;
    }

    const explicitCompletionDate = toValidDate(order.concluido_em);
    if (explicitCompletionDate) {
        return explicitCompletionDate;
    }

    const historyCompletionDate = [...(order.historico || [])]
        .reverse()
        .find((entry) => {
            const description = normalizeText(entry?.descricao);
            return description.includes('status alterado') && description.includes('para concluido');
        })?.data;

    return toValidDate(historyCompletionDate);
}

export function isOrderInSelectedDashboardMonth(order, selectedMonthDate) {
    if (!order || !selectedMonthDate) {
        return false;
    }

    if (order.status === StatusOS.CONCLUIDO) {
        const completionDate = getCompletionDate(order);
        if (completionDate) {
            return isSameMonth(completionDate, selectedMonthDate);
        }
    }

    const createdAt = toValidDate(order.criado_em);
    if (!createdAt) {
        return false;
    }

    if (isSameMonth(createdAt, selectedMonthDate)) {
        return true;
    }

    return isSameMonth(selectedMonthDate, new Date())
        && order.status !== StatusOS.CONCLUIDO
        && createdAt < selectedMonthDate;
}