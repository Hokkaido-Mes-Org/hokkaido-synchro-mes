/**
 * product.utils.js — Utilitários de busca de produto
 * Extraído de script.js (Phase 3B) — usa window.* globals
 */

/**
 * Busca produto por código numérico ou string.
 * Tenta 4 fontes em ordem:
 *  1. window.productByCode (Map)
 *  2. window.databaseModule.productByCode (Map)
 *  3. window.productDatabase (Array)
 *  4. window.databaseModule.productDatabase (Array)
 *
 * @param {number|string} code
 * @returns {object|null}
 */
export function getProductByCode(code) {
    if (!code && code !== 0) return null;

    const numericCode = Number(code);
    const stringCode = String(code).trim();
    let product = null;

    // 1. Via window.productByCode (Map)
    if (window.productByCode instanceof Map && window.productByCode.size > 0) {
        product = window.productByCode.get(numericCode) || window.productByCode.get(stringCode);
        if (product) return product;
    }

    // 2. Via window.databaseModule.productByCode
    const moduleIndex = window.databaseModule?.productByCode;
    if (moduleIndex instanceof Map && moduleIndex.size > 0) {
        product = moduleIndex.get(numericCode) || moduleIndex.get(stringCode);
        if (product) return product;
    }

    // 3. Fallback: window.productDatabase (array)
    if (Array.isArray(window.productDatabase) && window.productDatabase.length > 0) {
        product = window.productDatabase.find(p => Number(p.cod) === numericCode || String(p.cod) === stringCode);
        if (product) return product;
    }

    // 4. Fallback: databaseModule array
    const dbArray = window.databaseModule?.productDatabase;
    if (Array.isArray(dbArray) && dbArray.length > 0) {
        product = dbArray.find(p => Number(p.cod) === numericCode || String(p.cod) === stringCode);
        if (product) return product;
    }

    console.warn(`[getProductByCode] Produto ${code} não encontrado.`, {
        windowProductByCodeSize: window.productByCode?.size || 0,
        windowProductDatabaseLength: window.productDatabase?.length || 0,
        databaseModuleExists: !!window.databaseModule
    });

    return null;
}

// Expor no window para uso em legacy code
if (typeof window !== 'undefined') {
    window.getProductByCode = getProductByCode;
}
