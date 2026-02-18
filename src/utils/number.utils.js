/**
 * number.utils.js — Utilitários de conversão e parsing numérico
 * Extraído de script.js (Phase 3B) — funções puras sem dependências externas
 */

/**
 * Normaliza strings numéricas pt-BR/EN para formato parseável (ponto decimal)
 * @param {*} value
 * @returns {string|null}
 */
export function normalizeNumericString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const thousandPatternPtBr = /^\d{1,3}(\.\d{3})+(,\d+)?$/;
    const thousandPatternEn = /^\d{1,3}(,\d{3})+(\.\d+)?$/;

    const hasComma = trimmed.includes(',');
    const hasDot = trimmed.includes('.');

    // Se possuir apenas vírgula (formato típico pt-BR), tratar como decimal
    if (hasComma && !hasDot) {
        return trimmed.replace(/\s+/g, '').replace(',', '.');
    }

    if (thousandPatternPtBr.test(trimmed)) {
        return trimmed.replace(/\./g, '').replace(',', '.');
    }

    if (thousandPatternEn.test(trimmed)) {
        return trimmed.replace(/,/g, '');
    }

    // Caso geral: remover espaços e trocar vírgula por ponto
    return trimmed.replace(/\s+/g, '').replace(',', '.');
}

/**
 * Parseia um valor opcional para número, retornando null se inválido
 * @param {*} value
 * @returns {number|null}
 */
export function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const normalized = normalizeNumericString(value);
        if (normalized === null) return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    const fallback = Number(value);
    return Number.isFinite(fallback) ? fallback : null;
}

/**
 * Converte valor para número com fallback garantido
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
export function coerceToNumber(value, fallback = 0) {
    const parsed = parseOptionalNumber(value);
    return parsed === null ? fallback : parsed;
}

/**
 * Parser de peso de peça para planejamento (entrada em gramas)
 * @param {*} value
 * @returns {number}
 */
export function parsePieceWeightInput(value) {
    if (value === undefined || value === null || value === '') return 0;
    const normalized = normalizeNumericString(value);
    const parsed = parseFloat(normalized !== null ? normalized : String(value).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
}

/**
 * Parseia valor de peso em gramas
 * @param {*} value
 * @returns {number}
 */
export function parsePieceWeightGrams(value) {
    if (value === undefined || value === null || value === '') return 0;
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
}

/**
 * Resolve peso de peça em gramas a partir de múltiplas fontes (primeiro > 0 vence)
 * @param {...*} sources
 * @returns {number}
 */
export function resolvePieceWeightGrams(...sources) {
    for (const source of sources) {
        const grams = parsePieceWeightGrams(source);
        if (grams > 0) {
            return grams;
        }
    }
    return 0;
}

// Expor no window para uso em legacy code
if (typeof window !== 'undefined') {
    window.coerceToNumber = coerceToNumber;
    window.parseOptionalNumber = parseOptionalNumber;
    window.parsePieceWeightInput = parsePieceWeightInput;
    window.resolvePieceWeightGrams = resolvePieceWeightGrams;
    window.normalizeNumericString = normalizeNumericString;
}
