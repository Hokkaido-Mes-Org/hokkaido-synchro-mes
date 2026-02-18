/**
 * plan.utils.js — Utilitários de planejamento
 * Extraído de script.js (Phase 3B) — funções puras
 */

/**
 * Verifica se um planejamento está ativo (não finalizado/cancelado)
 * @param {object} plan
 * @returns {boolean}
 */
export function isPlanActive(plan) {
    if (!plan) return false;
    const status = String(plan.status || '').toLowerCase();
    const inactiveStatuses = ['concluida', 'concluido', 'finalizada', 'finalizado', 'cancelada', 'cancelado', 'encerrada', 'encerrado'];
    if (status && inactiveStatuses.includes(status)) {
        return false;
    }
    return true;
}

/**
 * Normaliza valor de turno para formato "T1", "T2", "T3"
 * @param {*} value
 * @returns {string|null}
 */
export function normalizeShiftValue(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `T${value}`;
    }
    const str = String(value).toUpperCase();
    const match = str.match(/T?\s*(\d)/);
    return match ? `T${match[1]}` : null;
}

/**
 * Gera badge HTML para status de ordem de produção
 * @param {string} status
 * @returns {string} HTML
 */
export function getProductionOrderStatusBadge(status = 'planejada') {
    const statusMap = {
        'planejada': { label: 'Planejada', className: 'bg-sky-100 text-sky-700' },
        'em_andamento': { label: 'Em andamento', className: 'bg-amber-100 text-amber-700' },
        'concluida': { label: 'Concluída', className: 'bg-emerald-100 text-emerald-700' },
        'cancelada': { label: 'Cancelada', className: 'bg-red-100 text-red-700' }
    };

    const safeStatus = statusMap[status] || statusMap['planejada'];
    return `<span class="px-2 py-1 rounded-full text-xs font-semibold ${safeStatus.className}">${safeStatus.label}</span>`;
}

// Expor no window para uso em legacy code
if (typeof window !== 'undefined') {
    window.isPlanActive = isPlanActive;
    window.normalizeShiftValue = normalizeShiftValue;
    window.getProductionOrderStatusBadge = getProductionOrderStatusBadge;
}
