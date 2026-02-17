/**
 * HokkaidoMES — Date Utilities (ES6 Module)
 * Fase 3: Extraído de script.js
 *
 * Funções puras de data/hora usadas por múltiplos controllers.
 * Todas refletem a regra de "dia de produção" da Hokkaido:
 *   - Dia de produção = 06:30 de hoje até 06:29 do dia seguinte
 *   - Turno 1: 06:30-14:59 | Turno 2: 15:00-23:19 | Turno 3: 23:20-06:29
 */

/**
 * Retorna o dia de produção no formato YYYY-MM-DD.
 * Se antes das 06:30, retorna o dia anterior.
 * @param {Date} [date=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function getProductionDateString(date = new Date()) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const hour = dateObj.getHours();
    const minute = dateObj.getMinutes();

    if (hour < 6 || (hour === 6 && minute < 30)) {
        const prevDay = new Date(dateObj);
        prevDay.setDate(prevDay.getDate() - 1);
        return new Date(prevDay.getTime() - (prevDay.getTimezoneOffset() * 60000))
            .toISOString().split('T')[0];
    }

    return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000))
        .toISOString().split('T')[0];
}

/**
 * Retorna o turno atual (1, 2 ou 3).
 * T1: 06:30-14:59 | T2: 15:00-23:19 | T3: 23:20-06:29
 * @param {Date} [reference=new Date()]
 * @returns {number} 1 | 2 | 3
 */
export function getCurrentShift(reference = new Date()) {
    const hour = reference.getHours();
    const minute = reference.getMinutes();

    if ((hour === 6 && minute >= 30) || (hour >= 7 && hour < 15)) {
        return 1;
    } else if (hour >= 15 && (hour < 23 || (hour === 23 && minute < 20))) {
        return 2;
    } else {
        return 3;
    }
}

/**
 * Determina o turno de uma data/hora específica (usando totalMinutes).
 * @param {Date} dateTime
 * @returns {number|null} 1 | 2 | 3 | null
 */
export function getShiftForDateTime(dateTime) {
    if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) return null;

    const hour = dateTime.getHours();
    const min = dateTime.getMinutes();
    const totalMinutes = hour * 60 + min;

    if (totalMinutes >= 390 && totalMinutes < 900) return 1;
    if (totalMinutes >= 900 && totalMinutes < 1400) return 2;
    return 3;
}

/** Definições de turno configuráveis */
export const SHIFT_DEFINITIONS = [
    { shift: 1, startHour: 6, startMin: 30, endHour: 14, endMin: 59 },
    { shift: 2, startHour: 15, startMin: 0, endHour: 23, endMin: 19 },
    { shift: 3, startHour: 23, startMin: 20, endHour: 6, endMin: 29, crossesMidnight: true }
];

/**
 * Formata data no padrão brasileiro DD/MM/YYYY a partir de string YYYY-MM-DD.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} DD/MM/YYYY ou '--'
 */
export function formatDateBR(dateStr) {
    if (!dateStr) return '--';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

/**
 * Formata Date como YYYY-MM-DD.
 * @param {Date} d
 * @returns {string}
 */
export function formatDateYMD(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Formata Date como HH:MM.
 * @param {Date} d
 * @returns {string}
 */
export function formatTimeHM(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Formata Date como YYYY-MM-DD (alias para input[type=date]).
 * @param {Date} date
 * @returns {string}
 */
export function formatDateInput(date) {
    return formatDateYMD(date);
}

/**
 * Formata Date como DD/MM (curto).
 * @param {Date} d
 * @returns {string}
 */
export function formatDateBRShort(d) {
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/**
 * Formata Date como DD/MM/YYYY (completo).
 * @param {Date} d
 * @returns {string}
 */
export function formatDateBRFull(d) {
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Pad number to 2 digits.
 * @param {number} n
 * @returns {string}
 */
export function pad2(n) {
    return String(n).padStart(2, '0');
}

/**
 * Combina strings de data (YYYY-MM-DD) e hora (HH:MM) em um objeto Date.
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @param {string} timeStr - Hora no formato HH:MM
 * @returns {Date|null}
 */
export function combineDateAndTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    if ([year, month, day, hour, minute].some(value => Number.isNaN(value))) {
        return null;
    }
    return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
}

// ─── Self-register on window ───
window.combineDateAndTime = combineDateAndTime;
