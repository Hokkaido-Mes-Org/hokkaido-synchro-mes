/**
 * HokkaidoMES — DOM Utilities (ES6 Module)
 * Fase 3: Extraído de script.js
 *
 * Funções utilitárias para manipulação DOM e helpers genéricos.
 */

/**
 * Debounce: adia a execução até que `wait` ms tenham passado sem nova chamada.
 * @param {Function} func
 * @param {number} wait - ms
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Escapa caracteres HTML para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Normaliza um ID de máquina para formato H01..H99.
 * Aceita: H-01, H01, h01, 01, 1, H_01, etc.
 * @param {string} id
 * @returns {string|null}
 */
export function normalizeMachineId(id) {
    if (!id) return null;
    const s = String(id).toUpperCase().replace(/\s+/g, '');
    const match = s.match(/^H[-_]?(\d{1,2})$/);
    if (match) return `H${match[1].padStart(2, '0')}`;
    const n = s.match(/^(\d{1,2})$/);
    if (n) return `H${n[1].padStart(2, '0')}`;
    const cleaned = s.replace(/-/g, '');
    const m2 = cleaned.match(/^H(\d{1,2})$/);
    if (m2) return `H${m2[1].padStart(2, '0')}`;
    return s;
}
